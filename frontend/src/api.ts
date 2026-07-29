const desktopParams = new URLSearchParams(window.location.search);
const API_BASE = desktopParams.get("apiBase") ?? import.meta.env.VITE_API_URL ?? "http://localhost:3021/api";

export type Employee = {
  id: number; employeeNumber: string; name: string; position?: string; phone?: string;
  email?: string; departmentId?: number; departmentName?: string; role: "USER" | "ADMIN";
  status: string; online: boolean;
};
export type FileInfo = { id: number; originalName: string; contentType: string; sizeBytes: number; downloadUrl: string };
export type Message = {
  id: number; roomId: number; senderId: number; senderName: string; type: string;
  content: string; sentAt: string; unreadCount: number; file?: FileInfo;
};
export type Room = {
  id: number; name: string; type: string; memberCount: number; unreadCount: number;
  lastMessage?: Message; members: Employee[];
};
export type Department = { id: number; name: string; extensionNumber?: string; memberCount: number; active: boolean };

export const session = {
  get token() { return localStorage.getItem("srgh_token"); },
  set token(value: string | null) { value ? localStorage.setItem("srgh_token", value) : localStorage.removeItem("srgh_token"); }
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (session.token) headers.set("Authorization", `Bearer ${session.token}`);
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "서버 요청에 실패했습니다." }));
    if (response.status === 401) session.token = null;
    throw new Error(body.message ?? "서버 요청에 실패했습니다.");
  }
  if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
  return response.json();
}

export const api = {
  login: (employeeNumber: string, password: string) =>
    request<{ token: string; employee: Employee }>("/auth/login", { method: "POST", body: JSON.stringify({ employeeNumber, password }) }),
  me: () => request<Employee>("/auth/me"),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  rooms: () => request<Room[]>("/rooms"),
  messages: (roomId: number) => request<Message[]>(`/rooms/${roomId}/messages`),
  send: (roomId: number, content: string) =>
    request<Message>(`/rooms/${roomId}/messages`, { method: "POST", body: JSON.stringify({ content, type: "TEXT" }) }),
  read: (roomId: number, messageId: number) =>
    request<void>(`/rooms/${roomId}/read`, { method: "POST", body: JSON.stringify({ messageId }) }),
  employees: () => request<Employee[]>("/directory/employees"),
  departments: () => request<Department[]>("/directory/departments"),
  createRoom: (name: string, employeeIds: number[]) =>
    request<Room>("/rooms", { method: "POST", body: JSON.stringify({ name, employeeIds, type: "GROUP" }) }),
  upload: (roomId: number, file: File) => {
    const form = new FormData(); form.append("file", file);
    return request<Message>(`/rooms/${roomId}/files`, { method: "POST", body: form });
  },
  presence: (online: boolean) => request<void>(`/presence/${online}`, { method: "POST" }),
  adminStats: () => request<Record<string, number>>("/admin/stats"),
  adminEmployees: () => request<Employee[]>("/admin/employees"),
  createEmployee: (data: Record<string, unknown>) =>
    request<Employee>("/admin/employees", { method: "POST", body: JSON.stringify(data) }),
};

export const websocketUrl = desktopParams.get("wsUrl") ?? import.meta.env.VITE_WS_URL ?? "http://localhost:3021/ws";
