import type { WebDAVProfile, WebDAVSettings } from '@/types/settings';

/**
 * Multiple-WebDAV-server support (SPEC §5.1 enhancement). Users can save several
 * named servers; exactly one is active at a time. The active profile's
 * connection is mirrored onto the top-level `serverUrl`/`username`/`password`/
 * `rootPath` fields that the sync engine + client already read, so no engine
 * change is needed — these pure helpers just keep the mirror and the `profiles`
 * array consistent. `lastSyncedAt` is stored per profile so switching servers
 * never carries a stale sync cursor across servers.
 */

interface Connection {
  serverUrl: string;
  username: string;
  password: string;
  rootPath: string;
}

const connectionOf = (s: WebDAVSettings): Connection => ({
  serverUrl: s.serverUrl ?? '',
  username: s.username ?? '',
  password: s.password ?? '',
  rootPath: s.rootPath || '/',
});

const mirror = (s: WebDAVSettings, profile: WebDAVProfile): WebDAVSettings => ({
  ...s,
  serverUrl: profile.serverUrl,
  username: profile.username,
  password: profile.password,
  rootPath: profile.rootPath || '/',
  lastSyncedAt: profile.lastSyncedAt ?? 0,
  activeProfileId: profile.id,
});

/**
 * Return the profile list, migrating a legacy singleton connection into an
 * implicit "Default" profile when no profiles exist yet but a server is set.
 * Returns an empty list when nothing is configured.
 */
export const listProfiles = (s: WebDAVSettings): WebDAVProfile[] => {
  if (s.profiles && s.profiles.length) return s.profiles;
  if ((s.serverUrl ?? '').trim()) {
    return [{ id: 'default', name: 'Default', ...connectionOf(s), lastSyncedAt: s.lastSyncedAt }];
  }
  return [];
};

export const getActiveProfileId = (s: WebDAVSettings): string => {
  const profiles = listProfiles(s);
  if (!profiles.length) return '';
  return profiles.some((p) => p.id === s.activeProfileId) ? s.activeProfileId! : profiles[0]!.id;
};

/** Write the current top-level connection + lastSyncedAt back into its profile. */
const captureActive = (s: WebDAVSettings, profiles: WebDAVProfile[]): WebDAVProfile[] => {
  const activeId = getActiveProfileId(s);
  if (!activeId) return profiles;
  const conn = connectionOf(s);
  return profiles.map((p) =>
    p.id === activeId ? { ...p, ...conn, lastSyncedAt: s.lastSyncedAt ?? p.lastSyncedAt } : p,
  );
};

/** Persist the just-entered connection into the top-level mirror + active profile. */
export const applyConnectionToActive = (
  s: WebDAVSettings,
  conn: Connection,
  newProfileId = 'default',
): WebDAVSettings => {
  const existing = listProfiles(s);
  const activeId = existing.length ? getActiveProfileId(s) : newProfileId;
  const profiles = existing.length
    ? existing.map((p) => (p.id === activeId ? { ...p, ...conn } : p))
    : [{ id: newProfileId, name: 'Default', ...conn }];
  return { ...s, ...conn, rootPath: conn.rootPath || '/', profiles, activeProfileId: activeId };
};

/** Add a blank named server and make it active (caller supplies a unique id). */
export const addProfile = (s: WebDAVSettings, id: string, name: string): WebDAVSettings => {
  const profiles = captureActive(s, listProfiles(s));
  const blank: WebDAVProfile = {
    id,
    name,
    serverUrl: '',
    username: '',
    password: '',
    rootPath: '/',
    lastSyncedAt: 0,
  };
  return mirror({ ...s, profiles: [...profiles, blank] }, blank);
};

/** Switch the active server, saving the current connection into its profile first. */
export const setActiveProfile = (s: WebDAVSettings, id: string): WebDAVSettings => {
  const profiles = captureActive(s, listProfiles(s));
  const target = profiles.find((p) => p.id === id);
  if (!target) return { ...s, profiles };
  return mirror({ ...s, profiles }, target);
};

export const renameProfile = (s: WebDAVSettings, id: string, name: string): WebDAVSettings => {
  const profiles = captureActive(s, listProfiles(s)).map((p) => (p.id === id ? { ...p, name } : p));
  return { ...s, profiles };
};

/** Remove a server. If the active one is removed, fall back to the first remaining. */
export const removeProfile = (s: WebDAVSettings, id: string): WebDAVSettings => {
  const wasActive = getActiveProfileId(s) === id;
  const profiles = captureActive(s, listProfiles(s)).filter((p) => p.id !== id);
  if (!wasActive) return { ...s, profiles };
  if (!profiles.length) {
    return {
      ...s,
      profiles: [],
      activeProfileId: '',
      serverUrl: '',
      username: '',
      password: '',
      rootPath: '/',
      lastSyncedAt: 0,
    };
  }
  return mirror({ ...s, profiles }, profiles[0]!);
};
