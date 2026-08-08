/**
 * Platform storage adapter — Web/PWA use localStorage; Native swaps Preferences/SQLite later.
 * Business logic must not branch on platform.
 */

export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const webStorage: KeyValueStorage = {
  get(key) {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    if (typeof window === "undefined") return;
    localStorage.setItem(key, value);
  },
  remove(key) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  },
};

let impl: KeyValueStorage = webStorage;

/** Native shell may replace the storage implementation at boot. */
export function setStorageImplementation(next: KeyValueStorage) {
  impl = next;
}

export const storage = {
  get: (key: string) => impl.get(key),
  set: (key: string, value: string) => impl.set(key, value),
  remove: (key: string) => impl.remove(key),
};
