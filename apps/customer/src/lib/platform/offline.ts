/** Offline catalog/orders — stub until IndexedDB/SQLite backends land. */

export interface OfflineAdapter {
  isAvailable(): boolean;
  getCachedCatalog(): Promise<unknown[]>;
}

const stub: OfflineAdapter = {
  isAvailable: () => false,
  async getCachedCatalog() {
    return [];
  },
};

let impl: OfflineAdapter = stub;

export function setOfflineImplementation(next: OfflineAdapter) {
  impl = next;
}

export const offline = {
  isAvailable: () => impl.isAvailable(),
  getCachedCatalog: () => impl.getCachedCatalog(),
};
