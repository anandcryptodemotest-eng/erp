export {
  NOTIFICATION_COMMAND_VERSION,
  NOTIFICATION_CHANNELS,
  DELIVERY_STATUSES,
  NOTIFICATION_MODES,
} from "./types";
export type {
  NotificationChannel,
  DeliveryStatus,
  NotificationMode,
  NotificationRecipient,
  NotificationSendCommand,
  ChannelPolicy,
  NotificationPolicy,
  DeliveryRecord,
  AdapterResult,
  SendContext,
  DispatchResult,
} from "./types";

export {
  NOTIFICATION_PROVIDER,
  NOTIFICATION_EMAIL_PROVIDER,
  NOTIFICATION_TELEGRAM_PROVIDER,
  MAX_DELIVERY_ATTEMPTS,
  DEFAULT_NOTIFICATION_POLICY,
  CHANNEL_LABELS,
} from "./constants";

export { parseSendCommand, NotificationCommandError, recipientAddress, resolveChannels } from "./command";
export { renderTemplate, formatOutboundText } from "./render";
export { dispatchSendCommand, retryDelivery, nextRetryStatus } from "./dispatch";
export type { DispatchDeps } from "./dispatch";
export type { NotificationEvent } from "./events";
