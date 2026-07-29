import type {
  ClipboardApi,
  DialogApi,
  LocalizationApi,
  NavigationApi,
  ToastApi,
  UIContext,
  UIRuntime,
} from "./types";
import { createUIEventBus } from "./events";

export function createUIRuntime(input: {
  context: UIContext;
  dialog?: Partial<DialogApi>;
  toast?: Partial<ToastApi>;
  navigation?: Partial<NavigationApi>;
  clipboard?: Partial<ClipboardApi>;
  localization?: Partial<LocalizationApi>;
}): UIRuntime {
  const events = createUIEventBus();
  const dialog: DialogApi = {
    confirm: input.dialog?.confirm ?? (async (message) =>
      typeof window !== "undefined" ? window.confirm(message) : true),
    open: input.dialog?.open,
  };
  const toast: ToastApi = {
    success: input.toast?.success ?? ((m) => console.info("[toast]", m)),
    error: input.toast?.error ?? ((m) => console.error("[toast]", m)),
    info: input.toast?.info,
  };
  const navigation: NavigationApi = {
    push: input.navigation?.push,
    back: input.navigation?.back,
  };
  const clipboard: ClipboardApi = {
    writeText:
      input.clipboard?.writeText ??
      (async (text) => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      }),
  };
  const localization: LocalizationApi = {
    t: input.localization?.t ?? ((_k, fallback) => fallback ?? _k),
  };

  return {
    context: input.context,
    dialog,
    toast,
    navigation,
    clipboard,
    localization,
    theme: input.context.theme,
    events,
  };
}
