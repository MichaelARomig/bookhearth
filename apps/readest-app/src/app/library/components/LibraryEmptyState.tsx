import * as React from 'react';
import clsx from 'clsx';
import { PiBooks } from 'react-icons/pi';

import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { getCatalogUiLabel } from '@/app/opds/utils/catalogUi';

interface LibraryEmptyStateProps {
  onImport: () => void;
  onImportIntoCollection: () => void;
  onOpenCatalogManager: () => void;
}

const LibraryEmptyState: React.FC<LibraryEmptyStateProps> = ({
  onImport,
  onImportIntoCollection,
  onOpenCatalogManager,
}) => {
  const _ = useTranslation();
  const { appService } = useEnv();
  const isMobile = appService?.isMobile ?? false;
  const catalogLabel = getCatalogUiLabel(_, appService?.isOnlineCatalogsAccessible);

  return (
    <div className='hero-content text-neutral-content text-center'>
      <div className='flex max-w-md flex-col items-center'>
        <PiBooks aria-hidden className='text-base-content/60 mb-10 size-16' />
        <h1 className='mb-5 text-balance text-4xl font-semibold leading-tight tracking-tight'>
          {_('Start your library')}
        </h1>
        <p className='text-base-content/70 mb-12 text-pretty text-base leading-relaxed'>
          {isMobile
            ? _('Pick a book from your device to add it to your library.')
            : _('Drop a book anywhere on this window, or pick one from your computer.')}
        </p>
        <div className='flex w-full max-w-xs flex-col gap-3'>
          <button
            type='button'
            className='btn btn-primary h-11 min-h-11 rounded-lg'
            onClick={onImport}
          >
            {_('Import Books')}
          </button>
          <button
            type='button'
            className='btn btn-outline h-11 min-h-11 rounded-lg'
            onClick={onImportIntoCollection}
          >
            {_('Import into Collection')}
          </button>
          <button
            type='button'
            className={clsx(
              'text-base-content/75 hover:text-base-content rounded-lg py-2 text-sm font-medium',
              'focus-visible:text-base-content focus-visible:outline-none',
            )}
            onClick={onOpenCatalogManager}
          >
            {catalogLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LibraryEmptyState;
