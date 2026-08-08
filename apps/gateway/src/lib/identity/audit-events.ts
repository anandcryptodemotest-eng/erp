import { createLogger } from "@erp/logger";

/**
 * Identity audit events.
 *
 * These are structured, searchable log records for authentication activity.
 * Later this can be persisted (e.g. into an AuditEvent table) without changing
 * the call sites.
 */
export const AuthAuditEvent = {
  LOGIN_PASSWORD: "LOGIN_PASSWORD",
  LOGIN_GOOGLE: "LOGIN_GOOGLE",
  REGISTER_GOOGLE: "REGISTER_GOOGLE",
  ACCOUNT_LINKED: "ACCOUNT_LINKED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  LOGOUT: "LOGOUT",
  LOGOUT_ALL: "LOGOUT_ALL",
  LOGIN_OTP: "LOGIN_OTP",
  OTP_SENT: "OTP_SENT",
  PHONE_LINKED: "PHONE_LINKED",
} as const;

export type AuthAuditEventType = (typeof AuthAuditEvent)[keyof typeof AuthAuditEvent];

const auditLogger = createLogger({ service: "gateway-auth" });

export function auditAuthEvent(input: {
  event: AuthAuditEventType;
  userId?: string;
  email?: string;
  meta?: Record<string, unknown>;
}) {
  auditLogger.info(`auth_event_${input.event.toLowerCase()}`, {
    event: input.event,
    userId: input.userId,
    email: input.email,
    ...input.meta,
  });
}
