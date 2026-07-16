import clsx from 'clsx';
import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { MdVisibility, MdVisibilityOff, MdAdd, MdDeleteOutline } from 'react-icons/md';
import { useEnv } from '@/context/EnvContext';
import { useTranslation, type TranslationFunc } from '@/hooks/useTranslation';
import { useSettingsStore } from '@/store/settingsStore';
import { eventDispatcher } from '@/utils/event';
import {
  checkConnection,
  normalizeRootPath,
  WebDAVConnectResult,
} from '@/services/sync/providers/webdav/client';
import { buildWebDAVConnectSettings } from '@/services/sync/providers/webdav/connectSettings';
import {
  listProfiles,
  getActiveProfileId,
  addProfile,
  setActiveProfile,
  renameProfile,
  removeProfile,
  applyConnectionToActive,
} from '@/services/sync/providers/webdav/profiles';
import { DEFAULT_WEBDAV_SETTINGS } from '@/services/constants';
import type { WebDAVSettings } from '@/types/settings';
import { SectionTitle, SettingsSwitchRow } from '../primitives';
import FileSyncForm from './FileSyncForm';
import WebDAVBrowsePane from './WebDAVBrowsePane';
import { persistActiveCloudProvider } from './cloudSync';

/**
 * Translate a connection-probe failure into a user-facing string. Each branch is
 * a literal `_('...')` call so the i18next-scanner picks the keys up.
 */
const formatConnectError = (_: TranslationFunc, result: WebDAVConnectResult): string => {
  switch (result.code) {
    case 'SERVER_URL_REQUIRED':
      return _('Server URL is required');
    case 'AUTH_FAILED':
      return _('Authentication failed');
    case 'ROOT_NOT_FOUND':
      return _('Root directory not found');
    case 'UNEXPECTED_STATUS':
      return _('Unexpected server response (status {{status}})', { status: result.status ?? 0 });
    case 'NETWORK':
    default:
      return _('Network error');
  }
};

/**
 * WebDAV provider panel, embedded in the Integrations WebDAV sub-page (which
 * owns the header). Two states:
 *
 * - **Active** (`webdav.enabled`): the shared {@link FileSyncForm} sync controls
 *   + the {@link WebDAVBrowsePane} + a Disconnect button.
 * - **Inactive**: the URL/credentials form (pre-filled from saved settings, so a
 *   previously-configured server reconnects in one click). Connecting makes
 *   WebDAV the active provider and turns Google Drive off (cloud providers are
 *   mutually exclusive).
 */
