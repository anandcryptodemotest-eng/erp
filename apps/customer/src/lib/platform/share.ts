export interface ShareAdapter {
  share(data: { title?: string; text?: string; url?: string }): Promise<boolean>;
}

const webShare: ShareAdapter = {
  async share(data) {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  },
};

let impl: ShareAdapter = webShare;

export function setShareImplementation(next: ShareAdapter) {
  impl = next;
}

export const share = {
  share: (data: { title?: string; text?: string; url?: string }) => impl.share(data),
};
