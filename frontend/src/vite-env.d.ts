/// <reference types="vite/client" />

interface SrghSettings {
  theme: "light" | "dark" | "system";
  fontSize: number;
  density: "compact" | "comfortable";
  notifications: boolean;
  notificationPreview: boolean;
  sound: boolean;
  alwaysOnTop: boolean;
  startAtLogin: boolean;
  enterToSend: boolean;
  autoLogin: boolean;
  awayMinutes: number;
}

interface Window {
  srghDesktop?: {
    platform: string;
    isDesktop: boolean;
    minimize: () => void;
    close: () => void;
    openChat: (roomId: number) => void;
    openImageViewer: (roomId: number, fileId: number) => void;
    openExternal: (url: string) => void;
    openOrganization: () => void;
    openFileLibrary: () => void;
    openNotice: (noticeId: number) => void;
    composeNotice: () => void;
    applySettings: (settings: SrghSettings) => void;
    onSettingsChanged: (callback: (settings: SrghSettings) => void) => () => void;
    onAutoAway: (callback: () => void) => () => void;
    onAutoActive: (callback: () => void) => () => void;
    notify: (title: string, body: string, sound: boolean, roomId?: number) => void;
    logout: () => void;
    saveCredentials: (employeeNumber: string, password: string) => Promise<boolean>;
    getCredentials: () => Promise<{ employeeNumber: string; password: string } | null>;
    clearCredentials: () => Promise<void>;
    setOpacity: (value: number) => void;
    listDisplays: () => Promise<Array<{ id: string; label: string; width: number; height: number; primary: boolean }>>;
    captureScreen: (displayId: string) => Promise<string>;
    startRegionCapture: () => void;
    completeRegionCapture: (dataUrl: string) => void;
    cancelRegionCapture: () => void;
    onRegionCapture: (callback: (dataUrl: string) => void) => () => void;
  };
}
