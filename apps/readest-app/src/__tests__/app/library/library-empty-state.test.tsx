import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LibraryEmptyState from '@/app/library/components/LibraryEmptyState';

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string, options?: Record<string, string | number>) => {
    if (!options) return key;
    return key.replace(/{{(\w+)}}/g, (_match, name) => String(options[name] ?? ''));
  },
}));

const useEnvMock = vi.fn();
vi.mock('@/context/EnvContext', () => ({
  useEnv: () => useEnvMock(),
}));

afterEach(() => {
  cleanup();
  useEnvMock.mockReset();
});

describe('LibraryEmptyState', () => {
  it('renders title, desktop description, and local-first actions on desktop', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false, isOnlineCatalogsAccessible: false },
    });
    render(
      <LibraryEmptyState
        onImport={vi.fn()}
        onImportIntoCollection={vi.fn()}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Start your library' })).toBeTruthy();
    expect(screen.getByText(/drop a book anywhere on this window/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import Books' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import into Collection' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OPDS / Calibre Catalogs' })).toBeTruthy();
  });

  it('renders mobile description (no drag-drop language) when appService.isMobile', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: true, isOnlineCatalogsAccessible: false },
    });
    render(
      <LibraryEmptyState
        onImport={vi.fn()}
        onImportIntoCollection={vi.fn()}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    expect(screen.getByText(/pick a book from your device/i)).toBeTruthy();
    expect(screen.queryByText(/drop a book anywhere on this window/i)).toBeNull();
  });

  it('shows the online-library label when the app exposes online catalogs', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false, isOnlineCatalogsAccessible: true },
    });
    render(
      <LibraryEmptyState
        onImport={vi.fn()}
        onImportIntoCollection={vi.fn()}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Online Library' })).toBeTruthy();
  });

  it('calls onImport when the Import Books button is clicked', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false, isOnlineCatalogsAccessible: false },
    });
    const handleImport = vi.fn();
    render(
      <LibraryEmptyState
        onImport={handleImport}
        onImportIntoCollection={vi.fn()}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import Books' }));

    expect(handleImport).toHaveBeenCalledTimes(1);
  });

  it('exposes collection creation without account/auth affordances', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false, isOnlineCatalogsAccessible: false },
    });
    const onImportIntoCollection = vi.fn();
    const { container } = render(
      <LibraryEmptyState
        onImport={vi.fn()}
        onImportIntoCollection={onImportIntoCollection}
        onOpenCatalogManager={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import into Collection' }));
    expect(onImportIntoCollection).toHaveBeenCalledTimes(1);

    // Local-first empty state must not push users toward account/premium surfaces.
    const body = container.textContent ?? '';
    expect(body).not.toMatch(/sign in|log in|subscribe|premium|account/i);
  });
});
