import { expect, test } from '../fixtures/base';
import { LibraryPage } from '../pages/LibraryPage';

/**
 * Live OPDS e2e against the workspace calibre-server fixture.
 *
 * Requires (already used for client-path QA):
 *   calibre-server --port 8080 --enable-auth --auth-mode=basic ...
 *   user qa / qapass
 *
 * Skips when the server is unreachable so CI without the fixture stays green.
 */
const CALIBRE_ROOT = process.env['CALIBRE_OPDS_BASE']
  ? `${process.env['CALIBRE_OPDS_BASE']!.replace(/\/$/, '')}/opds`
  : 'http://127.0.0.1:8080/opds';
const CALIBRE_USER = process.env['CALIBRE_OPDS_USER'] ?? 'qa';
const CALIBRE_PASS = process.env['CALIBRE_OPDS_PASS'] ?? 'qapass';

async function calibreUp(): Promise<boolean> {
  try {
    const res = await fetch(CALIBRE_ROOT, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${CALIBRE_USER}:${CALIBRE_PASS}`).toString('base64')}`,
      },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

test.describe('Calibre OPDS live catalog (web)', () => {
  test.beforeAll(async () => {
    test.skip(!(await calibreUp()), `calibre-server not reachable at ${CALIBRE_ROOT}`);
  });

  test('add authenticated Calibre catalog, browse, search, download EPUB', async ({ page }) => {
    test.setTimeout(120_000);

    const library = new LibraryPage(page);
    await library.goto();
    await expect(library.emptyState).toBeVisible();

    // Empty-state catalog entry (web: "Online Library"; local-first: "OPDS / Calibre…")
    await page.getByRole('button', { name: /OPDS|Calibre|Online Library/i }).click();

    // Catalog manager shell
    await expect(
      page
        .getByRole('heading', { name: 'Online Library', exact: true })
        .or(page.getByRole('heading', { name: 'OPDS / Calibre Catalogs', exact: true })),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'No catalogs yet' })).toBeVisible();

    await page.getByRole('button', { name: 'Add Your First Catalog' }).click();
    await expect(page.getByRole('heading', { name: 'Add OPDS Catalog' })).toBeVisible();

    await page.getByPlaceholder('My Calibre Library').fill('Local Calibre QA');
    await page.getByPlaceholder('http://calibre.local:8080/opds').fill(CALIBRE_ROOT);
    await page.getByPlaceholder('Username', { exact: true }).fill(CALIBRE_USER);
    await page.getByPlaceholder('Password', { exact: true }).fill(CALIBRE_PASS);

    // Web proxy consent (LAN catalogs on the web build)
    const dialog = page.locator('dialog.modal-open');
    const consent = dialog.locator('input.checkbox');
    if (await consent.count()) {
      await consent.first().check();
    }

    // Primary action is at the bottom of a tall dialog — scroll it into view.
    const addBtn = dialog.getByRole('button', { name: 'Add Catalog' });
    await addBtn.scrollIntoViewIfNeeded();
    await addBtn.click();

    // Validation hits the live server via /api/opds/proxy in dev
    await expect(page.getByText('Local Calibre QA')).toBeVisible({ timeout: 45_000 });
    // Error from failed validation must not linger
    await expect(page.getByText(/Failed to load|Authentication required|not allowed/i)).toHaveCount(
      0,
    );

    // Open the saved catalog (card is role=button)
    await page.getByRole('button', { name: /Local Calibre QA/i }).click();

    // Root feed navigation (Calibre Content Server)
    await expect(page.getByText('By Newest')).toBeVisible({ timeout: 45_000 });
    await page.getByText('By Newest').click();

    // Publications appear
    await expect(
      page.getByText(/Alice|Frankenstein|Pride|Moby|Sherlock|Tale of Two/i).first(),
    ).toBeVisible({ timeout: 45_000 });

    // Search Alice via OPDS header (debounced ~1s)
    const search = page.getByPlaceholder(/Search in OPDS/i);
    await search.fill('Alice');
    await expect(page.getByText(/Alice/i).first()).toBeVisible({ timeout: 45_000 });

    // Open a publication card titled with Alice → detail view with acquisition
    await page.locator('.card').filter({ hasText: /Alice/i }).first().click();
    await expect(page.getByRole('heading', { name: /Alice/i })).toBeVisible({ timeout: 15_000 });

    // Calibre often exposes multiple formats (EPUB + AZW3). Single-format shows a
    // plain Download button; multi-format uses a dropdown labeled Download.
    const downloadBtn = page.getByRole('button', { name: /^(Download|Open Access)$/i }).first();
    await expect(downloadBtn).toBeVisible({ timeout: 15_000 });
    await downloadBtn.click();

    // If a format menu opened, pick EPUB preferentially.
    const epubItem = page.getByRole('button', { name: /^EPUB$/i }).or(page.getByText(/^EPUB$/i));
    if (
      await epubItem
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      await epubItem.first().click();
    }

    await expect(page.getByText(/Download completed|Import failed|Download failed/i)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText(/Import failed|Download failed/i)).toHaveCount(0);
    await expect(page.getByText('Download completed')).toBeVisible();

    // Return to library — book should be present (title may be line-clamped;
    // assert via book card filter rather than raw getByText visibility).
    await page.goto('/library');
    await library.container.waitFor({ state: 'visible' });
    await expect(library.bookCards().first()).toBeVisible({ timeout: 30_000 });
    await expect(library.bookCards().filter({ hasText: /Alice/i })).toHaveCount(1);
  });
});
