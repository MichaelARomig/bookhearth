import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiGear } from 'react-icons/pi';
import { PiSun, PiMoon } from 'react-icons/pi';
import { TbSunMoon } from 'react-icons/tb';
import { MdCloudSync, MdSync, MdSyncProblem, MdOutlineSensors } from 'react-icons/md';

import { isTauriAppPlatform } from '@/services/environment';
import { setBackupDialogVisible } from '@/app/library/components/BackupWindow';
import { setCacheManagerDialogVisible } from '@/app/library/components/CacheManagerWindow';
import { useEnv } from '@/context/EnvContext';
import { useThemeStore } from '@/store/themeStore';
import { useLibraryStore } from '@/store/libraryStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTranslation } from '@/hooks/useTranslation';
import { useCloudSyncStatus } from '@/hooks/useCloudSyncStatus';
import { useTransferQueue } from '@/hooks/useTransferQueue';
import { tauriHandleSetAlwaysOnTop, tauriHandleToggleFullScreen } from '@/utils/window';
import { setAboutDialogVisible } from '@/components/AboutWindow';
import { setMigrateDataDirDialogVisible } from '@/app/library/components/MigrateDataWindow';
import { requestStoragePermission } from '@/utils/permission';
import { saveSysSettings } from '@/helpers/settings';
import {
  getBiometricStatus,
  getBiometryLabelKey,
  isBiometricSupported,
} from '@/services/biometric';
import { selectDirectory } from '@/utils/bridge';
import { nextThemeMode } from '@/utils/ambientLight';
import MenuItem from '@/components/MenuItem';
import Menu from '@/components/Menu';
import { type AppLockDialogMode, useAppLockStore } from '@/store/appLockStore';

