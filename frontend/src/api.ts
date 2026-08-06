const desktopParams = new URLSearchParams(window.location.search);
const API_BASE =
  desktopParams.get("apiBase") ??
  import.meta.env.VITE_API_URL ??
  "http://localhost:3021/api";

export type Employee = {
  id: number;
  employeeNumber: string;
  name: string;
  position?: string;
  phone?: string;
  email?: string;
  extensionNumber?: string;
  departmentId?: number;
  departmentName?: string;
  role: "USER" | "NOTICE_WRITER" | "ADMIN";
  status: string;
  online: boolean;
  statusMessage?: string;
  availability?: "ONLINE" | "BUSY" | "AWAY" | "OFFLINE";
  avatarColor?: string;
  avatarImage?: string;
};
export type FileInfo = {
  id: number;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl: string;
  batchId?: string;
};
export type Message = {
  id: number;
  roomId: number;
  senderId: number;
  senderName: string;
  type: string;
  content: string;
  sentAt: string;
  unreadCount: number;
  file?: FileInfo;
};
export type Room = {
  id: number;
  name: string;
  type: string;
  memberCount: number;
  unreadCount: number;
  lastMessage?: Message;
  members: Employee[];
  pinned?: boolean;
  muted?: boolean;
};
export type Department = {
  id: number;
  name: string;
  extensionNumber?: string;
  memberCount: number;
  active: boolean;
};
export type Notice = {
  id: number;
  senderId: number;
  senderName: string;
  senderPosition?: string;
  senderDepartment?: string;
  title: string;
  content?: string;
  recipients: string[];
  sentAt: string;
  read: boolean;
  file?: FileInfo;
};

export const session = {
  get token() {
    return localStorage.getItem("srgh_token");
  },
  set token(value: string | null) {
    value
      ? localStorage.setItem("srgh_token", value)
      : localStorage.removeItem("srgh_token");
  },
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (session.token) headers.set("Authorization", `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ message: "서버 요청에 실패했습니다." }));
    if (response.status === 401) session.token = null;
    throw new Error(body.message ?? "서버 요청에 실패했습니다.");
  }
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  return response.json();
}

export async function fetchAttachment(downloadUrl: string): Promise<Blob> {
  const headers = new Headers();
  if (session.token) headers.set("Authorization", `Bearer ${session.token}`);
  const apiUrl = new URL(API_BASE, window.location.href);
  const response = await fetch(new URL(downloadUrl, apiUrl.origin), {
    headers,
  });
  if (!response.ok) throw new Error("파일을 불러오지 못했습니다.");
  return response.blob();
}

export const api = {
  login: (employeeNumber: string, password: string) =>
    request<{ token: string; employee: Employee }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ employeeNumber, password }),
    }),
  me: () => request<Employee>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  updateMe: (data: Record<string, unknown>) =>
    request<Employee>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rooms: () => request<Room[]>("/rooms"),
  messages: (roomId: number, beforeId?: number, limit = 30) =>
    request<Message[]>(
      `/rooms/${roomId}/messages?limit=${limit}${beforeId ? `&beforeId=${beforeId}` : ""}`,
    ),
  send: (roomId: number, content: string) =>
    request<Message>(`/rooms/${roomId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content, type: "TEXT" }),
    }),
  read: (roomId: number, messageId: number) =>
    request<void>(`/rooms/${roomId}/read`, {
      method: "POST",
      body: JSON.stringify({ messageId }),
    }),
  employees: () => request<Employee[]>("/directory/employees"),
  departments: () => request<Department[]>("/directory/departments"),
  createRoom: (name: string, employeeIds: number[]) =>
    request<Room>("/rooms", {
      method: "POST",
      body: JSON.stringify({
        name,
        employeeIds,
        type: employeeIds.length === 1 ? "DIRECT" : "GROUP",
      }),
    }),
  upload: (roomId: number, file: File, batchId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (batchId) form.append("batchId", batchId);
    return request<Message>(`/rooms/${roomId}/files`, {
      method: "POST",
      body: form,
    });
  },
  presence: (online: boolean) =>
    request<void>(`/presence/${online}`, { method: "POST" }),
  adminStats: () => request<Record<string, number>>("/admin/stats"),
  adminEmployees: () => request<Employee[]>("/admin/employees"),
  createEmployee: (data: Record<string, unknown>) =>
    request<Employee>("/admin/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateEmployee: (employeeId: number, data: Record<string, unknown>) =>
    request<Employee>(`/admin/employees/${employeeId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteEmployee: (employeeId: number) =>
    request<void>(`/admin/employees/${employeeId}`, { method: "DELETE" }),
  deleteMessage: (messageId: number) =>
    request<void>(`/rooms/messages/${messageId}`, { method: "DELETE" }),
  leaveRoom: (roomId: number) =>
    request<void>(`/rooms/${roomId}/members/me`, { method: "DELETE" }),
  addRoomMembers: (roomId: number, employeeIds: number[]) =>
    request<Room>(`/rooms/${roomId}/members`, { method: "POST", body: JSON.stringify({ employeeIds }) }),
  clearRoomHistory: (roomId: number) =>
    request<void>(`/rooms/${roomId}/messages`, { method: "DELETE" }),
  updateRoomPreferences: (
    roomId: number,
    data: { customName?: string; pinned?: boolean; muted?: boolean },
  ) =>
    request<Room>(`/rooms/${roomId}/members/me`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  notices: () => request<Notice[]>("/notices"),
  sendNotice: (
    title: string,
    content: string,
    recipientIds: number[],
    file?: File,
  ) => {
    const form = new FormData();
    form.append("title", title.trim());
    if (content.trim()) form.append("content", content.trim());
    recipientIds.forEach((id) => form.append("recipientIds", String(id)));
    if (file) form.append("file", file);
    return request<Notice>("/notices", { method: "POST", body: form });
  },
  readNotice: (noticeId: number) =>
    request<void>(`/notices/${noticeId}/read`, { method: "POST" }),
};

export const websocketUrl =
  desktopParams.get("wsUrl") ??
  import.meta.env.VITE_WS_URL ??
  "http://localhost:3021/ws";
