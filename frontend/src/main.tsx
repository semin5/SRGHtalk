import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  ArrowLeft, Bell, ChevronDown, FileText, Image, LogOut, Menu, MessageCircleMore,
  MoreHorizontal, Paperclip, Phone, Plus, Search, Send, Settings, ShieldCheck,
  Smile, Star, UserRoundPlus, UsersRound, Video, X
} from "lucide-react";
import { api, Department, Employee, Message, Room, session, websocketUrl } from "./api";
import "./styles.css";

const colors = ["#4d8f83", "#4d7198", "#8d6f5a", "#6d7d58", "#816f96", "#a07764"];
const initials = (name: string) => name.length > 2 ? name.slice(0, 2) : name[0];
const time = (date?: string) => date ? new Intl.DateTimeFormat("ko-KR", { hour: "numeric", minute: "2-digit" }).format(new Date(date)) : "";

function Avatar({ name, index = 0, online = false }: { name: string; index?: number; online?: boolean }) {
  return <div className="avatar" style={{ background: colors[index % colors.length] }}>{initials(name)}{online && <span className="online" />}</div>;
}

function DesktopTitleBar() {
  return <header className="desktop-titlebar">
    <div className="desktop-title">
      <span className="titlebar-logo">S</span>
      <span className="titlebar-name">사랑톡</span>
      <span className="titlebar-hospital">사랑의병원 업무 메신저</span>
    </div>
    <div className="window-controls">
      <button type="button" onClick={() => window.srghDesktop?.minimize()} aria-label="최소화" title="최소화"><span className="minimize-symbol" /></button>
      <button type="button" onClick={() => window.srghDesktop?.toggleMaximize()} aria-label="최대화 또는 복원" title="최대화 또는 복원"><span className="maximize-symbol" /></button>
      <button type="button" className="close-window" onClick={() => window.srghDesktop?.close()} aria-label="닫기" title="닫기"><span className="close-symbol" /></button>
    </div>
  </header>;
}

function Login({ onLogin }: { onLogin: (employee: Employee) => void }) {
  const [employeeNumber, setNumber] = useState("1001");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const result = await api.login(employeeNumber, password);
      session.token = result.token; onLogin(result.employee);
    } catch (e) { setError(e instanceof Error ? e.message : "로그인에 실패했습니다."); }
    finally { setLoading(false); }
  };
  return <main className="login-page">
    <section className="login-card">
      <div className="login-brand"><div className="brand-mark">S<span>+</span></div><div><b>사랑톡</b><span>사랑의병원 업무 메신저</span></div></div>
      <div className="login-copy"><span>WELCOME</span><h1>안전하고 빠른<br />병원 업무 소통</h1><p>직원 전용 계정으로 로그인해 주세요.</p></div>
      <form onSubmit={submit}>
        <label>사번<input value={employeeNumber} onChange={e => setNumber(e.target.value)} autoFocus /></label>
        <label>비밀번호<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <button disabled={loading}>{loading ? "로그인 중..." : "로그인"}</button>
      </form>
      <p className="demo-hint">체험 계정 · 사번 1001 / 비밀번호 1234</p>
    </section>
  </main>;
}

