import type { TPluginUserData } from '@sharkord/shared';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { ownUserIdSelector } from '../users/selectors';
import { usePluginId } from './plugin-id-context';
import { pluginActions } from './plugin-store';

type TSnapshot = Pick<TPluginUserData, 'data' | 'loading'>;

type TEntry = {
  snapshot: TSnapshot;
  listeners: Set<() => void>;
  requested: boolean;
};

const DEFAULT_DATA: Record<string, unknown> = {};
const EMPTY_SNAPSHOT: TSnapshot = { data: DEFAULT_DATA, loading: false };
const entries = new Map<string, TEntry>();

const getEntry = (key: string) => {
  let entry = entries.get(key);

  if (!entry) {
    entry = {
      snapshot: { data: DEFAULT_DATA, loading: true },
      listeners: new Set(),
      requested: false
    };
    entries.set(key, entry);
  }

  return entry;
};

const setSnapshot = (key: string, snapshot: TSnapshot) => {
  const entry = getEntry(key);

  entry.snapshot = snapshot;
  entry.listeners.forEach((listener) => listener());
};

const load = (key: string, pluginId: string) => {
  const entry = getEntry(key);

  if (entry.requested) return;

  entry.requested = true;

  pluginActions
    .getUserData(pluginId)
    .then((data) => setSnapshot(key, { data, loading: false }))
    .catch(() => {
      // tried again by the next component that mounts
      entry.requested = false;
      setSnapshot(key, { data: DEFAULT_DATA, loading: false });
    });
};

const subscribe = (key: string, listener: () => void) => {
  const { listeners } = getEntry(key);

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const noopSubscribe = () => () => {};

const usePluginUserData = (): TPluginUserData => {
  const pluginId = usePluginId();
  const ownUserId = useSelector(ownUserIdSelector);
  const key =
    pluginId && ownUserId !== undefined
      ? `${ownUserId}:${pluginId}`
      : undefined;

  useEffect(() => {
    if (key && pluginId) load(key, pluginId);
  }, [key, pluginId]);

  const snapshot = useSyncExternalStore(
    useCallback(
      (listener: () => void) =>
        key ? subscribe(key, listener) : noopSubscribe(),
      [key]
    ),
    () => (key ? getEntry(key).snapshot : EMPTY_SNAPSHOT)
  );

  const save = useCallback(
    async (next: Record<string, unknown>) => {
      if (!pluginId || !key) return;

      await pluginActions.setUserData(pluginId, next);

      setSnapshot(key, { data: next, loading: false });
    },
    [pluginId, key]
  );

  return { ...snapshot, save };
};

export { usePluginUserData };
