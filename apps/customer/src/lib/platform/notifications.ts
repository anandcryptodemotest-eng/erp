/**
 * Notification adapter — in-app list today; Web Push / native push later.
 */

export interface NotificationAdapter {
  /** Subscribe to push (no-op until push configured). */
  subscribe(): Promise<void>;
  unsubscribe(): Promise<void>;
}

const noop: NotificationAdapter = {
  async subscribe() {},
  async unsubscribe() {},
};

let impl: NotificationAdapter = noop;

export function setNotificationImplementation(next: NotificationAdapter) {
  impl = next;
}

export const notification = {
  subscribe: () => impl.subscribe(),
  unsubscribe: () => impl.unsubscribe(),
};
