import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { MdChevronRight } from 'react-icons/md';
import {
  RiBookOpenLine,
  RiRssLine,
  RiBookReadLine,
  RiBook3Line,
  RiCloudLine,
  RiDatabase2Line,
  RiGoogleLine,
  RiRobot2Line,
} from 'react-icons/ri';
import { useEnv } from '@/context/EnvContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useKeyDownActions } from '@/hooks/useKeyDownActions';
import { useSettingsStore } from '@/store/settingsStore';
import { useCustomOPDSStore } from '@/store/customOPDSStore';
import { useFileSyncStore } from '@/store/fileSyncStore';
import { CatalogManager } from '@/app/opds/components/CatalogManager';
import { getCatalogUiDescription, getCatalogUiLabel } from '@/app/opds/utils/catalogUi';
import { isWebAppPlatform } from '@/services/environment';
import { getGoogleWebClientId } from '@/services/sync/providers/gdrive/buildGoogleDriveProvider';
import KOSyncForm from './integrations/KOSyncForm';
import ReadwiseForm from './integrations/ReadwiseForm';
import HardcoverForm from './integrations/HardcoverForm';
import WebDAVForm from './integrations/WebDAVForm';
import GoogleDriveForm from './integrations/GoogleDriveForm';
import S3Form from './integrations/S3Form';
import LiteLLMForm from './integrations/LiteLLMForm';
import { persistActiveCloudProvider } from './integrations/cloudSync';
import { getThirdPartyRowStatus } from './integrations/cloudSyncStatus';
import {
  getCloudSyncProvider,
  resolveCloudSyncGate,
  type CloudSyncProviderKind,
} from '@/services/sync/cloudSyncProvider';
import type { FileSyncBackendKind } from '@/services/sync/file/providerRegistry';
import SubPageHeader from './SubPageHeader';
import { SectionTitle, SettingLabel, Tips } from './primitives';

type SubPage =
  | 'kosync'
  | 'webdav'
  | 'gdrive'
  | 's3'
  | 'readwise'
  | 'hardcover'
  | 'opds'
  | 'litellm'
  | null;

