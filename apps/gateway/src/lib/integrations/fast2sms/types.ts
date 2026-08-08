export type Fast2SmsWabaNumber = {
  waba_id: string | number;
  phone_number_id: string | number;
  number?: string;
  verified_name?: string;
  name_status?: string;
  quality_rating?: string;
  messaging_limit?: string;
  platform_type?: string;
  connection_status?: string;
};

export type Fast2SmsTemplateComponent = {
  type?: string;
  text?: string;
  example?: unknown;
  [key: string]: unknown;
};

export type Fast2SmsTemplate = {
  message_id: number | string;
  template_id?: string;
  template_name: string;
  phone_number_id?: string;
  sender_number?: string;
  category?: string;
  status?: string;
  language?: string;
  var_count?: number;
  components?: Fast2SmsTemplateComponent[];
};

export type Fast2SmsWabaRow = Fast2SmsWabaNumber & {
  templates?: Fast2SmsTemplate[];
};

export type Fast2SmsListResponse = {
  success?: boolean | string;
  message?: string;
  data?: Fast2SmsWabaRow[];
};

export type Fast2SmsAuthSendResponse = {
  messaging_product?: string;
  contacts?: { input?: string; wa_id?: string }[];
  messages?: { id?: string; message_status?: string }[];
  status?: boolean | string;
  request_id?: string;
  message?: string | string[];
  return?: boolean;
  error?: unknown;
};

export type Fast2SmsWalletResponse = {
  return?: boolean | string;
  wallet?: number | string;
  sms_count?: number | string;
  message?: string;
};

export type Fast2SmsHealthResponse = {
  id?: string;
  health_status?: {
    can_send_message?: string;
    entities?: { entity_type?: string; id?: string; can_send_message?: string }[];
  };
  error?: unknown;
};

export type Fast2SmsMetaTemplate = {
  id?: string;
  name?: string;
  status?: string;
  category?: string;
  language?: string;
  components?: unknown[];
};

export type Fast2SmsDlrItem = {
  type?: string;
  request_id?: string;
  fast2sms_request_id?: string;
  phone_number_id?: string | number;
  recipient_id?: string | number;
  status?: string;
  status_description?: string;
  mobile?: string | number;
  errors?: unknown;
};

export type WhatsAppIntegrationConfig = {
  wabaId?: string;
  phoneNumberId?: string;
  displayPhone?: string;
  verifiedName?: string;
  qualityRating?: string;
  connectionStatus?: string;
  authTemplateName?: string;
  authTemplateLanguage?: string;
  authMessageId?: string;
  pendingAuthTemplateName?: string;
  pendingAuthTemplateStatus?: string;
  graphVersion?: string;
  smsOtpId?: string;
  smsSenderId?: string;
  dltMessageId?: string;
  numbers?: Fast2SmsWabaNumber[];
  templates?: Fast2SmsTemplate[];
  metaTemplates?: Fast2SmsMetaTemplate[];
  health?: Fast2SmsHealthResponse | null;
  wallet?: Fast2SmsWalletResponse | null;
  profile?: unknown;
  phoneDetails?: unknown;
};

export type OtpSendChannel = "whatsapp_auth" | "whatsapp_simple" | "sms_otp";