const WebDAVForm: React.FC = () => {
  const _ = useTranslation();
  const { settings, setSettings, saveSettings } = useSettingsStore();
  const { envConfig } = useEnv();

  const stored = settings.webdav ?? DEFAULT_WEBDAV_SETTINGS;
  const isActive = !!stored?.enabled;

  const [url, setUrl] = useState(stored?.serverUrl || '');
  const [username, setUsername] = useState(stored?.username || '');
  const [password, setPassword] = useState(stored?.password || '');
  const [rootPath, setRootPath] = useState(stored?.rootPath || '/');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Multiple named servers. `profiles`/`activeId` come from the persisted
  // settings (with legacy-singleton migration handled by listProfiles); the
  // connection inputs above are the working copy of the active profile.
  const profiles = listProfiles(stored);
  const activeId = getActiveProfileId(stored);
  const [allowInsecureTls, setAllowInsecureTls] = useState(stored?.allowInsecureTls !== false);
  const [warnOnPlainHttp, setWarnOnPlainHttp] = useState(!!stored?.warnOnPlainHttp);
  const [profileName, setProfileName] = useState(
    profiles.find((p) => p.id === activeId)?.name ?? '',
  );
  const isPlainHttp = url.trim().toLowerCase().startsWith('http://');

  const persistWebdavBlock = async (webdav: WebDAVSettings) => {
    const latest = useSettingsStore.getState().settings;
    const next = { ...latest, webdav };
    setSettings(next);
    await saveSettings(envConfig, next);
  };

  const loadFields = (profileId: string, block: WebDAVSettings) => {
    const p = (block.profiles ?? []).find((x) => x.id === profileId);
    setUrl(p?.serverUrl ?? '');
    setUsername(p?.username ?? '');
    setPassword(p?.password ?? '');
    setRootPath(p?.rootPath || '/');
    setProfileName(p?.name ?? '');
  };

  // Save the current input edits into the active profile before any switch so
  // in-progress (un-connected) edits aren't lost.
  const captureCurrent = (): WebDAVSettings =>
    applyConnectionToActive(stored, { serverUrl: url, username, password, rootPath });

  const handleSwitchProfile = async (id: string) => {
    if (id === activeId) return;
    const next = setActiveProfile(captureCurrent(), id);
    await persistWebdavBlock(next);
    loadFields(id, next);
  };

  const handleAddProfile = async () => {
    const id = uuidv4();
    const name = `${_('Server')} ${profiles.length + 1}`;
    const next = addProfile(captureCurrent(), id, name);
    await persistWebdavBlock(next);
    loadFields(id, next);
  };

  const handleRenameActive = async (name: string) => {
    if (!activeId) return;
    await persistWebdavBlock(renameProfile(captureCurrent(), activeId, name));
  };

  const handleRemoveActive = async () => {
    if (!activeId) return;
    const next = removeProfile(captureCurrent(), activeId);
    await persistWebdavBlock(next);
    loadFields(getActiveProfileId(next), next);
  };

  const toggleTls = async () => {
    const value = !allowInsecureTls;
    setAllowInsecureTls(value);
    await persistWebdavBlock({ ...stored, allowInsecureTls: value });
  };

  const toggleWarnHttp = async () => {
    const value = !warnOnPlainHttp;
    setWarnOnPlainHttp(value);
    await persistWebdavBlock({ ...stored, warnOnPlainHttp: value });
  };

  const handleConnect = async () => {
    if (!url || !username) return;
    setIsConnecting(true);
    const normalizedRoot = normalizeRootPath(rootPath);
    const result = await checkConnection(
      { serverUrl: url, username, password, allowInsecureTls },
      normalizedRoot,
    );
    if (!result.success) {
      eventDispatcher.dispatch('toast', {
        type: 'error',
        message: `${_('Failed to connect')}: ${formatConnectError(_, result)}`,
      });
      setIsConnecting(false);
      return;
    }
    // Build the WebDAV connect settings (preserves deviceId / sub-toggles), then
    // make WebDAV the single active cloud provider (turns Google Drive off).
    // persistActiveCloudProvider owns activation, persistence, and the
    // cross-window provider broadcast.
    const connection = { serverUrl: url, username, password, rootPath: normalizedRoot };
    await persistActiveCloudProvider(envConfig, 'webdav', (s) => ({
      ...s,
      // buildWebDAVConnectSettings preserves deviceId / sub-toggles;
      // applyConnectionToActive mirrors the connection into the active profile.
      webdav: applyConnectionToActive(buildWebDAVConnectSettings(s.webdav, connection), connection),
    }));
    setIsConnecting(false);
    eventDispatcher.dispatch('toast', { type: 'info', message: _('Connected') });
  };

  const handleDisconnect = async () => {
    // Deactivate (keep the credentials so a later reconnect is one click).
    await persistActiveCloudProvider(envConfig, null);
    setShowPassword(false);
    eventDispatcher.dispatch('toast', { type: 'info', message: _('Disconnected') });
  };

  const persistWebdav = async (patch: Partial<typeof stored>) => {
    const latest = useSettingsStore.getState().settings;
    const next = { ...latest, webdav: { ...latest.webdav, ...patch } };
    setSettings(next);
    await saveSettings(envConfig, next);
  };

  if (isActive) {
    return (
      <div className='space-y-5'>
        <FileSyncForm kind='webdav' stored={stored} persist={persistWebdav} />

        <WebDAVBrowsePane settings={stored} onUpdateSettings={persistWebdav} />

        <div className='flex justify-end'>
          <button
            type='button'
            onClick={handleDisconnect}
            className={clsx(
              'eink-bordered',
              'h-10 rounded-lg px-4 text-sm font-medium',
              'text-error hover:bg-error/10',
              'transition-colors duration-150',
              'focus-visible:ring-error/40 focus-visible:outline-none focus-visible:ring-2',
            )}
          >
            {_('Disconnect')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className='space-y-4'
      onSubmit={(e) => {
        e.preventDefault();
        handleConnect();
      }}
    >
      <div className='space-y-1.5'>
        <div className='flex items-center justify-between'>
          <SectionTitle as='span' className='block'>
            {_('Saved Servers')}
          </SectionTitle>
          <button
            type='button'
            onClick={handleAddProfile}
            className='eink-bordered flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium'
          >
            <MdAdd className='h-4 w-4' />
            {_('Add server')}
          </button>
        </div>
        {profiles.length > 1 && (
          <select
            aria-label={_('Saved Servers')}
            className='select select-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
            value={activeId}
            onChange={(e) => handleSwitchProfile(e.target.value)}
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        {(profiles.length > 0 || !!activeId) && (
          <div className='flex items-center gap-2'>
            <input
              type='text'
              aria-label={_('Server name')}
              placeholder={_('Server name')}
              className='input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onBlur={() => handleRenameActive(profileName)}
            />
            {profiles.length > 1 && (
              <button
                type='button'
                onClick={handleRemoveActive}
                aria-label={_('Remove server')}
                title={_('Remove server')}
                className='eink-bordered text-error hover:bg-error/10 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md'
              >
                <MdDeleteOutline className='h-5 w-5' />
              </button>
            )}
          </div>
        )}
      </div>

      <div className='space-y-1.5'>
        <SectionTitle as='label' htmlFor='webdav-server-url' className='block'>
          {_('Server URL')}
        </SectionTitle>
        <input
          id='webdav-server-url'
          type='text'
          placeholder='https://dav.example.com'
          className='input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
          spellCheck='false'
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>

      <div className='space-y-1.5'>
        <SectionTitle as='label' htmlFor='webdav-username' className='block'>
          {_('Username')}
        </SectionTitle>
        <input
          id='webdav-username'
          type='text'
          placeholder={_('Your Username')}
          className='input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
          spellCheck='false'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete='username'
        />
      </div>

      <div className='space-y-1.5'>
        <SectionTitle as='label' htmlFor='webdav-password' className='block'>
          {_('Password')}
        </SectionTitle>
        <div className='relative'>
          <input
            id='webdav-password'
            type={showPassword ? 'text' : 'password'}
            placeholder={_('Your Password')}
            className='input input-bordered eink-bordered h-11 w-full pe-11 text-sm focus:outline-none'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='current-password'
          />
          <button
            type='button'
            onClick={() => setShowPassword((v) => !v)}
            className={clsx(
              'absolute end-2 top-1/2 -translate-y-1/2',
              'flex h-8 w-8 items-center justify-center rounded',
              'text-base-content/60 hover:text-base-content',
              'hover:bg-base-200/60 transition-colors duration-150',
              'focus-visible:ring-base-content/15 focus-visible:outline-none focus-visible:ring-2',
            )}
            aria-label={showPassword ? _('Hide password') : _('Show password')}
            title={showPassword ? _('Hide password') : _('Show password')}
            tabIndex={-1}
          >
            {showPassword ? (
              <MdVisibilityOff className='h-4 w-4' />
            ) : (
              <MdVisibility className='h-4 w-4' />
            )}
          </button>
        </div>
      </div>

      <div className='space-y-1.5'>
        <SectionTitle as='label' htmlFor='webdav-root' className='block'>
          {_('Root Directory')}
        </SectionTitle>
        <input
          id='webdav-root'
          type='text'
          placeholder='/'
          className='input input-bordered eink-bordered h-11 w-full text-sm focus:outline-none'
          spellCheck='false'
          value={rootPath}
          onChange={(e) => setRootPath(e.target.value)}
        />
      </div>

      <div className='card eink-bordered border-base-200 bg-base-100 divide-base-200 divide-y overflow-hidden border'>
        <SettingsSwitchRow
          label={_('Allow self-signed / insecure TLS')}
          description={_(
            'On by default for LAN/self-hosted servers. Turn off to require a valid certificate.',
          )}
          checked={allowInsecureTls}
          onChange={toggleTls}
        />
        <SettingsSwitchRow
          label={_('Warn about unencrypted HTTP')}
          description={_('Off by default. Turn on to be warned when a server URL uses http://.')}
          checked={warnOnPlainHttp}
          onChange={toggleWarnHttp}
        />
      </div>

      {warnOnPlainHttp && isPlainHttp && (
        <p className='text-warning text-xs leading-relaxed'>
          {_(
            'This server uses plain HTTP. Your username, password, and content may be transmitted without encryption.',
          )}
        </p>
      )}

      <div className='flex justify-end pt-1'>
        <button
          type='submit'
          disabled={isConnecting || !url || !username}
          className={clsx(
            'btn btn-contrast',
            'h-10 min-h-10 rounded-lg border-0 px-5 text-sm font-medium',
            'focus-visible:ring-base-content/40 focus-visible:outline-none focus-visible:ring-2',
            isConnecting && 'opacity-60',
          )}
        >
          {isConnecting ? <span className='loading loading-spinner loading-sm' /> : _('Connect')}
        </button>
      </div>
    </form>
  );
};

export default WebDAVForm;
