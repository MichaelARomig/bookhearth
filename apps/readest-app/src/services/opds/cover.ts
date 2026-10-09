import { md5 } from 'js-md5';
import type { Book } from '@/types/book';
import type { AppService } from '@/types/system';
import type { OPDSGenericLink } from '@/types/opds';
import { REL } from '@/types/opds';
import { downloadFile } from '@/libs/storage';
import { fetchWithAuth, getProxiedURL, needsProxy, probeAuth } from '@/app/opds/utils/opdsReq';
import { READEST_OPDS_USER_AGENT } from '@/services/constants';
import { getCoverFilename } from '@/utils/book';
import { uniqueId } from '@/utils/misc';

/**
 * Exact-match a link's rel tokens. Substring matching is wrong here:
 * `http://opds-spec.org/image/thumbnail` contains `http://opds-spec.org/image`,
 * so a naive `includes` would accept the thumbnail as the full-size cover.
 */
const matchesRel = (link: OPDSGenericLink, rels: readonly string[]) => {
  const linkRels = Array.isArray(link.rel) ? link.rel : (link.rel ?? '').split(/\s+/);
  return linkRels.some((rel) => rels.includes(rel));
};

/**
 * The href of the artwork an OPDS entry advertises for itself, or undefined
 * when it advertises none. Catalogs that let users replace a book's cover
 * (Calibre-Web Automated and friends) publish the replacement here while the
 * EPUB/PDF file still carries the original, so this is the cover the library
 * should show (issue #5270).
 *
 * Prefers the full-size `rel="…/image"` link, then the thumbnail, then
 * whatever image came first. The href is returned as-is — resolve it against
 * the feed's base URL before fetching.
 */
export const getOPDSCoverHref = (publication: {
  // Optional at runtime: feeds without artwork parse to an entry with no
  // `images`, and the detail-document merge can drop it.
  images?: OPDSGenericLink[];
}): string | undefined => {
  const images = publication.images ?? [];
  const cover =
    images.find((img) => matchesRel(img, REL.COVER) && img.href) ??
    images.find((img) => matchesRel(img, REL.THUMBNAIL) && img.href) ??
    images.find((img) => img.href);
  return cover?.href;
};

/**
 * Cache filename for a downloaded OPDS image. Some catalogs replace the cover
 * bytes at an unchanged URL and only advance the entry's Atom `<updated>`
 * value, so when the entry carries one it participates in the key and the
 * replacement invalidates the cached file (issue #5492). Entries without
 * `<updated>` keep the historical URL-only key, so their existing cache files
 * stay valid.
 */
export const getOPDSImageCacheFilename = (url: string, updated?: string): string =>
  `img_${md5(updated ? `${url}\n${updated}` : url)}.png`;

/**
 * Cleartext cover URLs cannot be handed to the iOS webview. The shipped app
 * has no App Transport Security exception, so WKWebView drops `http://`
 * images while the native HTTP client (used for the OPDS feed) still loads
 * the catalog. Titles show up and covers do not. Those images have to be
 * downloaded natively and shown from the asset cache.
 *
 * HTTPS covers stay with the webview. The web build is unaffected: it loads
 * images through the OPDS proxy, which is already HTTPS.
 */
export const opdsImageNeedsNativeFetch = (url: string, tauriApp: boolean): boolean => {
  if (!tauriApp) return false;
  try {
    return new URL(url).protocol === 'http:';
  } catch {
    return false;
  }
};

const declaredImageType = (header: string | null): string | null => {
  const declared = header?.split(';')[0]?.trim().toLowerCase() ?? '';
  return declared.startsWith('image/') ? declared : null;
};

// Content-Type is missing or a lie often enough (a proxy, a Digest challenge
// page) that the JPEG/PNG/GIF/WebP signature is the backup.
const sniffedImageType = (bytes: Uint8Array): string | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) {
    return 'image/webp';
  }
  return null;
};

