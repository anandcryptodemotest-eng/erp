import type { NotificationChannel, DeliveryStatus } from "./types";

export type NotificationEvent =
  | {
      type: "Notification.SendRequested";
      payload: {
        tenantId: string;
        commandType: string;
        channels: NotificationChannel[];
        recipientCount: number;
        idempotencyKey: string | null;
      };
    }
  | {
      type: "Notification.DeliveryUpdated";
      payload: {
        tenantId: string;
        deliveryId: string;
        channel: NotificationChannel;
        status: DeliveryStatus;
      };
    };
