import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ImportMenu from '@/app/library/components/ImportMenu';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

const useEnvMock = vi.fn();
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => useEnvMock(),
}));

afterEach(() => {
  cleanup();
  useEnvMock.mockReset();
});

describe('ImportMenu', () => {
  it('shows collection and OPDS/Calibre entry points in the local-first menu', () => {
    useEnvMock.mockReturnValue({
      appService: { isOnlineCatalogsAccessible: false },
    });

    render(
      <ImportMenu
        onImportBooksFromFiles={vi.fn()}
        onImportIntoCollection={vi.fn()}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    expect(screen.getByText('From Local File')).toBeTruthy();
    expect(screen.getByText('Import into Collection')).toBeTruthy();
    expect(screen.getByText('OPDS / Calibre Catalogs')).toBeTruthy();
  });

  it('closes after invoking the collection and catalog actions', () => {
    useEnvMock.mockReturnValue({
      appService: { isOnlineCatalogsAccessible: true },
    });

    const setIsDropdownOpen = vi.fn();
    const onImportIntoCollection = vi.fn();
    const onOpenCatalogManager = vi.fn();

    render(
      <ImportMenu
        setIsDropdownOpen={setIsDropdownOpen}
        onImportBooksFromFiles={vi.fn()}
        onImportIntoCollection={onImportIntoCollection}
        onOpenCatalogManager={onOpenCatalogManager}
      />,
    );

    fireEvent.click(screen.getByText('Import into Collection'));
    expect(onImportIntoCollection).toHaveBeenCalledTimes(1);
    expect(setIsDropdownOpen).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByText('Online Library'));
    expect(onOpenCatalogManager).toHaveBeenCalledTimes(1);
    expect(setIsDropdownOpen).toHaveBeenLastCalledWith(false);
  });
});
