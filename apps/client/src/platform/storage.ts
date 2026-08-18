const getLocalStorage = () => {
  if (typeof window === 'undefined') return undefined;

  return window.localStorage;
};

const getSessionStorage = () => {
  if (typeof window === 'undefined') return undefined;

  return window.sessionStorage;
};

const getPlatformLocalStorageItem = (key: string) =>
  getLocalStorage()?.getItem(key) ?? null;

const setPlatformLocalStorageItem = (key: string, value: string) => {
  getLocalStorage()?.setItem(key, value);
};

const removePlatformLocalStorageItem = (key: string) => {
  getLocalStorage()?.removeItem(key);
};

const getPlatformSessionStorageItem = (key: string) =>
  getSessionStorage()?.getItem(key) ?? null;

const setPlatformSessionStorageItem = (key: string, value: string) => {
  getSessionStorage()?.setItem(key, value);
};

const removePlatformSessionStorageItem = (key: string) => {
  getSessionStorage()?.removeItem(key);
};

export {
  getPlatformLocalStorageItem,
  getPlatformSessionStorageItem,
  removePlatformLocalStorageItem,
  removePlatformSessionStorageItem,
  setPlatformLocalStorageItem,
  setPlatformSessionStorageItem
};
