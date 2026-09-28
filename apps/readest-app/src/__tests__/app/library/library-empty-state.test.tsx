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
  it('renders title, desktop description, and the import action on desktop', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false },
    });
    render(<LibraryEmptyState onImport={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Start your library' })).toBeTruthy();
    expect(screen.getByText(/drop a book anywhere on this window/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Import Books' })).toBeTruthy();
  });

  it('renders mobile description (no drag-drop language) when appService.isMobile', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: true },
    });
    render(<LibraryEmptyState onImport={vi.fn()} />);

    expect(screen.getByText(/pick a book from your device/i)).toBeTruthy();
    expect(screen.queryByText(/drop a book anywhere on this window/i)).toBeNull();
  });

  it('calls onImport with the button element when the Import Books button is clicked', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false },
    });
    const handleImport = vi.fn();
    render(<LibraryEmptyState onImport={handleImport} />);

    const button = screen.getByRole('button', { name: 'Import Books' });
    fireEvent.click(button);

    expect(handleImport).toHaveBeenCalledTimes(1);
    expect(handleImport).toHaveBeenCalledWith(button);
  });

  it('exposes the import action without account/auth affordances', () => {
    useEnvMock.mockReturnValue({
      appService: { isMobile: false },
    });
    const { container } = render(<LibraryEmptyState onImport={vi.fn()} />);

    // Local-first empty state must not push users toward account/premium surfaces.
    // Import into Collection and OPDS/Calibre catalog access live in the shared
    // import menu this button opens (see import-menu.test.tsx).
    const body = container.textContent ?? '';
    expect(body).not.toMatch(/sign in|log in|subscribe|premium|account/i);
  });
});
