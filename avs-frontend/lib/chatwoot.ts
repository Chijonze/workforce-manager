export const openChatwootChat = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.$chatwoot?.toggle?.("open");
  window.chatwootSDK?.open?.();
};

declare global {
  interface Window {
    $chatwoot?: {
      toggle?: (state?: "open" | "close") => void;
    };
    chatwootSDK?: {
      open?: () => void;
      close?: () => void;
      run: (config: {
        websiteToken: string;
        baseUrl: string;
      }) => void;
    };
  }
}

export default {
  openChatwootChat,
};
