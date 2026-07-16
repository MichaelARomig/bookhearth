'use client';

import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEnv } from '@/context/EnvContext';
import { useTheme } from '@/hooks/useTheme';
import { useTranslation } from '@/hooks/useTranslation';
import { getCloudSyncProvider, cloudProviderDisplayName } from '@/services/sync/cloudSyncProvider';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { navigateToLibrary } from '@/utils/nav';
import ProfileHeader from './components/Header';
import { SyncCategoriesSection } from './components/SyncCategoriesSection';
import { SyncPassphraseSection } from './components/SyncPassphraseSection';

const LocalServicesPage = () => {
  const _ = useTranslation();
  const router = useRouter();
  const { appService } = useEnv();
  const settings = useSettingsStore((s) => s.settings);
  const { safeAreaInsets, isRoundedWindow } = useThemeStore();

  useTheme({ systemUIVisible: false });

  const cloudProvider = getCloudSyncProvider(settings);
  const syncProviderLabel =
    cloudProvider === 'readest'
      ? _('No library sync provider selected')
      : cloudProviderDisplayName(cloudProvider);
  const kosyncLabel = settings?.kosync?.enabled
    ? settings.kosync.serverUrl || _('Configured')
    : _('Disabled');

  return (
    <div
      className={clsx(
        'bg-base-100 full-height inset-0 select-none overflow-hidden',
        appService?.hasRoundedWindow && isRoundedWindow && 'window-border rounded-window',
      )}
    >
      <div
        className='flex h-full w-full flex-col items-center overflow-y-auto'
        style={{
          paddingTop: `${safeAreaInsets?.top || 0}px`,
        }}
      >
        <ProfileHeader onGoBack={() => navigateToLibrary(router)} />
        <div className='w-full min-w-60 max-w-4xl py-10'>
          <div className='sm:bg-base-200 overflow-hidden rounded-lg sm:p-6 sm:shadow-md'>
            <div className='flex flex-col gap-y-8 px-6'>
              <div className='flex flex-col gap-3'>
                <h1 className='text-2xl font-semibold'>{_('Services & Sync')}</h1>
                <p className='text-base-content/70 text-sm leading-relaxed'>
                  {_(
                    'This local-first build uses user-controlled services instead of Readest accounts, subscriptions, or official cloud defaults.',
                  )}
                </p>
              </div>

              <section className='border-base-300 grid gap-4 rounded-lg border p-4 sm:grid-cols-2'>
                <div className='flex flex-col gap-1'>
                  <span className='text-base-content/60 text-xs font-medium uppercase tracking-wide'>
                    {_('Library Sync')}
                  </span>
                  <span className='text-base-content text-sm font-medium'>{syncProviderLabel}</span>
                  <p className='text-base-content/60 text-xs'>
                    {_('Configure WebDAV, Google Drive, or S3 from Settings > Integrations.')}
                  </p>
                </div>
                <div className='flex flex-col gap-1'>
                  <span className='text-base-content/60 text-xs font-medium uppercase tracking-wide'>
                    {_('KOReader Sync')}
                  </span>
                  <span className='text-base-content text-sm font-medium'>{kosyncLabel}</span>
                  <p className='text-base-content/60 text-xs'>
                    {_('Reading-state sync remains optional and should point to your own service.')}
                  </p>
                </div>
              </section>

              <section className='border-base-300 rounded-lg border p-4'>
                <h2 className='mb-2 text-lg font-semibold'>{_('Setup Notes')}</h2>
                <div className='text-base-content/70 flex flex-col gap-2 text-sm leading-relaxed'>
                  <p>
                    {_(
                      'Use the Integrations settings panel to connect WebDAV, S3-compatible storage, Google Drive, KOReader sync, OPDS catalogs, and other external services.',
                    )}
                  </p>
                  <p>
                    {_(
                      'Pick one library sync provider at a time so books, progress, and annotations do not race between multiple backends.',
                    )}
                  </p>
                </div>
              </section>

              <SyncCategoriesSection />
              <SyncPassphraseSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalServicesPage;
