/// <reference types="vite/client" />

interface SrghSettings {
  theme: "light" | "dark" | "system";
  fontSize: "small" | "normal" | "large";
  density: "compact" | "comfortable";
  notifications: boolean;
  notificationPreview: boolean;
  sound: boolean;
  alwaysOnTop: boolean;
  startAtLogin: boolean;
  enterToSend: boolean;
  autoLogin: boolean;
}

interface Window {
  srghDesktop?: {
    platform: string;
    isDesktop: boolean;
    minimize: () => void;
    close: () => void;
    openChat: (roomId: number) => void;
    openOrganization: () => void;
    openNotice: (noticeId: number) => void;
    composeNotice: () => void;
    applySettings: (settings: SrghSettings) => void;
    onSettingsChanged: (callback: (settings: SrghSettings) => void) => () => void;
    notify: (title: string, body: string, sound: boolean, roomId?: number) => void;
    logout: () => void;
    saveCredentials: (employeeNumber: string, password: string) => Promise<boolean>;
    getCredentials: () => Promise<{ employeeNumber: string; password: string } | null>;
    clearCredentials: () => Promise<void>;
  };
}