const IntegrationsPanel: React.FC = () => {
  const _ = useTranslation();
  const { envConfig, appService } = useEnv();
  const { settings, requestedSubPage, setRequestedSubPage } = useSettingsStore();
  const opdsCatalogs = useCustomOPDSStore((s) => s.catalogs);
  const opdsCount = opdsCatalogs.filter((c) => !c.deletedAt).length;
  const isWebDAVSyncing = useFileSyncStore((s) => s.byKind.webdav?.isSyncing ?? false);
  const isGDriveSyncing = useFileSyncStore((s) => s.byKind.gdrive?.isSyncing ?? false);
  const isS3Syncing = useFileSyncStore((s) => s.byKind.s3?.isSyncing ?? false);
  const webdavLastError = useFileSyncStore((s) => s.lastErrorByKind.webdav);
  const gdriveLastError = useFileSyncStore((s) => s.lastErrorByKind.gdrive);
  const s3LastError = useFileSyncStore((s) => s.lastErrorByKind.s3);

  const [subPage, setSubPage] = useState<SubPage>(null);

  useKeyDownActions({
    enabled: subPage !== null,
    onCancel: () => setSubPage(null),
  });

  useEffect(() => {
    if (!requestedSubPage) return;
    if (
      requestedSubPage === 'kosync' ||
      requestedSubPage === 'webdav' ||
      requestedSubPage === 'gdrive' ||
      requestedSubPage === 's3' ||
      requestedSubPage === 'readwise' ||
      requestedSubPage === 'hardcover' ||
      requestedSubPage === 'opds' ||
      requestedSubPage === 'litellm'
    ) {
      setSubPage(requestedSubPage);
    } else if (requestedSubPage === 'cloudsync') {
      setSubPage('webdav');
    }
    setRequestedSubPage(null);
  }, [requestedSubPage, setRequestedSubPage]);

  if (subPage === 'kosync') {
    return (
      <div className='my-4 w-full'>
        <KOSyncForm onBack={() => setSubPage(null)} />
      </div>
    );
  }

  if (subPage === 'litellm') {
    return (
      <div className='my-4 w-full'>
        <LiteLLMForm onBack={() => setSubPage(null)} />
      </div>
    );
  }

  if (subPage === 'webdav') {
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={_('WebDAV')}
          description={_(
            'Sync your library, reading progress, and highlights with a WebDAV server.',
          )}
          onBack={() => setSubPage(null)}
        />
        <WebDAVForm />
        {settings.webdav?.enabled && (
          <div className='mt-5'>
            <Tips>
              <li>
                {_(
                  'While {{provider}} is selected, books, progress, and annotations sync only to your server.',
                  { provider: _('WebDAV') },
                )}
              </li>
              <li>
                {_(
                  'Choose only one library sync provider at a time to avoid conflicting writes across devices.',
                )}
              </li>
            </Tips>
          </div>
        )}
      </div>
    );
  }

  if (subPage === 'gdrive') {
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={_('Google Drive')}
          description={_(
            'Sync your library, reading progress, and highlights with your Google Drive.',
          )}
          onBack={() => setSubPage(null)}
        />
        <GoogleDriveForm />
        {settings.googleDrive?.enabled && (
          <div className='mt-5'>
            <Tips>
              <li>
                {_(
                  'While {{provider}} is selected, books, progress, and annotations sync only to your Drive.',
                  { provider: _('Google Drive') },
                )}
              </li>
              <li>
                {_(
                  'Choose only one library sync provider at a time to avoid conflicting writes across devices.',
                )}
              </li>
            </Tips>
          </div>
        )}
      </div>
    );
  }

  if (subPage === 's3') {
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={_('S3-Compatible Storage')}
          description={_(
            'Sync your library, reading progress, and highlights with an S3-compatible bucket such as Cloudflare R2, AWS S3, or MinIO.',
          )}
          onBack={() => setSubPage(null)}
        />
        <S3Form />
        <div className='mt-5'>
          <Tips>
            <li>
              {_(
                'While {{provider}} is selected, books, progress, and annotations sync only to your bucket.',
                { provider: _('S3-Compatible Storage') },
              )}
            </li>
            <li>
              {_(
                'Choose only one library sync provider at a time to avoid conflicting writes across devices.',
              )}
            </li>
            <li>
              {_(
                'Make sure the bucket exists and the credentials have read/write access before connecting.',
              )}
            </li>
            {isWebAppPlatform() && (
              <li>
                {_("In the browser, the bucket must allow this site's origin in its CORS policy.")}
              </li>
            )}
          </Tips>
        </div>
      </div>
    );
  }

  if (subPage === 'readwise') {
    return (
      <div className='my-4 w-full'>
        <ReadwiseForm onBack={() => setSubPage(null)} />
      </div>
    );
  }

  if (subPage === 'hardcover') {
    return (
      <div className='my-4 w-full'>
        <HardcoverForm onBack={() => setSubPage(null)} />
      </div>
    );
  }

  if (subPage === 'opds') {
    return (
      <div className='my-4 w-full'>
        <SubPageHeader
          parentLabel={_('Integrations')}
          currentLabel={getCatalogUiLabel(_, appService?.isOnlineCatalogsAccessible)}
          description={getCatalogUiDescription(_, appService?.isOnlineCatalogsAccessible)}
          onBack={() => setSubPage(null)}
        />
        <CatalogManager inSubPage />
      </div>
    );
  }

  const koSyncStatus = settings.kosync?.enabled
    ? settings.kosync.username
      ? _('Connected as {{user}}', { user: settings.kosync.username })
      : _('Connected')
    : _('Not connected');

  const readwiseStatus = settings.readwise?.enabled ? _('Connected') : _('Not connected');
  const hardcoverStatus = settings.hardcover?.enabled ? _('Connected') : _('Not connected');
  const litellmStatus =
    settings.litellm?.enabled && settings.litellm?.baseUrl ? _('Configured') : _('Not configured');

  const cloudProvider = getCloudSyncProvider(settings);
  const activeCloudKind: FileSyncBackendKind | null =
    cloudProvider === 'readest' ? null : cloudProvider;
  const cloudGate = resolveCloudSyncGate(settings);
  const webdavConfigured = !!(settings.webdav?.serverUrl && settings.webdav?.username);
  const gdriveConfigured = !!settings.googleDrive?.accountLabel;
  const s3Configured = !!(
    settings.s3?.endpoint &&
    settings.s3?.bucket &&
    settings.s3?.accessKeyId &&
    settings.s3?.secretAccessKey
  );

  const webdavStatus = getThirdPartyRowStatus(_, {
    enabled: !!settings.webdav?.enabled,
    configured: webdavConfigured,
    syncing: isWebDAVSyncing,
    paused: cloudGate.paused && cloudProvider === 'webdav',
    lastError: webdavLastError,
    syncBooks: settings.webdav?.syncBooks ?? false,
  });
  const gdriveStatus = getThirdPartyRowStatus(_, {
    enabled: !!settings.googleDrive?.enabled,
    configured: gdriveConfigured,
    syncing: isGDriveSyncing,
    paused: cloudGate.paused && cloudProvider === 'gdrive',
    lastError: gdriveLastError,
    syncBooks: settings.googleDrive?.syncBooks ?? false,
  });
  const s3Status = getThirdPartyRowStatus(_, {
    enabled: !!settings.s3?.enabled,
    configured: s3Configured,
    syncing: isS3Syncing,
    paused: cloudGate.paused && cloudProvider === 's3',
    lastError: s3LastError,
    syncBooks: settings.s3?.syncBooks ?? false,
  });

  const activateCloudProvider = async (kind: CloudSyncProviderKind) => {
    await persistActiveCloudProvider(envConfig, kind);
  };

  const opdsStatus =
    opdsCount > 0 ? _('{{count}} catalog', { count: opdsCount }) : _('No catalogs');

  return (
    <div className='my-4 w-full space-y-6'>
      <div className='w-full px-4'>
        <h2 className='mb-1.5 text-lg font-semibold tracking-tight'>{_('Integrations')}</h2>
        <p className='text-base-content/70 text-sm leading-relaxed'>
          {_(
            'Connect Bookhearth to local or user-controlled services for sync, highlights, and catalogs.',
          )}
        </p>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.sync'>
        <SectionTitle className='mb-2'>{_('Reading Sync')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div className='divide-base-200 divide-y'>
            <IntegrationRow
              icon={RiBookOpenLine}
              title={_('KOReader')}
              status={koSyncStatus}
              onClick={() => setSubPage('kosync')}
            />
            <IntegrationRow
              icon={RiBookReadLine}
              title={_('Readwise')}
              status={readwiseStatus}
              onClick={() => setSubPage('readwise')}
            />
            <IntegrationRow
              icon={RiBook3Line}
              title={_('Hardcover')}
              status={hardcoverStatus}
              onClick={() => setSubPage('hardcover')}
            />
          </div>
        </div>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.cloudSync'>
        <SectionTitle className='mb-2'>{_('Library Sync')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div
            className='divide-base-200 divide-y'
            role='radiogroup'
            aria-label={_('Cloud sync provider')}
          >
            {(appService?.isDesktopApp ||
              appService?.isAndroidApp ||
              appService?.isIOSApp ||
              (isWebAppPlatform() && !!getGoogleWebClientId())) && (
              <CloudProviderRow
                icon={RiGoogleLine}
                title={_('Google Drive')}
                status={gdriveStatus}
                isActive={activeCloudKind === 'gdrive'}
                canActivate={gdriveConfigured}
                onActivate={() => activateCloudProvider('gdrive')}
                onOpen={() => setSubPage('gdrive')}
                activateLabel={_('Use Google Drive')}
              />
            )}
            <CloudProviderRow
              icon={RiCloudLine}
              title={_('WebDAV')}
              status={webdavStatus}
              isActive={activeCloudKind === 'webdav'}
              canActivate={webdavConfigured}
              onActivate={() => activateCloudProvider('webdav')}
              onOpen={() => setSubPage('webdav')}
              activateLabel={_('Use WebDAV')}
            />
            <CloudProviderRow
              icon={RiDatabase2Line}
              title={_('S3 Storage')}
              status={s3Status}
              isActive={activeCloudKind === 's3'}
              canActivate={s3Configured}
              onActivate={() => activateCloudProvider('s3')}
              onOpen={() => setSubPage('s3')}
              activateLabel={_('Use S3')}
            />
          </div>
        </div>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.ai'>
        <SectionTitle className='mb-2'>{_('AI Services')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div className='divide-base-200 divide-y'>
            <IntegrationRow
              icon={RiRobot2Line}
              title={_('AI (LiteLLM)')}
              status={litellmStatus}
              onClick={() => setSubPage('litellm')}
            />
          </div>
        </div>
      </div>

      <div className='w-full' data-setting-id='settings.integrations.catalogs'>
        <SectionTitle className='mb-2'>{_('Content Sources')}</SectionTitle>
        <div className='card eink-bordered border-base-200 bg-base-100 overflow-hidden border'>
          <div className='divide-base-200 divide-y'>
            <IntegrationRow
              icon={RiRssLine}
              title={getCatalogUiLabel(_, appService?.isOnlineCatalogsAccessible)}
              status={opdsStatus}
              onClick={() => setSubPage('opds')}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

interface IntegrationRowProps {
  icon: React.ElementType;
  title: string;
  status: string;
  onClick: () => void;
}

const IntegrationRow: React.FC<IntegrationRowProps> = ({ icon: Icon, title, status, onClick }) => {
  return (
    <button
      type='button'
      onClick={onClick}
      className={clsx(
        'group flex w-full items-center gap-3 px-4 py-3 text-left',
        'transition-colors duration-150',
        'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
      )}
    >
      <span
        className={clsx(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
          'bg-base-200 text-base-content/70',
          'transition-colors duration-150',
          'group-hover:bg-base-300/70',
        )}
      >
        <Icon className='h-5 w-5' />
      </span>
      <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
        <SettingLabel>{title}</SettingLabel>
        <span className='text-base-content/65 truncate text-[0.85em]'>{status}</span>
      </div>
      <MdChevronRight className='text-base-content/50 h-5 w-5 flex-shrink-0' />
    </button>
  );
};

interface CloudProviderRowProps {
  icon: React.ElementType;
  title: string;
  status: string;
  isActive: boolean;
  canActivate: boolean;
  onActivate: () => void;
  onOpen: () => void;
  activateLabel: string;
}

const CloudProviderRow: React.FC<CloudProviderRowProps> = ({
  icon: Icon,
  title,
  status,
  isActive,
  canActivate,
  onActivate,
  onOpen,
  activateLabel,
}) => {
  return (
    <div className='group flex w-full items-center gap-3 px-4 py-3'>
      <button
        type='button'
        onClick={onOpen}
        className={clsx(
          'flex min-w-0 flex-1 items-center gap-3 text-left',
          'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset',
        )}
      >
        <span
          className={clsx(
            'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
            'bg-base-200 text-base-content/70',
            'transition-colors duration-150',
            'group-hover:bg-base-300/70',
          )}
        >
          <Icon className='h-5 w-5' />
        </span>
        <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
          <SettingLabel>{title}</SettingLabel>
          <span className='text-base-content/65 truncate text-[0.85em]'>{status}</span>
        </div>
      </button>
      <input
        type='radio'
        name='cloud-sync-active'
        className='radio radio-sm flex-shrink-0'
        checked={isActive}
        disabled={!canActivate}
        onChange={onActivate}
        aria-label={activateLabel}
        title={activateLabel}
      />
      <button
        type='button'
        onClick={onOpen}
        aria-label={title}
        className={clsx(
          'text-base-content/50 hover:text-base-content/80 flex-shrink-0 rounded',
          'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
        )}
      >
        <MdChevronRight className='h-5 w-5' />
      </button>
    </div>
  );
};

export default IntegrationsPanel;
