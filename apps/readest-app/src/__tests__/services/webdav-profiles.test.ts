import { describe, it, expect } from 'vitest';
import type { WebDAVSettings } from '@/types/settings';
import {
  listProfiles,
  getActiveProfileId,
  addProfile,
  setActiveProfile,
  renameProfile,
  removeProfile,
  applyConnectionToActive,
} from '@/services/sync/providers/webdav/profiles';

const base = (overrides: Partial<WebDAVSettings> = {}): WebDAVSettings =>
  ({
    enabled: false,
    serverUrl: '',
    username: '',
    password: '',
    rootPath: '/',
    ...overrides,
  }) as WebDAVSettings;

describe('webdav profiles — migration', () => {
  it('returns no profiles when nothing is configured', () => {
    expect(listProfiles(base())).toEqual([]);
    expect(getActiveProfileId(base())).toBe('');
  });

  it('migrates a legacy singleton connection into a Default profile', () => {
    const s = base({ serverUrl: 'https://dav.lan', username: 'u', password: 'p', rootPath: '/x' });
    const profiles = listProfiles(s);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toMatchObject({
      id: 'default',
      name: 'Default',
      serverUrl: 'https://dav.lan',
    });
    expect(getActiveProfileId(s)).toBe('default');
  });

  it('falls back to the first profile when activeProfileId is stale', () => {
    const s = base({
      profiles: [{ id: 'a', name: 'A', serverUrl: 'x', username: '', password: '', rootPath: '/' }],
      activeProfileId: 'missing',
    });
    expect(getActiveProfileId(s)).toBe('a');
  });
});

describe('webdav profiles — mutations', () => {
  const configured = base({
    serverUrl: 'https://one.lan',
    username: 'u1',
    password: 'p1',
    rootPath: '/one',
    lastSyncedAt: 111,
  });

  it('adds a server, makes it active, and mirrors a blank connection', () => {
    const next = addProfile(configured, 'id2', 'Second');
    expect(next.profiles).toHaveLength(2);
    expect(next.activeProfileId).toBe('id2');
    // Top-level mirror is now the blank new profile...
    expect(next.serverUrl).toBe('');
    expect(next.lastSyncedAt).toBe(0);
    // ...and the previous active profile kept its captured connection.
    const first = next.profiles!.find((p) => p.id === 'default')!;
    expect(first).toMatchObject({ serverUrl: 'https://one.lan', lastSyncedAt: 111 });
  });

  it('switches active server, saving the current connection and loading the target', () => {
    const withSecond = addProfile(configured, 'id2', 'Second');
    // Simulate editing the second profile's connection at the top level.
    const edited = {
      ...withSecond,
      serverUrl: 'https://two.lan',
      username: 'u2',
      password: 'p2',
      rootPath: '/two',
    };
    const back = setActiveProfile(edited, 'default');
    expect(back.activeProfileId).toBe('default');
    expect(back.serverUrl).toBe('https://one.lan'); // loaded from default
    const second = back.profiles!.find((p) => p.id === 'id2')!;
    expect(second.serverUrl).toBe('https://two.lan'); // saved before switching away
  });

  it('renames the active profile', () => {
    const renamed = renameProfile(configured, 'default', 'Home NAS');
    expect(renamed.profiles!.find((p) => p.id === 'default')!.name).toBe('Home NAS');
  });

  it('removes a non-active profile without changing the active connection', () => {
    const withSecond = addProfile(configured, 'id2', 'Second'); // active = id2
    const removed = removeProfile(withSecond, 'default');
    expect(removed.profiles!.map((p) => p.id)).toEqual(['id2']);
    expect(removed.activeProfileId).toBe('id2');
  });

  it('removing the active profile falls back to the first remaining and mirrors it', () => {
    const withSecond = addProfile(configured, 'id2', 'Second'); // active = id2 (blank)
    const removed = removeProfile(withSecond, 'id2');
    expect(removed.activeProfileId).toBe('default');
    expect(removed.serverUrl).toBe('https://one.lan');
  });

  it('removing the last profile clears the connection', () => {
    const removed = removeProfile(configured, 'default');
    expect(removed.profiles).toEqual([]);
    expect(removed.activeProfileId).toBe('');
    expect(removed.serverUrl).toBe('');
  });

  it('applyConnectionToActive creates a Default profile from a fresh connection', () => {
    const next = applyConnectionToActive(base(), {
      serverUrl: 'https://new.lan',
      username: 'x',
      password: 'y',
      rootPath: '/z',
    });
    expect(next.serverUrl).toBe('https://new.lan');
    expect(next.profiles).toHaveLength(1);
    expect(next.profiles![0]).toMatchObject({ name: 'Default', serverUrl: 'https://new.lan' });
  });
});
