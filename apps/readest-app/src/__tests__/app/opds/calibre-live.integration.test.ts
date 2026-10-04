/**
 * Live integration against a Calibre Content Server on the LAN.
 *
 * Defaults to the home server (Calibre Content Server at
 * http://192.168.1.244:2665, OPDS root /opds; Calibre-Web runs separately on
 * :2666/:2667 and is not what this suite exercises). Override with
 * CALIBRE_OPDS_BASE / CALIBRE_OPDS_USER / CALIBRE_OPDS_PASS.
 *
 * The server is not always up, and its login is not committed. The whole suite
 * SKIPS unless the probe gets an authenticated OPDS feed from Calibre, so a
 * server that is down, a wrong/missing login, or an unrelated service on the
 * port (previously the old default 127.0.0.1:8080 hit a different local app
 * and failed instead of skipping) never breaks `pnpm test` or the pre-push hook.
 *
 * When it does run, the content tests assume the library has at least one
 * EPUB under "By Newest" and a title matching "Alice".
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getFeed } from 'foliate-js/opds.js';
import {
  validateOPDSURL,
  resolveURL,
  parseOPDSXML,
  expandOPDSSearchTemplate,
  isSearchLink,
} from '@/app/opds/utils/opdsUtils';
import { fetchWithAuth, createBasicAuth } from '@/app/opds/utils/opdsReq';
import { getAcquisitionLink } from '@/services/opds/feedChecker';
import type { OPDSFeed } from '@/types/opds';

const BASE = process.env['CALIBRE_OPDS_BASE'] ?? 'http://192.168.1.244:2665';
const USER = process.env['CALIBRE_OPDS_USER'] ?? 'qa';
const PASS = process.env['CALIBRE_OPDS_PASS'] ?? 'qapass';
const ROOT = `${BASE}/opds`;

let serverUp = false;

beforeAll(async () => {
  try {
    const res = await fetch(ROOT, {
      headers: { Authorization: createBasicAuth(USER, PASS) },
      signal: AbortSignal.timeout(3000),
    });
    // Must be an authenticated Calibre OPDS feed, not just any 200 on the port.
    const body = res.ok ? await res.text() : '';
    serverUp = /<feed[\s>]/.test(body) && /calibre/i.test(body);
  } catch {
    serverUp = false;
  }
});

const live = () => {
  if (!serverUp) {
    console.warn(
      `[skip] no authenticated Calibre OPDS feed at ${ROOT} (server down, or set CALIBRE_OPDS_USER/CALIBRE_OPDS_PASS)`,
    );
  }
  return serverUp;
};

describe('Calibre Content Server live OPDS (client path)', () => {
  it('validateOPDSURL accepts authenticated root /opds', async ({ skip }) => {
    if (!live()) skip();
    const result = await validateOPDSURL(ROOT, USER, PASS, false);
    expect(result.isValid).toBe(true);
    expect(result.data?.type).toBe('feed');
  });

  it('rejects bad credentials with an auth error', async ({ skip }) => {
    if (!live()) skip();
    const result = await validateOPDSURL(ROOT, USER, 'wrong-password', false);
    expect(result.isValid).toBe(false);
    expect(String(result.error)).toMatch(/auth|401|password/i);
  });

  it('parses root navigation and search link via foliate getFeed', async ({ skip }) => {
    if (!live()) skip();
    const result = await validateOPDSURL(ROOT, USER, PASS, false);
    expect(result.isValid).toBe(true);
    const feed = getFeed(result.data!.doc) as OPDSFeed;
    expect(feed.metadata.title).toMatch(/calibre/i);
    expect(feed.navigation?.length).toBeGreaterThan(0);
    const titles = (feed.navigation ?? []).map((n) => n.title);
    expect(titles.some((t) => /newest|title|author/i.test(t ?? ''))).toBe(true);

    const getRels = (rel?: string | string[]) => (Array.isArray(rel) ? rel : [rel ?? '']);
    const search = feed.links?.find((l) => getRels(l.rel).includes('search'));
    expect(search?.href).toBeTruthy();
    expect(search!.href).toMatch(/search/i);
  });

  it('browses By Newest and finds acquisition links + preferred EPUB', async ({ skip }) => {
    if (!live()) skip();
    const rootResult = await validateOPDSURL(ROOT, USER, PASS, false);
    const rootFeed = getFeed(rootResult.data!.doc) as OPDSFeed;
    const newest = (rootFeed.navigation ?? []).find((n) => /newest/i.test(n.title ?? ''));
    expect(newest?.href).toBeTruthy();

    const newestUrl = resolveURL(newest!.href!, ROOT);
    const shelfRes = await fetchWithAuth(newestUrl, USER, PASS, false);
    expect(shelfRes.ok).toBe(true);
    const shelfText = await shelfRes.text();
    const shelfFeed = getFeed(parseOPDSXML(shelfText)) as OPDSFeed;
    expect(shelfFeed.publications?.length).toBeGreaterThan(0);

    const pub = shelfFeed.publications![0]!;
    const acq = getAcquisitionLink(pub);
    expect(acq?.href).toBeTruthy();

    // Prefer EPUB when present on any publication in the shelf
    const withEpub = shelfFeed.publications!.find((p) => {
      const links = p.links ?? [];
      return links.some(
        (l) =>
          (l.type ?? '').includes('epub') ||
          /\/get\/epub\//i.test(l.href ?? '') ||
          /\.epub/i.test(l.href ?? ''),
      );
    });
    expect(withEpub).toBeTruthy();
    const epubLink = getAcquisitionLink(withEpub!);
    expect(epubLink?.href).toBeTruthy();

    const downloadUrl = resolveURL(epubLink!.href!, newestUrl);
    const dl = await fetchWithAuth(downloadUrl, USER, PASS, false);
    expect(dl.ok).toBe(true);
    const buf = new Uint8Array(await dl.arrayBuffer());
    expect(buf.byteLength).toBeGreaterThan(1000);
    // EPUB is a ZIP: PK magic
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it('runs calibre search template for Alice via expand-before-resolve', async ({ skip }) => {
    if (!live()) skip();
    const rootResult = await validateOPDSURL(ROOT, USER, PASS, false);
    const rootFeed = getFeed(rootResult.data!.doc) as OPDSFeed;
    const search = rootFeed.links?.find(isSearchLink);
    expect(search?.href).toBeTruthy();

    // App path for Atom templates (Calibre): expand path variables first, then
    // resolveURL. Expanding after resolveURL alone used to 404 because braces
    // became %7BsearchTerms%7D.
    const expanded = expandOPDSSearchTemplate(search!.href!, 'Alice');
    const searchUrl = resolveURL(expanded, ROOT);
    expect(searchUrl).toMatch(/\/opds\/search\/Alice/i);
    expect(searchUrl).not.toMatch(/%7BsearchTerms%7D/i);

    const res = await fetchWithAuth(searchUrl, USER, PASS, false);
    expect(res.ok).toBe(true);
    const feed = getFeed(parseOPDSXML(await res.text())) as OPDSFeed;
    const titles = [
      ...(feed.publications ?? []).map((p) => p.metadata?.title ?? ''),
      ...(feed.navigation ?? []).map((n) => n.title ?? ''),
    ];
    expect(titles.some((t) => /alice/i.test(t))).toBe(true);
  });
});
