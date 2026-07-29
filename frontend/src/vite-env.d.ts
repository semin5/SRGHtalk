/// <reference types="vite/client" />

interface Window {
  srghDesktop?: {
    platform: string;
    isDesktop: boolean;
    minimize: () => void;
    toggleMaximize: () => void;
    close: () => void;
  };
}