/**
 * Download an OPDS cover with the same client that loads the catalog and
 * return a blob URL the webview can paint.
 *
 * Giving WKWebView the raw `http://` URL fails: the iOS build has no App
 * Transport Security exception. Saving the file and pointing `<img>` at the
 * asset URL also produced no covers on device. A blob is created here, so
 * the webview never requests the Calibre host itself. `fetchWithAuth`
 * negotiates Digest, which is Calibre's default when a password is required
 * over plain HTTP; the file-download path only sends Basic and Calibre
 * rejects that with HTTP 400.
 */
export const fetchOPDSImageObjectUrl = async (
  url: string,
  username = '',
  password = '',
  customHeaders: Record<string, string> = {},
): Promise<string> => {
  const useProxy = needsProxy(url);
  const response = await fetchWithAuth(
    url,
    username,
    password,
    useProxy,
    { headers: { Accept: 'image/jpeg, image/png, image/webp, image/gif, image/*' } },
    customHeaders,
  );
  if (!response.ok) {
    throw new Error(`Cover request failed (${response.status})`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const type = declaredImageType(response.headers.get('content-type')) ?? sniffedImageType(bytes);
  if (!bytes.byteLength || !type) {
    throw new Error('Cover response was not an image');
  }
  return URL.createObjectURL(new Blob([bytes], { type }));
};

interface ApplyOPDSCoverParams {
  appService: AppService;
  /** Imported book; its `coverHash`/`coverImageUrl` are updated in place. */
  book: Book;
  /** Absolute URL of the cover advertised by the OPDS entry. */
  coverUrl: string;
  username?: string;
  password?: string;
  customHeaders?: Record<string, string>;
}

/**
 * Replace an imported book's cover with the one the OPDS entry advertises.
 *
 * Best effort: any failure (offline, 404, empty body) leaves the cover
 * extracted from the book file in place and returns false, so a catalog
 * without usable artwork never degrades the import.
 */
export const applyOPDSCover = async ({
  appService,
  book,
  coverUrl,
  username = '',
  password = '',
  customHeaders = {},
}: ApplyOPDSCoverParams): Promise<boolean> => {
  const useProxy = needsProxy(coverUrl);
  let downloadUrl = useProxy ? getProxiedURL(coverUrl, '', true, customHeaders) : coverUrl;
  const headers: Record<string, string> = {
    'User-Agent': READEST_OPDS_USER_AGENT,
    Accept: 'image/*',
    ...(!useProxy ? customHeaders : {}),
  };
  if (username || password) {
    const authHeader = await probeAuth(coverUrl, username, password, useProxy, customHeaders);
    if (authHeader) {
      if (!useProxy) {
        headers['Authorization'] = authHeader;
      }
      downloadUrl = useProxy ? getProxiedURL(coverUrl, authHeader, true, customHeaders) : coverUrl;
    }
  }

  const tmpPath = await appService.resolveFilePath(`opds_cover_${uniqueId()}`, 'Cache');
  try {
    await downloadFile({
      appService,
      dst: tmpPath,
      cfp: '',
      url: downloadUrl,
      headers,
      singleThreaded: true,
      // Same self-signed/private-CA workaround the book download uses (#4988).
      skipSslVerification: true,
    });
    const bytes = (await appService.readFile(tmpPath, 'None', 'binary')) as ArrayBuffer;
    if (!bytes?.byteLength) return false;
    await appService.writeFile(getCoverFilename(book), 'Books', bytes);
  } catch (error) {
    console.warn('[OPDS] failed to apply the feed cover:', error);
    return false;
  } finally {
    try {
      await appService.deleteFile(tmpPath, 'None');
    } catch {
      // best effort cache cleanup
    }
  }

  // Keep coverHash === partialMD5(cover.png) so cross-device cover sync still
  // sees the truth (issue #4544), and refresh the URL the library renders from
  // — on web it is a blob URL bound to the bytes we just replaced.
  book.coverHash = await appService.computeCoverHash(book);
  book.coverImageUrl = await appService.generateCoverImageUrl(book);
  return true;
};