interface SettingsMenuProps {
  onPullLibrary: (fullRefresh?: boolean, verbose?: boolean) => void;
  setIsDropdownOpen?: (isOpen: boolean) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onPullLibrary, setIsDropdownOpen }) => {
  const _ = useTranslation();
  const router = useRouter();
  const { envConfig, appService } = useEnv();
  const { themeMode, setThemeMode } = useThemeStore();
  const { settings, setSettingsDialogOpen } = useSettingsStore();
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(settings.alwaysOnTop);
  const [isAlwaysShowStatusBar, setIsAlwaysShowStatusBar] = useState(settings.alwaysShowStatusBar);
  const [isOpenLastBooks, setIsOpenLastBooks] = useState(settings.openLastBooks);
  const [isAutoImportBooksOnOpen, setIsAutoImportBooksOnOpen] = useState(
    settings.autoImportBooksOnOpen,
  );
  const [savedBookCoverForLockScreen, setSavedBookCoverForLockScreen] = useState(
    settings.savedBookCoverForLockScreen || '',
  );

  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [refreshMetadataProgress, setRefreshMetadataProgress] = useState('');
  const { openDialog: openAppLockDialogInStore } = useAppLockStore();
  const isPinEnabled = !!settings.pinCodeEnabled;
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometryLabelKey, setBiometryLabelKey] = useState('');
  const showBiometricToggle = !!appService?.isMobileApp && isPinEnabled && biometricAvailable;

  useEffect(() => {
    if (!isBiometricSupported(appService) || !isPinEnabled) return;
    let cancelled = false;
    void getBiometricStatus().then(({ available, biometryType }) => {
      if (cancelled) return;
      setBiometricAvailable(available);
      setBiometryLabelKey(getBiometryLabelKey(biometryType));
    });
    return () => {
      cancelled = true;
    };
  }, [appService, isPinEnabled]);

  const toggleBiometricUnlock = () => {
    void saveSysSettings(envConfig, 'biometricUnlockEnabled', !settings.biometricUnlockEnabled);
  };

  const openAppLockDialog = (mode: AppLockDialogMode) => {
    openAppLockDialogInStore(mode);
    setIsDropdownOpen?.(false);
  };
  const { setLibrary } = useLibraryStore();
  const { stats, hasActiveTransfers, setIsTransferQueueOpen } = useTransferQueue();

  const openTransferQueue = () => {
    setIsTransferQueueOpen(true);
    setIsDropdownOpen?.(false);
  };

  const showAboutReadest = () => {
    setAboutDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const handleManageSync = () => {
    router.push('/user?section=sync');
    setIsDropdownOpen?.(false);
  };

  const cycleThemeMode = () => {
    setThemeMode(nextThemeMode(themeMode, !!appService?.hasAmbientLightSensor));
  };

  const handleFullScreen = () => {
    tauriHandleToggleFullScreen();
    setIsDropdownOpen?.(false);
  };

  const toggleOpenInNewWindow = () => {
    saveSysSettings(envConfig, 'openBookInNewWindow', !settings.openBookInNewWindow);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysOnTop = () => {
    const newValue = !settings.alwaysOnTop;
    saveSysSettings(envConfig, 'alwaysOnTop', newValue);
    setIsAlwaysOnTop(newValue);
    tauriHandleSetAlwaysOnTop(newValue);
    setIsDropdownOpen?.(false);
  };

  const toggleAlwaysShowStatusBar = () => {
    const newValue = !settings.alwaysShowStatusBar;
    saveSysSettings(envConfig, 'alwaysShowStatusBar', newValue);
    setIsAlwaysShowStatusBar(newValue);
  };

  const toggleAutoImportBooksOnOpen = () => {
    const newValue = !settings.autoImportBooksOnOpen;
    saveSysSettings(envConfig, 'autoImportBooksOnOpen', newValue);
    setIsAutoImportBooksOnOpen(newValue);
  };

  const toggleOpenLastBooks = () => {
    const newValue = !settings.openLastBooks;
    saveSysSettings(envConfig, 'openLastBooks', newValue);
    setIsOpenLastBooks(newValue);
  };

  const handleSetRootDir = () => {
    setMigrateDataDirDialogVisible(true);
    setIsDropdownOpen?.(false);
  };

  const handleBackupRestore = () => {
    setIsDropdownOpen?.(false);
    setBackupDialogVisible(true);
  };

  const handleManageCache = () => {
    setIsDropdownOpen?.(false);
    setCacheManagerDialogVisible(true);
  };

  const handleRefreshMetadata = async () => {
    if (!appService || isRefreshingMetadata) return;
    setIsRefreshingMetadata(true);
    setRefreshMetadataProgress(_('Loading library...'));
    try {
      const books = await appService.loadLibraryBooks();
      const activeBooks = books.filter((b) => !b.deletedAt);
      let refreshed = 0;
      for (let i = 0; i < activeBooks.length; i++) {
        setRefreshMetadataProgress(`${i + 1} / ${activeBooks.length}`);
        try {
          if (await appService.refreshBookMetadata(activeBooks[i]!)) {
            refreshed++;
          }
        } catch {
          // Skip books whose files can't be opened
        }
      }
      setLibrary(books);
      await appService.saveLibraryBooks(books);
      setRefreshMetadataProgress(_('{{count}} books refreshed', { count: refreshed }));
      onPullLibrary(true);
      setTimeout(() => {
        setIsRefreshingMetadata(false);
        setRefreshMetadataProgress('');
      }, 2000);
    } catch (error) {
      console.error('Failed to refresh metadata:', error);
      setRefreshMetadataProgress(_('Failed to refresh metadata'));
      setTimeout(() => {
        setIsRefreshingMetadata(false);
        setRefreshMetadataProgress('');
      }, 2000);
    }
  };

  const openSettingsDialog = () => {
    setIsDropdownOpen?.(false);
    setSettingsDialogOpen(true);
  };

  const handleSetSavedBookCoverForLockScreen = async () => {
    if (!(await requestStoragePermission())) return;

    const newValue = settings.savedBookCoverForLockScreen ? '' : 'default';
    if (newValue) {
      const response = await selectDirectory();
      if (response.path) {
        saveSysSettings(envConfig, 'savedBookCoverForLockScreenPath', response.path);
      }
    }
    saveSysSettings(envConfig, 'savedBookCoverForLockScreen', newValue);
    setSavedBookCoverForLockScreen(newValue);
  };

  const handleSyncLibrary = () => {
    onPullLibrary(true, true);
    setIsDropdownOpen?.(false);
  };

  const themeModeLabel =
    themeMode === 'dark'
      ? _('Dark Mode')
      : themeMode === 'light'
        ? _('Light Mode')
        : themeMode === 'ambient'
          ? _('Ambient Mode')
          : _('Auto Mode');

  const savedBookCoverPath = settings.savedBookCoverForLockScreenPath;
  const coverDir = savedBookCoverPath ? savedBookCoverPath.split('/').pop() : 'Images';
  const savedBookCoverDescription = `💾 ${coverDir}/last-book-cover.png`;

  // The sync row reports the health of whatever the user selected. Native
  // cursors freeze while Readest Cloud is off (the book/progress/note channels
  // are gated), so the file engine's timestamps have to stand in. Shared with
  // the reader's View menu (#5910) so both surfaces answer "is my sync
  // healthy?" identically. The hook drops backends that cannot run right now
  // (a web Google Drive whose token expired is still `enabled` but silently
  // skipped, so counting it would inflate the count and lend its stale
  // lastSyncedAt to "Synced X ago").
  const syncStatus = useCloudSyncStatus(
    Math.max(
      settings.lastSyncedAtBooks || 0,
      settings.lastSyncedAtConfigs || 0,
      settings.lastSyncedAtNotes || 0,
    ),
  );
  const fileBackendCount = syncStatus.providers.filter((p) => p.kind !== 'readest').length;
  // Hoisted out of the `_()` call below: i18next-scanner parses the options
  // object with esprima, which chokes on TypeScript's `!` non-null assertion.
  const firstProviderName = syncStatus.providers[0]?.name ?? '';

  return (
    <Menu
      className={clsx(
        'settings-menu dropdown-content no-triangle',
        'z-20 mt-2 max-w-[90vw] shadow-2xl',
      )}
      onCancel={() => setIsDropdownOpen?.(false)}
    >
      <MenuItem
        label={_('Cloud File Transfers')}
        Icon={MdCloudSync}
        description={
          hasActiveTransfers
            ? _('{{activeCount}} active, {{pendingCount}} pending', {
                activeCount: stats.active,
                pendingCount: stats.pending,
              })
            : stats.failed > 0
              ? _('{{failedCount}} failed', { failedCount: stats.failed })
              : ''
        }
        onClick={openTransferQueue}
      />
      <MenuItem
        // This local-first build never signs in, so `syncStatus.label` /
        // `needsSignIn` (which assume a Readest Cloud account exists) are
        // only trusted once a real file backend is selected; with none
        // configured we show our own "nothing selected yet" copy instead of
        // upstream's "Sign in to Sync".
        label={fileBackendCount === 0 ? _('No library sync provider selected') : syncStatus.label}
        Icon={fileBackendCount > 0 && syncStatus.failed ? MdSyncProblem : MdSync}
        iconClassName={fileBackendCount > 0 && syncStatus.syncing ? 'animate-reverse-spin' : ''}
        onClick={fileBackendCount === 0 ? handleManageSync : handleSyncLibrary}
        description={
          fileBackendCount === 0
            ? _('Configure WebDAV, Google Drive, or S3 in Services & Sync')
            : syncStatus.providers.length > 1
              ? // Several providers named in full would overrun the row; show a
                // count. `count` (not a plain var) so i18next applies each
                // locale's plural rule — the common case is exactly 2, where
                // Slavic/Arabic paucal forms differ from the generic plural.
                _('Library sync via {{count}} providers', {
                  count: syncStatus.providers.length,
                })
              : _('Library sync via {{provider}}', {
                  provider: firstProviderName,
                })
        }
      />
      <MenuItem
        label={_('Services & Sync')}
        Icon={PiGear}
        description={_('Manage sync categories and local service setup')}
        onClick={handleManageSync}
      />

      {isTauriAppPlatform() && (
        <MenuItem
          label={_('Auto Import on File Open')}
          toggled={isAutoImportBooksOnOpen}
          onClick={toggleAutoImportBooksOnOpen}
        />
      )}
      {isTauriAppPlatform() && (
        <MenuItem
          label={_('Open Last Book on Start')}
          toggled={isOpenLastBooks}
          onClick={toggleOpenLastBooks}
        />
      )}
      <hr aria-hidden='true' className='border-base-200 my-1' />
      {appService?.hasWindow && (
        <MenuItem
          label={_('Open Book in New Window')}
          toggled={settings.openBookInNewWindow}
          onClick={toggleOpenInNewWindow}
        />
      )}
      {appService?.hasWindow && <MenuItem label={_('Fullscreen')} onClick={handleFullScreen} />}
      {appService?.hasWindow && (
        <MenuItem label={_('Always on Top')} toggled={isAlwaysOnTop} onClick={toggleAlwaysOnTop} />
      )}
      {appService?.isMobileApp && (
        <MenuItem
          label={_('Always Show Status Bar')}
          toggled={isAlwaysShowStatusBar}
          onClick={toggleAlwaysShowStatusBar}
        />
      )}
      <MenuItem
        label={themeModeLabel}
        Icon={
          themeMode === 'dark'
            ? PiMoon
            : themeMode === 'light'
              ? PiSun
              : themeMode === 'ambient'
                ? MdOutlineSensors
                : TbSunMoon
        }
        onClick={cycleThemeMode}
      />
      <MenuItem label={_('Settings')} Icon={PiGear} onClick={openSettingsDialog} />
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('Advanced Settings')}>
        <ul className='ms-0 flex flex-col ps-0 before:hidden'>
          <MenuItem label={_('Backup & Restore')} onClick={handleBackupRestore} />
          {appService?.canCustomizeRootDir && (
            <MenuItem label={_('Change Data Location')} onClick={handleSetRootDir} />
          )}
          <MenuItem
            label={_('Refresh Metadata')}
            description={refreshMetadataProgress}
            onClick={handleRefreshMetadata}
            disabled={isRefreshingMetadata}
          />
          {appService?.isMobileApp && (
            <MenuItem label={_('Manage Cache')} onClick={handleManageCache} />
          )}
          {!isPinEnabled && (
            <MenuItem
              label={_('Set PIN…')}
              tooltip={
                appService?.isMobileApp
                  ? _('Require a PIN (and biometrics, if available) to open Bookhearth')
                  : _('Require a 4-digit PIN to open Bookhearth')
              }
              onClick={() => openAppLockDialog('set')}
            />
          )}
          {isPinEnabled && (
            <MenuItem label={_('Change PIN…')} onClick={() => openAppLockDialog('change')} />
          )}
          {isPinEnabled && (
            <MenuItem label={_('Disable PIN…')} onClick={() => openAppLockDialog('disable')} />
          )}
          {showBiometricToggle && (
            <MenuItem
              label={_('Unlock with {{biometry}}', { biometry: _(biometryLabelKey) })}
              toggled={!!settings.biometricUnlockEnabled}
              onClick={toggleBiometricUnlock}
            />
          )}
          {appService?.isAndroidApp && (
            <MenuItem
              label={_('Save Book Cover')}
              tooltip={_('Auto-save last book cover')}
              description={savedBookCoverForLockScreen ? savedBookCoverDescription : ''}
              toggled={!!savedBookCoverForLockScreen}
              onClick={handleSetSavedBookCoverForLockScreen}
            />
          )}
        </ul>
      </MenuItem>
      <hr aria-hidden='true' className='border-base-200 my-1' />
      <MenuItem label={_('About Bookhearth')} onClick={showAboutReadest} />
    </Menu>
  );
};

export default SettingsMenu;