function NewRoomModal({ employees, onClose, onCreated }: { employees: Employee[]; onClose: () => void; onCreated: (r: Room) => void }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [name, setName] = useState("");
  const create = async () => {
    if (!selected.length) return;
    onCreated(await api.createRoom(name, selected)); onClose();
  };
  return <div className="modal-backdrop"><section className="modal">
    <header><h3>새 대화 시작</h3><button onClick={onClose}><X /></button></header>
    <input className="modal-input" placeholder="대화방 이름 (선택)" value={name} onChange={e => setName(e.target.value)} />
    <p className="section-label">대화 상대 선택 <b>{selected.length}</b></p>
    <div className="select-people">{employees.map((e, i) =>
      <label key={e.id} className={selected.includes(e.id) ? "checked" : ""}>
        <input type="checkbox" checked={selected.includes(e.id)} onChange={() => setSelected(s => s.includes(e.id) ? s.filter(id => id !== e.id) : [...s, e.id])} />
        <Avatar name={e.name} index={i} online={e.online} /><span><strong>{e.name}</strong><em>{e.departmentName} · {e.position}</em></span>
      </label>)}</div>
    <footer><button className="secondary" onClick={onClose}>취소</button><button onClick={create} disabled={!selected.length}>대화 시작</button></footer>
  </section></div>;
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({ employeeNumber: "", name: "", position: "", departmentId: "", password: "1234", role: "USER" });
  const refresh = useCallback(() => Promise.all([api.adminStats(), api.adminEmployees(), api.departments()]).then(([s, e, d]) => { setStats(s); setEmployees(e); setDepartments(d); }), []);
  useEffect(() => { void refresh(); }, [refresh]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.createEmployee({ ...form, departmentId: Number(form.departmentId) || null });
    setForm({ employeeNumber: "", name: "", position: "", departmentId: "", password: "1234", role: "USER" }); await refresh();
  };
  return <div className="admin-page">
    <header><div><span>ADMIN CONSOLE</span><h2>사랑톡 관리</h2></div><button onClick={onClose}><X /> 메신저로 돌아가기</button></header>
    <div className="stat-grid">{[["employees", "전체 직원"], ["departments", "부서"], ["rooms", "대화방"], ["messages", "누적 메시지"], ["online", "현재 접속"]].map(([key, label]) => <article key={key}><b>{stats[key] ?? 0}</b><span>{label}</span></article>)}</div>
    <div className="admin-grid">
      <section><h3>직원 계정 등록</h3><form className="admin-form" onSubmit={create}>
        <label>사번<input required value={form.employeeNumber} onChange={e => setForm({ ...form, employeeNumber: e.target.value })} /></label>
        <label>이름<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
        <label>직책<input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></label>
        <label>부서<select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })}><option value="">선택</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label>초기 비밀번호<input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></label>
        <label>권한<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="USER">일반 직원</option><option value="ADMIN">관리자</option></select></label>
        <button>직원 등록</button>
      </form></section>
      <section><h3>직원 현황 <small>{employees.length}명</small></h3><div className="admin-table">{employees.map((e, i) => <div key={e.id}><Avatar name={e.name} index={i} online={e.online} /><span><strong>{e.name} {e.role === "ADMIN" && <ShieldCheck />}</strong><em>{e.employeeNumber} · {e.departmentName ?? "미지정"} · {e.position}</em></span><b className={`status ${e.status.toLowerCase()}`}>{e.status}</b></div>)}</div></section>
    </div>
  </div>;
}

