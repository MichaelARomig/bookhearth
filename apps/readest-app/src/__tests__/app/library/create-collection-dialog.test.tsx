import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CreateCollectionDialog from '@/app/library/components/CreateCollectionDialog';

vi.mock('@/components/Dialog', () => ({
  default: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children: React.ReactNode;
  }) =>
    isOpen ? (
      <div>
        {title ? <h1>{title}</h1> : null}
        {children}
      </div>
    ) : null,
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => (key: string) => key,
}));

afterEach(() => {
  cleanup();
});

describe('CreateCollectionDialog', () => {
  it('keeps the submit action disabled until a collection name is entered', () => {
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(<CreateCollectionDialog isOpen={true} onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('button', { name: 'Choose Books' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the chosen collection name and closes on success', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(true);

    render(<CreateCollectionDialog isOpen={true} onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByPlaceholderText('Collection name'), {
      target: { value: 'Weekend Reads' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose Books' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Weekend Reads');
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
