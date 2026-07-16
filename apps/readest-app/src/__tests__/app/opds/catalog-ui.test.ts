import { describe, expect, it } from 'vitest';

import {
  getCatalogSetupHint,
  getCatalogUiDescription,
  getCatalogUiLabel,
} from '@/app/opds/utils/catalogUi';

const _ = (key: string) => key;

describe('catalogUi', () => {
  it('uses the local-first OPDS / Calibre label and description by default', () => {
    expect(getCatalogUiLabel(_, false)).toBe('OPDS / Calibre Catalogs');
    expect(getCatalogUiDescription(_, false)).toBe(
      'Browse and download books from OPDS feeds, including Calibre Content Server and Calibre-Web libraries.',
    );
    expect(getCatalogSetupHint(_, false)).toContain('http://host:8080/opds');
    expect(getCatalogSetupHint(_, false)).toContain('HTTP Basic Auth');
  });

  it('keeps the hosted label for the online library surface', () => {
    expect(getCatalogUiLabel(_, true)).toBe('Online Library');
    expect(getCatalogUiDescription(_, true)).toBe(
      'Browse and download books from online catalogs.',
    );
    expect(getCatalogSetupHint(_, true)).toBe(
      'Add a catalog URL. Bookhearth will validate the feed and follow its browse, search, and download links.',
    );
  });
});