function Messenger({ me, onLogout }: { me: Employee; onLogout: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeId, setActiveId] = useState<number>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<"chat" | "people">("people");
  const [newRoom, setNewRoom] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [compactChat, setCompactChat] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<Client | null>(null);

  const refreshRooms = useCallback(async () => {
    const data = await api.rooms(); setRooms(data);
    setActiveId(id => id ?? data[0]?.id);
  }, []);
  useEffect(() => { void Promise.all([refreshRooms(), api.employees().then(setEmployees), api.presence(true)]); return () => { void api.presence(false); }; }, [refreshRooms]);
  useEffect(() => { if (activeId) api.messages(activeId).then(data => { setMessages(data); const last = data.at(-1); if (last) void api.read(activeId, last.id); }); }, [activeId]);
  useEffect(() => {
    if (!session.token) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe("/topic/rooms", () => void refreshRooms());
        client.subscribe("/topic/presence", () => void api.employees().then(setEmployees));
      }
    });
    client.activate(); clientRef.current = client;
    return () => { void client.deactivate(); };
  }, [refreshRooms]);
  useEffect(() => {
    const client = clientRef.current;
    if (!activeId || !client?.connected) return;
    const sub = client.subscribe(`/topic/rooms/${activeId}`, frame => {
      const event = JSON.parse(frame.body);
      if (event.type === "MESSAGE_DELETED") setMessages(m => m.map(x => x.id === event.messageId ? { ...x, content: "삭제된 메시지입니다." } : x));
      else { setMessages(m => m.some(x => x.id === event.id) ? m : [...m, event]); void api.read(activeId, event.id); }
      void refreshRooms();
    });
    return () => sub.unsubscribe();
  }, [activeId, refreshRooms, clientRef.current?.connected]);
  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [activeId, messages.length]);

  const room = rooms.find(r => r.id === activeId);
  const filtered = rooms.filter(r => r.name.includes(query) || r.lastMessage?.content.includes(query));
  const visibleEmployees = employees.filter(e => e.id !== me.id && (
    e.name.includes(query) || (e.departmentName ?? "").includes(query) ||
    e.employeeNumber.includes(query) || (e.position ?? "").includes(query)
  ));
  const employeeGroups = useMemo(() => Object.entries(
    visibleEmployees.reduce<Record<string, Employee[]>>((groups, employee) => {
      const department = employee.departmentName ?? "부서 미지정";
      (groups[department] ??= []).push(employee);
      return groups;
    }, {})
  ), [visibleEmployees]);
  const send = async () => {
    const content = text.trim(); if (!activeId || !content) return; setText("");
    const sent = await api.send(activeId, content); setMessages(m => m.some(x => x.id === sent.id) ? m : [...m, sent]); await refreshRooms();
  };
  const upload = async (file?: File) => { if (!file || !activeId) return; const sent = await api.upload(activeId, file); setMessages(m => [...m, sent]); await refreshRooms(); };
  const startDirectChat = async (employee: Employee) => {
    const existing = rooms.find(r => r.memberCount === 2 && r.members.some(member => member.id === employee.id));
    const target = existing ?? await api.createRoom(employee.name, [employee.id]);
    await refreshRooms();
    setActiveId(target.id);
    setCompactChat(true);
  };
  const logout = async () => { await api.presence(false); await api.logout(); session.token = null; onLogout(); };
  if (admin) return <AdminPanel onClose={() => setAdmin(false)} />;

  return <main className={`app-shell ${compactChat ? "compact-chat-open" : ""}`}>
    {newRoom && <NewRoomModal employees={employees.filter(e => e.id !== me.id)} onClose={() => setNewRoom(false)} onCreated={r => { void refreshRooms(); setActiveId(r.id); setCompactChat(true); }} />}
    <aside className="rail">
      <div className="brand-mark">S<span>talk</span></div>
      <nav><button className={panel === "people" ? "active" : ""} onClick={() => setPanel("people")}><UsersRound /></button><button className={panel === "chat" ? "active" : ""} onClick={() => setPanel("chat")}><MessageCircleMore /></button><button><Star /></button><button><Bell /><i>2</i></button></nav>
      <div className="rail-bottom">{me.role === "ADMIN" && <button onClick={() => setAdmin(true)} title="관리자"><ShieldCheck /></button>}<button onClick={logout} title="로그아웃"><LogOut /></button><Avatar name={me.name} online /></div>
    </aside>
    <section className="room-panel">
      <header className="panel-title"><div><span className="eyebrow">사랑의병원</span><h1>{panel === "chat" ? "대화" : "대화상대"} <ChevronDown /></h1></div><button className="round-button" onClick={() => setNewRoom(true)}>{panel === "chat" ? <Plus /> : <UsersRound />}</button></header>
      <div className="search-box"><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={panel === "chat" ? "대화방 또는 메시지 검색" : "이름, 부서, 사번, 담당업무"} /></div>
      {panel === "chat" ? <><div className="filter-line"><button>전체 대화 <ChevronDown /></button><span>{rooms.length}개의 대화</span></div><div className="room-list">
        {filtered.map((r, i) => <button key={r.id} className={`room-item ${activeId === r.id ? "selected" : ""}`} onClick={() => { setActiveId(r.id); setCompactChat(true); }}>
          <Avatar name={r.name} index={i} /><span className="room-copy"><strong>{r.name} <small>{r.memberCount}</small></strong><em>{r.lastMessage?.content ?? "새 대화방"}</em></span><span className="room-meta"><time>{time(r.lastMessage?.sentAt)}</time>{r.unreadCount > 0 && <b>{r.unreadCount}</b>}</span>
        </button>)}</div></> : <div className="people-list directory-list"><p className="section-label">내 프로필</p><div className="person profile-person"><Avatar name={me.name} online /><span><strong>{me.name}</strong><em>{me.departmentName} · {me.position}</em></span><button className="staff-chat-button" onClick={() => setPanel("chat")} aria-label="내 대화 목록"><MessageCircleMore /></button></div>{employeeGroups.map(([department, members]) => <section className="department-group" key={department}><p className="section-label">{department} <b>{members.length}</b></p>{members.map((employee, i) => <div className="person" key={employee.id}><Avatar name={employee.name} index={i + 1} online={employee.online} /><span><strong>{employee.name}</strong><em>{employee.departmentName} · {employee.position}</em></span><button className="staff-chat-button" onClick={() => void startDirectChat(employee)} aria-label={`${employee.name}님과 대화`}><MessageCircleMore /></button></div>)}</section>)}</div>}
    </section>
    <section className="chat-panel">
      {room ? <><header className="chat-header"><button className="compact-back" onClick={() => setCompactChat(false)} aria-label="대화 목록"><ArrowLeft /></button><div className="chat-title"><Avatar name={room.name} /><div><h2>{room.name}</h2><span>{room.memberCount}명 참여 · <b>{room.members.filter(m => m.online).length}명 접속 중</b></span></div></div><div className="header-actions"><button><Search /></button><button><Phone /></button><button><Video /></button><button onClick={() => setNewRoom(true)}><UserRoundPlus /></button><button><MoreHorizontal /></button></div></header>
      <div className="messages scrollable" ref={messagesRef}><div className="notice"><span>안전한 병원 업무 소통을 위해 개인정보 전송에 유의해 주세요.</span></div>{messages.map(m => <div className={`message-row ${m.senderId === me.id ? "mine" : ""}`} key={m.id}>{m.senderId !== me.id && <Avatar name={m.senderName} />}<div className="bubble-wrap">{m.senderId !== me.id && <strong>{m.senderName}</strong>}<div className="bubble-line">{m.senderId === me.id && <span className="message-meta">{m.unreadCount > 0 && <b>{m.unreadCount}</b>}<time>{time(m.sentAt)}</time></span>}<div className={`bubble ${m.file ? "file-bubble" : ""}`}>{m.file && <FileText />}{m.content}{m.file && <small>{(m.file.sizeBytes / 1024 / 1024).toFixed(1)} MB</small>}</div>{m.senderId !== me.id && <span className="message-meta"><time>{time(m.sentAt)}</time></span>}</div></div></div>)}</div>
      <footer className="composer"><input ref={fileRef} type="file" hidden onChange={e => void upload(e.target.files?.[0])} /><div className="composer-tools"><button onClick={() => fileRef.current?.click()}><Paperclip /></button><button onClick={() => fileRef.current?.click()}><Image /></button><button onClick={() => fileRef.current?.click()}><FileText /></button></div><div className="input-wrap"><textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="메시지를 입력하세요" /><div><button><Smile /></button><button className="send-button" onClick={() => void send()} disabled={!text.trim()}><Send /></button></div></div><span className="input-hint">Enter 전송 · Shift + Enter 줄바꿈</span></footer></> : <div className="empty-chat"><MessageCircleMore /><h2>대화를 시작해 보세요</h2><p>직원을 선택해 새로운 대화방을 만들 수 있습니다.</p><button onClick={() => setNewRoom(true)}>새 대화 시작</button></div>}
    </section>
    <aside className="info-panel">{room && <><div className="info-head"><h3>대화방 정보</h3><button><Menu /></button></div><div className="room-profile"><Avatar name={room.name} /><h3>{room.name}</h3><p>업무 공유와 빠른 소통을 위한 공간입니다.</p></div><div className="info-block"><button className="info-row"><span><UsersRound /> 참여자</span><b>{room.memberCount}</b></button>{room.members.map((m, i) => <div className="person compact" key={m.id}><Avatar name={m.name} index={i} online={m.online} /><span><strong>{m.name}</strong><em>{m.departmentName} · {m.position}</em></span></div>)}</div></>}</aside>
  </main>;
}

function App() {
  const [me, setMe] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(!!session.token);
  useEffect(() => { if (session.token) api.me().then(setMe).catch(() => session.token = null).finally(() => setLoading(false)); }, []);
  const content = loading
    ? <div className="loading-screen"><div className="brand-mark">S<span>+</span></div><p>사랑톡을 준비하고 있습니다</p></div>
    : me ? <Messenger me={me} onLogout={() => setMe(null)} /> : <Login onLogin={setMe} />;
  return window.srghDesktop?.isDesktop
    ? <div className="desktop-shell"><DesktopTitleBar />{content}</div>
    : content;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
