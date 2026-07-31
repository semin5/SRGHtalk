import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import {
  ArrowLeft,
  Bell,
  Building2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  Download,
  FileText,
  Image,
  LogOut,
  Mail,
  Menu,
  MessageCircleMore,
  Monitor,
  Moon,
  MoreHorizontal,
  Network,
  Paperclip,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Smile,
  Star,
  Sun,
  Trash2,
  UserRound,
  UserRoundPlus,
  UsersRound,
  Video,
  Volume2,
  X,
} from "lucide-react";
import {
  api,
  Department,
  Employee,
  fetchAttachment,
  FileInfo,
  Message,
  Notice,
  Room,
  session,
  websocketUrl,
} from "./api";
import "./styles.css";

const time = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("ko-KR", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(date))
    : "";
const dateKey = (date?: string) =>
  date ? new Date(date).toLocaleDateString("en-CA") : "";
const messageDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      }).format(new Date(date))
    : "";
const mergeMessages = (current: Message[], incoming: Message[]) => {
  const merged = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => merged.set(message.id, message));
  return [...merged.values()].sort((a, b) => a.id - b.id);
};

type MessengerSettings = {
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
};

const defaultSettings: MessengerSettings = {
  theme: "light",
  fontSize: 12,
  density: "comfortable",
  notifications: true,
  notificationPreview: true,
  sound: true,
  alwaysOnTop: false,
  startAtLogin: false,
  enterToSend: true,
  autoLogin: false,
};

function loadSettings(): MessengerSettings {
  try {
    const loaded = {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("srgh_settings") ?? "{}"),
    };
    if (typeof loaded.fontSize !== "number")
      loaded.fontSize =
        loaded.fontSize === "small"
          ? 10
          : loaded.fontSize === "large"
            ? 14
            : 12;
    loaded.fontSize = Math.min(20, Math.max(6, loaded.fontSize));
    return loaded;
  } catch {
    return defaultSettings;
  }
}

function loadFavoriteIds(): number[] {
  try {
    const value = JSON.parse(
      localStorage.getItem("srgh_favorite_employees") ?? "[]",
    );
    return Array.isArray(value) ? value.filter(Number.isInteger) : [];
  } catch {
    return [];
  }
}

function saveFavoriteIds(ids: number[]) {
  localStorage.setItem("srgh_favorite_employees", JSON.stringify(ids));
  window.dispatchEvent(
    new CustomEvent("srgh-favorites-changed", { detail: ids }),
  );
}

function Avatar({
  name,
  index = 0,
  online = false,
  color,
  image,
  availability,
  onClick,
}: {
  name: string;
  index?: number;
  online?: boolean;
  color?: string;
  image?: string;
  availability?: Employee["availability"];
  onClick?: () => void;
}) {
  const presence = !online
    ? "offline"
    : (availability?.toLowerCase() ?? "online");
  return (
    <div
      className={`avatar ${onClick ? "clickable-avatar" : ""}`}
      style={{ background: color ?? "#72cbd8" }}
      aria-label={`${name} 프로필`}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={(event) => {
        if (onClick) {
          event.stopPropagation();
          onClick();
        }
      }}
      onKeyDown={(event) => {
        if (onClick && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {image ? (
        <img src={image} alt="" />
      ) : (
        <UserRound className="default-avatar-icon" aria-hidden="true" />
      )}
      {(online || availability) && (
        <span className={`presence-dot ${presence}`} />
      )}
    </div>
  );
}

function EmployeeDetailModal({
  employee,
  favorite,
  self = false,
  onFavorite,
  onEdit,
  onChat,
  onClose,
}: {
  employee: Employee;
  favorite: boolean;
  self?: boolean;
  onFavorite: () => void;
  onEdit?: () => void;
  onChat: () => void;
  onClose: () => void;
}) {
  const availabilityLabel =
    !employee.online || employee.availability === "OFFLINE"
      ? "오프라인"
      : employee.availability === "AWAY"
        ? "자리 비움"
        : employee.availability === "BUSY"
          ? "다른 용무 중"
          : "온라인";
  return (
    <div
      className="modal-backdrop employee-detail-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="employee-detail-card">
        <button
          className="modal-close"
          onClick={onClose}
          aria-label="상세정보 닫기"
        >
          <X />
        </button>
        <div className="employee-detail-hero">
          <Avatar
            name={employee.name}
            color={employee.avatarColor}
            image={employee.avatarImage}
            online={employee.online}
            availability={employee.availability}
          />
          <h2>
            {employee.name}{" "}
            {employee.position && <small>{employee.position}</small>}
          </h2>
          <p>{employee.statusMessage || "상태 메시지가 없습니다."}</p>
          <span>
            <i
              className={`profile-presence ${employee.online ? (employee.availability?.toLowerCase() ?? "online") : "offline"}`}
            />
            {availabilityLabel}
          </span>
        </div>
        <dl>
          <div>
            <dt>부서</dt>
            <dd>{employee.departmentName || "-"}</dd>
          </div>
          <div>
            <dt>직책</dt>
            <dd>{employee.position || "-"}</dd>
          </div>
          <div>
            <dt>사번</dt>
            <dd>{employee.employeeNumber || "-"}</dd>
          </div>
          <div>
            <dt>내선번호</dt>
            <dd>{employee.extensionNumber || "-"}</dd>
          </div>
        </dl>
        <footer>
          <button
            className={favorite && !self ? "favorite-active" : ""}
            onClick={self ? onEdit : onFavorite}
          >
            {self ? <Settings /> : <Star />}
            {self ? "정보 수정하기" : favorite ? "즐겨찾기 해제" : "즐겨찾기"}
          </button>
          <button className="primary" onClick={onChat}>
            <MessageCircleMore />
            대화하기
          </button>
        </footer>
      </section>
    </div>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    <>
      {text
        .split(new RegExp(`(${escaped})`, "ig"))
        .map((part, index) =>
          part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark key={index}>{part}</mark>
          ) : (
            part
          ),
        )}
    </>
  );
}

function Attachment({ file }: { file: FileInfo }) {
  const [url, setUrl] = useState("");
  const [videoError, setVideoError] = useState(false);
  const extension = file.originalName.split(".").pop()?.toLowerCase() ?? "";
  const isImage =
    file.contentType.startsWith("image/") ||
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "bmp",
      "svg",
      "heic",
      "heif",
    ].includes(extension);
  const isVideo =
    file.contentType.startsWith("video/") ||
    [
      "mp4",
      "mov",
      "m4v",
      "avi",
      "mkv",
      "webm",
      "wmv",
      "flv",
      "mpg",
      "mpeg",
      "3gp",
      "3g2",
      "ts",
      "mts",
      "m2ts",
      "ogv",
    ].includes(extension);
  useEffect(() => {
    if (!isImage && !isVideo) return;
    let active = true;
    let objectUrl = "";
    void fetchAttachment(file.downloadUrl).then((blob) => {
      objectUrl = URL.createObjectURL(blob);
      if (active) setUrl(objectUrl);
    });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file.downloadUrl, isImage, isVideo]);
  const download = async () => {
    const blob = await fetchAttachment(file.downloadUrl);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = file.originalName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  if (isImage)
    return (
      <button
        className="attachment-preview image-attachment"
        onClick={() => void download()}
      >
        {url ? (
          <img src={url} alt={file.originalName} />
        ) : (
          <span>이미지 불러오는 중...</span>
        )}
        <div className="attachment-name-row">
          <strong title={file.originalName}>{file.originalName}</strong>
          <Download />
        </div>
      </button>
    );
  if (isVideo)
    return (
      <div className="attachment-preview video-attachment">
        {url && !videoError ? (
          <video
            src={url}
            controls
            preload="metadata"
            onError={() => setVideoError(true)}
          />
        ) : (
          <span>
            {videoError
              ? "이 형식은 미리보기를 지원하지 않습니다."
              : "동영상 불러오는 중..."}
          </span>
        )}
        <div className="attachment-name-row">
          <strong title={file.originalName}>{file.originalName}</strong>
          <button
            onClick={() => void download()}
            aria-label="동영상 저장"
            title="저장"
          >
            <Download />
          </button>
        </div>
      </div>
    );
  return (
    <button className="document-attachment" onClick={() => void download()}>
      <span>
        <FileText />
      </span>
      <div>
        <strong title={file.originalName}>{file.originalName}</strong>
        <small>{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</small>
      </div>
      <Download />
    </button>
  );
}

function PendingAttachment({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const image =
    file.type.startsWith("image/") ||
    ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(extension);
  const video =
    file.type.startsWith("video/") ||
    [
      "mp4",
      "mov",
      "m4v",
      "avi",
      "mkv",
      "webm",
      "wmv",
      "flv",
      "mpg",
      "mpeg",
      "3gp",
      "3g2",
      "ts",
      "mts",
      "m2ts",
      "ogv",
    ].includes(extension);
  useEffect(() => {
    if (!image && !video) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, image, video]);
  return (
    <div className="pending-attachment">
      <div className="pending-file-preview">
        {previewUrl && image ? (
          <img src={previewUrl} alt="" />
        ) : previewUrl && video ? (
          <video src={previewUrl} muted preload="metadata" />
        ) : (
          <FileText />
        )}
      </div>
      <span>
        <strong>{file.name}</strong>
        <small>
          {(file.size / 1024 / 1024).toFixed(1)} MB · 보내기 버튼을 누르면
          전송됩니다.
        </small>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="첨부 취소"
        title="첨부 취소"
      >
        <X />
      </button>
    </div>
  );
}

function DesktopTitleBar() {
  return (
    <header className="desktop-titlebar">
      <div className="desktop-title">
        <span className="titlebar-logo">S</span>
        <span className="titlebar-name">사랑톡</span>
        <span className="titlebar-hospital">사랑의병원 업무 메신저</span>
      </div>
      <div className="window-controls">
        <button
          type="button"
          onClick={() => window.srghDesktop?.minimize()}
          aria-label="최소화"
          title="최소화"
        >
          <span className="minimize-symbol" />
        </button>
        <button
          type="button"
          className="close-window"
          onClick={() => window.srghDesktop?.close()}
          aria-label="닫기"
          title="닫기"
        >
          <span className="close-symbol" />
        </button>
      </div>
    </header>
  );
}

function SettingsModal({
  value,
  onChange,
  onAutoLoginDisabled,
  onClose,
}: {
  value: MessengerSettings;
  onChange: (next: MessengerSettings) => void;
  onAutoLoginDisabled: () => void;
  onClose: () => void;
}) {
  const update = <K extends keyof MessengerSettings>(
    key: K,
    nextValue: MessengerSettings[K],
  ) => {
    onChange({ ...value, [key]: nextValue });
    if (key === "autoLogin" && nextValue === false) {
      void window.srghDesktop?.clearCredentials();
      onAutoLoginDisabled();
    }
  };
  return (
    <div
      className="modal-backdrop settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-label="사랑톡 설정"
      >
        <header>
          <div>
            <span>환경 설정</span>
            <h2>사랑톡 설정</h2>
          </div>
          <button onClick={onClose} aria-label="설정 닫기">
            <X />
          </button>
        </header>
        <div className="settings-content">
          <section className="settings-section">
            <h3>화면</h3>
            <p>사용 환경에 맞게 화면 모양을 조절합니다.</p>
            <div className="theme-options">
              {(
                [
                  ["light", Sun, "라이트"],
                  ["dark", Moon, "다크"],
                  ["system", Monitor, "시스템"],
                ] as const
              ).map(([theme, Icon, label]) => (
                <button
                  key={theme}
                  className={value.theme === theme ? "selected" : ""}
                  onClick={() => update("theme", theme)}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          <label className="setting-select font-size-setting">
              <span>
                <b>글자 크기</b>
                <small>6~20 사이 숫자로 지정</small>
              </span>
            <span className="font-size-control">
              <button type="button" onClick={() => update("fontSize", Math.max(6, value.fontSize - 1))} aria-label="글자 크기 줄이기">−</button>
              <input className="font-size-input" type="number" min="6" max="20" value={value.fontSize}
                onChange={(e) => update("fontSize", Math.min(20, Math.max(6, Number(e.target.value) || 6)))} />
              <b>px</b>
              <button type="button" onClick={() => update("fontSize", Math.min(20, value.fontSize + 1))} aria-label="글자 크기 키우기">+</button>
            </span>
            </label>
            <label className="setting-select">
              <span>
                <b>목록 간격</b>
                <small>한 화면에 표시할 직원과 대화 수</small>
              </span>
              <select
                value={value.density}
                onChange={(e) =>
                  update(
                    "density",
                    e.target.value as MessengerSettings["density"],
                  )
                }
              >
                <option value="comfortable">여유롭게</option>
                <option value="compact">촘촘하게</option>
              </select>
            </label>
          </section>
          <section className="settings-section">
            <h3>알림 및 메시지</h3>
            <label className="setting-row">
              <span>
                <Bell />
                <span>
                  <b>새 메시지 알림</b>
                  <small>다른 창을 보고 있을 때 알림 표시</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.notifications}
                onChange={(e) => update("notifications", e.target.checked)}
              />
            </label>
            <label className="setting-row">
              <span>
                <MessageCircleMore />
                <span>
                  <b>알림에 메시지 내용 표시</b>
                  <small>끄면 보낸 사람과 새 메시지 도착만 표시</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.notificationPreview}
                disabled={!value.notifications}
                onChange={(e) =>
                  update("notificationPreview", e.target.checked)
                }
              />
            </label>
            <label className="setting-row">
              <span>
                <Volume2 />
                <span>
                  <b>알림 소리</b>
                  <small>새 메시지 알림음 사용</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.sound}
                disabled={!value.notifications}
                onChange={(e) => update("sound", e.target.checked)}
              />
            </label>
            <label className="setting-row">
              <span>
                <Send />
                <span>
                  <b>Enter로 전송</b>
                  <small>끄면 Ctrl + Enter로 전송</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.enterToSend}
                onChange={(e) => update("enterToSend", e.target.checked)}
              />
            </label>
          </section>
          <section className="settings-section">
            <h3>창 및 실행</h3>
            <label className="setting-row">
              <span>
                <Monitor />
                <span>
                  <b>항상 위에 표시</b>
                  <small>사랑톡 창을 다른 창보다 위에 유지</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.alwaysOnTop}
                onChange={(e) => update("alwaysOnTop", e.target.checked)}
              />
            </label>
            <label className="setting-row">
              <span>
                <Settings />
                <span>
                  <b>Windows 시작 시 실행</b>
                  <small>로그인할 때 사랑톡 자동 실행</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.startAtLogin}
                onChange={(e) => update("startAtLogin", e.target.checked)}
              />
            </label>
            <label className="setting-row">
              <span>
                <ShieldCheck />
                <span>
                  <b>자동 로그인</b>
                  <small>암호화해 둔 이전 로그인 정보로 자동 접속</small>
                </span>
              </span>
              <input
                type="checkbox"
                checked={value.autoLogin}
                onChange={(e) => update("autoLogin", e.target.checked)}
              />
            </label>
          </section>
        </div>
        <footer>
          <span>설정은 자동으로 저장됩니다.</span>
          <button onClick={onClose}>완료</button>
        </footer>
      </section>
    </div>
  );
}

type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest;
  onClose: () => void;
}) {
  const [working, setWorking] = useState(false);
  const confirm = async () => {
    setWorking(true);
    try {
      await request.onConfirm();
      onClose();
    } finally {
      setWorking(false);
    }
  };
  return (
    <div
      className="modal-backdrop confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !working) onClose();
      }}
    >
      <section
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className={`confirm-icon ${request.danger ? "danger" : ""}`}>
          {request.danger ? <Trash2 /> : <LogOut />}
        </div>
        <div className="confirm-copy">
          <h3 id="confirm-title">{request.title}</h3>
          <p>{request.message}</p>
        </div>
        <footer>
          <button className="secondary" disabled={working} onClick={onClose}>
            취소
          </button>
          <button
            className={request.danger ? "danger" : ""}
            disabled={working}
            onClick={() => void confirm()}
          >
            {working ? "처리 중..." : (request.confirmLabel ?? "확인")}
          </button>
        </footer>
      </section>
    </div>
  );
}

function NoticeModal({
  me,
  employees,
  notices,
  onNoticesChange,
  onClose,
}: {
  me: Employee;
  employees: Employee[];
  notices: Notice[];
  onNoticesChange: (notices: Notice[]) => void;
  onClose: () => void;
}) {
  const [content, setContent] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [file, setFile] = useState<File>();
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectNotice = async (notice: Notice) => {
    if (!notice.read && notice.senderId !== me.id) {
      await api.readNotice(notice.id);
      onNoticesChange(
        notices.map((item) =>
          item.id === notice.id ? { ...item, read: true } : item,
        ),
      );
    }
  };
  const sendNotice = async () => {
    if ((!content.trim() && !file) || selectedIds.length === 0 || sending)
      return;
    setSending(true);
    try {
      const sent = await api.sendNotice("쪽지", content, selectedIds, file);
      onNoticesChange([sent, ...notices]);
      setContent("");
      setSelectedIds([]);
      setFile(undefined);
    } finally {
      setSending(false);
    }
  };
  const download = async (notice: Notice) => {
    if (!notice.file) return;
    const blob = await fetchAttachment(notice.file.downloadUrl);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = notice.file.originalName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="modal-backdrop notice-backdrop">
      <section
        className="notice-modal"
        role="dialog"
        aria-modal="true"
        aria-label="쪽지"
      >
        <header>
          <div>
            <Mail />
            <span>
              <small>사랑의병원</small>
              <h2>쪽지</h2>
            </span>
          </div>
          <button onClick={onClose} aria-label="쪽지 닫기">
            <X />
          </button>
        </header>
        <div className="notice-layout">
          <section className="notice-compose">
            <h3>새 쪽지 보내기</h3>
            <p>선택한 직원에게만 전달되는 단방향 쪽지입니다.</p>
            <div className="notice-targets">
              {employees
                .filter((employee) => employee.id !== me.id)
                .map((employee) => (
                  <label
                    key={employee.id}
                    className={
                      selectedIds.includes(employee.id) ? "selected" : ""
                    }
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(employee.id)}
                      onChange={() =>
                        setSelectedIds((ids) =>
                          ids.includes(employee.id)
                            ? ids.filter((id) => id !== employee.id)
                            : [...ids, employee.id],
                        )
                      }
                    />
                    <Avatar
                      name={employee.name}
                      image={employee.avatarImage}
                      color={employee.avatarColor}
                    />
                    <span>
                      <b>
                        {employee.name} {employee.position}
                      </b>
                      <small>{employee.departmentName}</small>
                    </span>
                  </label>
                ))}
            </div>
            <textarea
              className="scrollable notice-compose-textarea"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="쪽지 메시지를 입력하세요"
            />
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={(event) => setFile(event.target.files?.[0])}
            />
            {file && (
              <div className="notice-file">
                <FileText />
                <span>{file.name}</span>
                <button onClick={() => setFile(undefined)}>
                  <X />
                </button>
              </div>
            )}
            <div className="notice-compose-actions">
              <button onClick={() => fileRef.current?.click()}>
                <Paperclip /> 파일
              </button>
              <button
                className="primary"
                disabled={
                  sending ||
                  selectedIds.length === 0 ||
                  (!content.trim() && !file)
                }
                onClick={() => void sendNotice()}
              >
                <Send /> 보내기
              </button>
            </div>
          </section>
          <section className="notice-list">
            <h3>받은 쪽지 및 보낸 쪽지</h3>
            {notices.length === 0 ? (
              <div className="notice-empty">
                <Mail />
                <p>아직 쪽지가 없습니다.</p>
              </div>
            ) : (
              notices.map((notice) => (
                <article
                  key={notice.id}
                  className={
                    !notice.read && notice.senderId !== me.id ? "unread" : ""
                  }
                  onClick={() => void selectNotice(notice)}
                >
                  <div>
                    <Avatar name={notice.senderName} />
                    <span>
                      <strong>
                        {notice.senderId === me.id
                          ? "내가 보낸 쪽지"
                          : notice.senderName}
                      </strong>
                      <time>{time(notice.sentAt)}</time>
                    </span>
                    {!notice.read && notice.senderId !== me.id && <i />}
                  </div>
                  {notice.content && <p>{notice.content}</p>}
                  {notice.file && (
                    <button
                      className="notice-download"
                      onClick={(event) => {
                        event.stopPropagation();
                        void download(notice);
                      }}
                    >
                      <FileText />
                      <span>
                        <b>{notice.file.originalName}</b>
                        <small>클릭하여 다운로드</small>
                      </span>
                      <Download />
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      </section>
    </div>
  );
}

async function downloadNoticeFile(notice: Notice) {
  if (!notice.file) return;
  const blob = await fetchAttachment(notice.file.downloadUrl);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = notice.file.originalName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function NoticeHome({
  me,
  notices,
  onRead,
}: {
  me: Employee;
  notices: Notice[];
  onRead: (notice: Notice) => void;
}) {
  const visibleNotices = notices;
  const received = notices.filter((notice) => notice.senderId !== me.id);
  const canWrite = me.role === "ADMIN" || me.role === "NOTICE_WRITER";
  return (
    <section className="notice-home">
      <header>
        <div>
          <h1>쪽지</h1>
          <p>중요한 업무 소식과 전달 사항을 확인하세요.</p>
        </div>
        {canWrite && (
          <button
            className="round-button notice-compose-button"
            title="쪽지 작성"
            aria-label="쪽지 작성"
            onClick={() => window.srghDesktop?.composeNotice()}
          >
            <Plus />
          </button>
        )}
      </header>
      <div className="notice-home-toolbar">
        <strong>받은 쪽지 및 보낸 쪽지</strong>
        <span>
          읽지 않음 {received.filter((notice) => !notice.read).length}
        </span>
      </div>
      <div className="notice-home-list">
        {visibleNotices.length === 0 ? (
          <div className="notice-empty">
            <Mail />
            <p>쪽지가 없습니다.</p>
          </div>
        ) : (
          visibleNotices.map((notice) => (
            <article
              key={notice.id}
              className={!notice.read ? "unread" : ""}
              onDoubleClick={() => {
                onRead(notice);
                window.srghDesktop?.openNotice(notice.id);
              }}
              title="더블클릭하여 쪽지 열기"
            >
              <Avatar name={notice.senderName} />
              <div>
                <strong>
                  {notice.title}
                  {notice.senderId === me.id ? (
                    <i>보낸 쪽지</i>
                  ) : (
                    !notice.read && <i>새 쪽지</i>
                  )}
                </strong>
                <p>{notice.content || notice.file?.originalName}</p>
                <span>
                  {notice.senderName} · {messageDate(notice.sentAt)} ·{" "}
                  {time(notice.sentAt)}
                </span>
              </div>
              {notice.file && <FileText />}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NoticeDetailWindow({
  me,
  noticeId,
}: {
  me: Employee;
  noticeId: number;
}) {
  const [notice, setNotice] = useState<Notice>();
  useEffect(() => {
    void api.notices().then((items) => {
      const found = items.find((item) => item.id === noticeId);
      setNotice(found);
      if (found && !found.read && found.senderId !== me.id)
        void api.readNotice(found.id);
    });
  }, [me.id, noticeId]);
  return (
    <main className="notice-subwindow">
      <header>
        <button onClick={() => window.srghDesktop?.close()}>
          <ArrowLeft />
        </button>
        <div>
          <h2>{notice?.title ?? "쪽지 불러오는 중"}</h2>
        </div>
      </header>
      {notice && (
        <article className="notice-detail-card">
          <div className="notice-detail-sender">
            <Avatar name={notice.senderName} />
            <span>
              <strong>
                {notice.senderName} {notice.senderPosition}
              </strong>
              <small>{notice.senderDepartment}</small>
              <time>
                {messageDate(notice.sentAt)} {time(notice.sentAt)}
              </time>
            </span>
          </div>
          <div className="notice-reference">
            <b>받은 사람</b>
            <span>{notice.recipients.join(", ")}</span>
          </div>
          {notice.content && <p>{notice.content}</p>}
          {notice.file && (
            <button onClick={() => void downloadNoticeFile(notice)}>
              <FileText />
              <span>
                <b>{notice.file.originalName}</b>
                <small>클릭하여 다운로드</small>
              </span>
              <Download />
            </button>
          )}
        </article>
      )}
    </main>
  );
}

function NoticeComposeWindow({ me }: { me: Employee }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File>();
  const [sending, setSending] = useState(false);
  const [recipientsCollapsed, setRecipientsCollapsed] = useState(false);
  const [collapsedDepartmentIds, setCollapsedDepartmentIds] = useState<
    Set<number>
  >(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    void Promise.all([
      api.employees().then(setEmployees),
      api.departments().then(setDepartments),
    ]);
  }, []);
  const toggleDepartment = (departmentId: number) => {
    const ids = employees
      .filter(
        (employee) =>
          employee.id !== me.id && employee.departmentId === departmentId,
      )
      .map((employee) => employee.id);
    const allSelected =
      ids.length > 0 && ids.every((id) => selectedIds.includes(id));
    setSelectedIds((current) =>
      allSelected
        ? current.filter((id) => !ids.includes(id))
        : [...new Set([...current, ...ids])],
    );
  };
  const toggleDepartmentCollapsed = (departmentId: number) => {
    setCollapsedDepartmentIds((current) => {
      const next = new Set(current);
      next.has(departmentId)
        ? next.delete(departmentId)
        : next.add(departmentId);
      return next;
    });
  };
  const send = async () => {
    if (sending || selectedIds.length === 0 || (!content.trim() && !file))
      return;
    setSending(true);
    try {
      await api.sendNotice(title, content, selectedIds, file);
      window.srghDesktop?.close();
    } finally {
      setSending(false);
    }
  };
  return (
    <main className="notice-subwindow notice-compose-window">
      <header>
        <button onClick={() => window.srghDesktop?.close()}>
          <ArrowLeft />
        </button>
        <div>
          <h2>쪽지 작성</h2>
        </div>
      </header>
      <div className="notice-compose-body">
        <section
          className={`notice-recipient-section ${recipientsCollapsed ? "collapsed" : ""}`}
        >
          <h3>
            <button
              onClick={() => setRecipientsCollapsed((collapsed) => !collapsed)}
              aria-expanded={!recipientsCollapsed}
            >
              <span>
                참고인 <b>{selectedIds.length}명</b>
              </span>
              {recipientsCollapsed ? <ChevronDown /> : <ChevronUp />}
            </button>
          </h3>
          {!recipientsCollapsed && (
            <div className="department-select-list scrollable">
              {departments.map((department) => {
                const members = employees.filter(
                  (employee) =>
                    employee.id !== me.id &&
                    employee.departmentId === department.id,
                );
                const checked =
                  members.length > 0 &&
                  members.every((employee) =>
                    selectedIds.includes(employee.id),
                  );
                const collapsed = collapsedDepartmentIds.has(department.id);
                return (
                  <div key={department.id}>
                    <div className="department-select-head">
                      <button
                        className={checked ? "selected" : ""}
                        onClick={() => toggleDepartment(department.id)}
                        title={`${department.name} 전체 선택`}
                      >
                        <Building2 />
                        <strong>{department.name}</strong>
                        <span>{members.length}명</span>
                        <i>{checked ? "✓" : ""}</i>
                      </button>
                      <button
                        className="department-collapse-button"
                        onClick={() => toggleDepartmentCollapsed(department.id)}
                        aria-expanded={!collapsed}
                        aria-label={`${department.name} ${collapsed ? "펼치기" : "접기"}`}
                      >
                        {collapsed ? <ChevronDown /> : <ChevronUp />}
                      </button>
                    </div>
                    {!collapsed &&
                      members.map((employee) => (
                        <label key={employee.id}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(employee.id)}
                            onChange={() =>
                              setSelectedIds((ids) =>
                                ids.includes(employee.id)
                                  ? ids.filter((id) => id !== employee.id)
                                  : [...ids, employee.id],
                              )
                            }
                          />
                          <Avatar
                            name={employee.name}
                            image={employee.avatarImage}
                            color={employee.avatarColor}
                          />
                          <span>
                            <b>
                              {employee.name} {employee.position}
                            </b>
                            <small>{employee.departmentName}</small>
                          </span>
                        </label>
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </section>
        <section className="notice-message-editor scrollable">
          <h3>쪽지 제목</h3>
          <input
            className="notice-title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="쪽지 제목을 입력하세요"
            maxLength={200}
          />
          <h3>쪽지 내용</h3>
          <textarea
            className="scrollable notice-compose-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="쪽지 메시지를 입력하세요"
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          {file && (
            <div className="notice-file">
              <FileText />
              <span>{file.name}</span>
              <button onClick={() => setFile(undefined)}>
                <X />
              </button>
            </div>
          )}
          <div>
            <button onClick={() => fileRef.current?.click()}>
              <Paperclip /> 파일 첨부
            </button>
            <button
              className="primary"
              disabled={
                sending ||
                !title.trim() ||
                selectedIds.length === 0 ||
                (!content.trim() && !file)
              }
              onClick={() => void send()}
            >
              <Send /> 보내기
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileModal({
  employee,
  onSaved,
  onClose,
}: {
  employee: Employee;
  onSaved: (employee: Employee) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: employee.name,
    extensionNumber: employee.extensionNumber ?? "",
    statusMessage: employee.statusMessage ?? "",
    availability: employee.availability ?? "ONLINE",
    avatarImage: employee.avatarImage ?? "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);
  const selectPhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new window.Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = imageUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error();
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      const x = (image.naturalWidth - size) / 2;
      const y = (image.naturalHeight - size) / 2;
      context.drawImage(image, x, y, size, size, 0, 0, 256, 256);
      setForm((current) => ({
        ...current,
        avatarImage: canvas.toDataURL("image/jpeg", 0.84),
      }));
      setError("");
    } catch {
      setError("프로필 사진을 처리하지 못했습니다.");
    } finally {
      URL.revokeObjectURL(imageUrl);
      if (photoRef.current) photoRef.current.value = "";
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api.updateMe({
        name: form.name,
        extensionNumber: form.extensionNumber,
        statusMessage: form.statusMessage,
        availability: form.availability,
        avatarImage: form.avatarImage || null,
        currentPassword: form.currentPassword || null,
        newPassword: form.newPassword || null,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "프로필을 저장하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="modal-backdrop profile-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="profile-modal" onSubmit={submit}>
        <header>
          <div>
            <span>MY PROFILE</span>
            <h2>내 정보 관리</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="프로필 닫기">
            <X />
          </button>
        </header>
        <div className="profile-content">
          <section className="profile-preview">
            <Avatar
              name={form.name || employee.name}
              color={employee.avatarColor}
              image={form.avatarImage}
              online
              availability={form.availability}
            />
            <div>
              <strong>{form.name || employee.name}</strong>
              <span>
                {employee.departmentName} · {employee.position || "직책 미설정"}
              </span>
              {form.statusMessage && <em>{form.statusMessage}</em>}
            </div>
          </section>
          <section className="profile-section">
            <h3>기본 정보</h3>
            <div className="profile-grid">
              <label>
                <span>이름</span>
                <input
                  required
                  maxLength={50}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                <span>사번</span>
                <input value={employee.employeeNumber} disabled />
              </label>
              <label>
                <span>부서</span>
                <input
                  value={employee.departmentName ?? "부서 미지정"}
                  disabled
                />
              </label>
              <label>
                <span>직책</span>
                <input value={employee.position ?? "직책 미설정"} disabled />
              </label>
              <label>
                <span>내선번호</span>
                <input
                  maxLength={20}
                  placeholder="예: 1234"
                  value={form.extensionNumber}
                  onChange={(e) =>
                    setForm({ ...form, extensionNumber: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="profile-wide">
              <span>상태 메시지</span>
              <input
                maxLength={120}
                placeholder="현재 업무 상태나 안내 문구"
                value={form.statusMessage}
                onChange={(e) =>
                  setForm({ ...form, statusMessage: e.target.value })
                }
              />
            </label>
          </section>
          <section className="profile-section">
            <h3>접속 상태</h3>
            <div className="availability-options">
              {[
                ["ONLINE", "온라인", "업무 가능"],
                ["BUSY", "다른 용무 중", "긴급 연락만"],
                ["AWAY", "자리 비움", "응답 지연"],
                ["OFFLINE", "오프라인", "알림 최소화"],
              ].map(([value, label, help]) => (
                <button
                  type="button"
                  key={value}
                  className={
                    form.availability === value
                      ? `selected availability-${value.toLowerCase()}`
                      : ""
                  }
                  onClick={() =>
                    setForm({
                      ...form,
                      availability: value as
                        "ONLINE" | "BUSY" | "AWAY" | "OFFLINE",
                    })
                  }
                >
                  <i />
                  <span>
                    <b>{label}</b>
                    <small>{help}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="profile-section profile-appearance">
            <h3>프로필 이미지</h3>
            <div className="profile-photo-setting">
              <Avatar
                name={form.name || employee.name}
                color={employee.avatarColor}
                image={form.avatarImage}
              />
              <div>
                <b>프로필 사진</b>
                <small>사진이 없으면 기본 프로필 그림으로 표시됩니다.</small>
              </div>
              <div className="profile-photo-actions">
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  hidden
                  onChange={(e) => void selectPhoto(e.target.files?.[0])}
                />
                <button type="button" onClick={() => photoRef.current?.click()}>
                  {form.avatarImage ? "사진 변경" : "사진 등록"}
                </button>
                {form.avatarImage && (
                  <button
                    type="button"
                    className="remove-photo"
                    onClick={() => setForm({ ...form, avatarImage: "" })}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </section>
          <section className="profile-section">
            <h3>
              비밀번호 변경 <small>변경할 때만 입력하세요.</small>
            </h3>
            <div className="profile-grid password-grid">
              <label>
                <span>현재 비밀번호</span>
                <input
                  type="password"
                  value={form.currentPassword}
                  onChange={(e) =>
                    setForm({ ...form, currentPassword: e.target.value })
                  }
                />
              </label>
              <label>
                <span>새 비밀번호</span>
                <input
                  type="password"
                  minLength={4}
                  value={form.newPassword}
                  onChange={(e) =>
                    setForm({ ...form, newPassword: e.target.value })
                  }
                />
              </label>
              <label>
                <span>새 비밀번호 확인</span>
                <input
                  type="password"
                  minLength={4}
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                />
              </label>
            </div>
          </section>
          {error && <p className="profile-error">{error}</p>}
        </div>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            취소
          </button>
          <button disabled={saving}>
            {saving ? "저장 중..." : "변경사항 저장"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (employee: Employee) => void }) {
  const rememberedId =
    localStorage.getItem("srgh_remembered_employee_number") ?? "";
  const [employeeNumber, setNumber] = useState(rememberedId);
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(Boolean(rememberedId));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.login(employeeNumber, password);
      session.token = result.token;
      if (rememberId)
        localStorage.setItem(
          "srgh_remembered_employee_number",
          employeeNumber.trim(),
        );
      else localStorage.removeItem("srgh_remembered_employee_number");
      await window.srghDesktop?.saveCredentials(
        employeeNumber.trim(),
        password,
      );
      onLogin(result.employee);
    } catch (e) {
      setError(e instanceof Error ? e.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            S<span>+</span>
          </div>
          <div>
            <b>사랑톡</b>
            <span>사랑의병원 업무 메신저</span>
          </div>
        </div>
        <div className="login-copy">
          <span>WELCOME</span>
          <h1>
            안전하고 빠른
            <br />
            병원 업무 소통
          </h1>
          <p>직원 전용 계정으로 로그인해 주세요.</p>
        </div>
        <form onSubmit={submit}>
          <label>
            사번
            <input
              value={employeeNumber}
              onChange={(e) => setNumber(e.target.value)}
              autoFocus
            />
          </label>
          <label>
            비밀번호
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="remember-id">
            <span>
              <input
                type="checkbox"
                checked={rememberId}
                onChange={(e) => setRememberId(e.target.checked)}
              />
              로그인 ID 기억하기
            </span>
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="demo-hint">체험 계정 · 사번 1001 / 비밀번호 1234</p>
      </section>
    </main>
  );
}

function NewRoomModal({
  employees,
  rooms,
  meId,
  onClose,
  onCreated,
}: {
  employees: Employee[];
  rooms: Room[];
  meId: number;
  onClose: () => void;
  onCreated: (r: Room) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const filteredEmployees = employees.filter((employee) =>
    `${employee.name} ${employee.departmentName ?? ""} ${employee.position ?? ""} ${employee.employeeNumber}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const create = async () => {
    if (!selected.length) return;
    const participantIds = new Set([meId, ...selected]);
    const existing = rooms.find(
      (room) =>
        room.members.length === participantIds.size &&
        room.members.every((member) => participantIds.has(member.id)),
    );
    onCreated(existing ?? (await api.createRoom("", selected)));
    onClose();
  };
  return (
    <div className="modal-backdrop">
      <section className="modal new-room-modal">
        <header>
          <div><span>NEW CHAT</span><h3>새 대화 시작</h3><p>이름이나 부서로 대화 상대를 찾아보세요.</p></div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        <div className="modal-search">
          <Search />
          <input
            className="modal-input"
            autoFocus
            placeholder="이름, 부서, 직책으로 상대방 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.length > 0 && <div className="selected-people">
          {selected.map((id) => {
            const employee = employees.find((item) => item.id === id);
            return employee ? <button key={id} onClick={() => setSelected((current) => current.filter((item) => item !== id))}><Avatar name={employee.name} image={employee.avatarImage} color={employee.avatarColor} /><span>{employee.name}</span><X /></button> : null;
          })}
        </div>}
        <p className="section-label">
          검색 결과 <b>{filteredEmployees.length}</b><span>{selected.length ? `${selected.length}명 선택` : "상대를 선택해 주세요"}</span>
        </p>
        <div className="select-people">
          {!filteredEmployees.length && <div className="empty-people-search"><Search /><strong>검색 결과가 없습니다</strong><span>이름, 부서, 직책 또는 사번을 확인해 주세요.</span></div>}
          {filteredEmployees.map((e, i) => (
              <label
                key={e.id}
                className={selected.includes(e.id) ? "checked" : ""}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(e.id)}
                  onChange={() =>
                    setSelected((s) =>
                      s.includes(e.id)
                        ? s.filter((id) => id !== e.id)
                        : [...s, e.id],
                    )
                  }
                />
                <Avatar
                  name={e.name}
                  index={i}
                  online={e.online}
                  availability={e.availability}
                  color={e.avatarColor}
                  image={e.avatarImage}
                />
                <span>
                  <strong>
                    {e.name}{" "}
                    {e.position && (
                      <small className="position-label">{e.position}</small>
                    )}
                  </strong>
                  {e.statusMessage && <em>{e.statusMessage}</em>}
                  {!e.statusMessage && <em>{e.departmentName || "부서 미지정"}</em>}
                </span>
                <i className="person-check">✓</i>
              </label>
            ))}
        </div>
        <footer>
          <button className="secondary" onClick={onClose}>
            취소
          </button>
          <button onClick={create} disabled={!selected.length}>
            대화 시작
          </button>
        </footer>
      </section>
    </div>
  );
}

function AdminPanel({ onClose }: { onClose: () => void }) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [form, setForm] = useState({
    employeeNumber: "",
    name: "",
    position: "",
    departmentId: "",
    password: "1234",
    role: "USER",
  });
  const [editingId, setEditingId] = useState<number>();
  const [editForm, setEditForm] = useState({
    position: "",
    departmentId: "",
    role: "USER",
    extensionNumber: "",
  });
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const refresh = useCallback(
    () =>
      Promise.all([
        api.adminStats(),
        api.adminEmployees(),
        api.departments(),
      ]).then(([s, e, d]) => {
        setStats(s);
        setEmployees(e);
        setDepartments(d);
      }),
    [],
  );
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      await api.createEmployee({
        ...form,
        role: form.role as Employee["role"],
        departmentId: Number(form.departmentId) || null,
      });
      setForm({ employeeNumber: "", name: "", position: "", departmentId: "", password: "1234", role: "USER" });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "직원 계정을 생성하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };
  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setEditForm({
      position: employee.position ?? "",
      departmentId: employee.departmentId?.toString() ?? "",
      role: employee.role,
      extensionNumber: employee.extensionNumber ?? "",
    });
  };
  const saveEmployee = async (employee: Employee) => {
    setError("");
    setWorking(true);
    try {
      const updated = await api.updateEmployee(employee.id, {
        employeeNumber: employee.employeeNumber,
        name: employee.name,
        position: editForm.position,
        departmentId: Number(editForm.departmentId) || null,
        role: editForm.role as Employee["role"],
        status: employee.status,
        extensionNumber: editForm.extensionNumber,
      });
      setEmployees((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEditingId(undefined);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "직원 권한을 변경하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  };
  const removeEmployee = async (employee: Employee) => {
    setConfirmRequest({
      title: "직원을 삭제하시겠습니까?",
      message: `${employee.name} 직원의 기존 대화 기록은 보존되지만 해당 계정으로는 더 이상 로그인할 수 없습니다.`,
      confirmLabel: "직원 삭제",
      danger: true,
      onConfirm: async () => {
        await api.deleteEmployee(employee.id);
        await refresh();
      },
    });
  };
  return (
    <div className="admin-page">
      {confirmRequest && (
        <ConfirmDialog
          request={confirmRequest}
          onClose={() => setConfirmRequest(null)}
        />
      )}
      <header>
        <div>
          <span>ADMIN CONSOLE</span>
          <h2>사랑톡 관리</h2>
        </div>
        <button onClick={onClose}>
          <X /> 메신저로 돌아가기
        </button>
      </header>
      {error && <div className="admin-error">{error}</div>}
      <div className="stat-grid">
        {[
          ["employees", "전체 직원"],
          ["departments", "부서"],
          ["rooms", "대화방"],
          ["messages", "누적 메시지"],
          ["online", "현재 접속"],
        ].map(([key, label]) => (
          <article key={key}>
            <b>{stats[key] ?? 0}</b>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section>
          <h3>직원 계정 등록</h3>
          <form className="admin-form" onSubmit={create}>
            <label>
              사번
              <input
                required
                value={form.employeeNumber}
                onChange={(e) =>
                  setForm({ ...form, employeeNumber: e.target.value })
                }
              />
            </label>
            <label>
              이름
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              직책
              <input
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </label>
            <label>
              부서
              <select
                value={form.departmentId}
                onChange={(e) =>
                  setForm({ ...form, departmentId: e.target.value })
                }
              >
                <option value="">선택</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              초기 비밀번호
              <input
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label>
              권한
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                <option value="USER">일반 권한</option>
                <option value="NOTICE_WRITER">쪽지 관리 권한</option>
                <option value="ADMIN">관리자</option>
              </select>
            </label>
            <button disabled={working}>{working ? "처리 중..." : "직원 등록"}</button>
          </form>
        </section>
        <section>
          <h3>
            직원 현황 <small>{employees.length}명</small>
          </h3>
          <div className="admin-table">
            {employees.map((e, i) => (
              <React.Fragment key={e.id}>
                <div className="admin-employee-row">
                  <Avatar
                    name={e.name}
                    index={i}
                    online={e.online}
                    availability={e.availability}
                    color={e.avatarColor}
                    image={e.avatarImage}
                  />
                  <span>
                    <strong>
                      {e.name} {e.position && <small>{e.position}</small>}{" "}
                      {e.role === "ADMIN" && <ShieldCheck />}
                    </strong>
                    <em>
                      {e.employeeNumber} · {e.departmentName ?? "미지정"} · 내선{" "}
                      {e.extensionNumber || "-"}
                    </em>
                  </span>
                  <b className={`status ${e.status.toLowerCase()}`}>
                    {e.status === "RETIRED"
                      ? "삭제됨"
                      : e.role === "ADMIN"
                        ? "관리자"
                        : e.role === "NOTICE_WRITER"
                          ? "쪽지 관리"
                          : "일반"}
                  </b>
                  <div className="employee-row-actions">
                    <button
                      className="employee-edit-button"
                      onClick={() =>
                        editingId === e.id
                          ? setEditingId(undefined)
                          : startEdit(e)
                      }
                    >
                      {editingId === e.id ? "닫기" : "수정"}
                    </button>
                    {e.status !== "RETIRED" && (
                      <button
                        className="employee-delete-button"
                        onClick={() => void removeEmployee(e)}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                {editingId === e.id && (
                  <div className="admin-employee-editor">
                    <label>
                      부서
                      <select
                        value={editForm.departmentId}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            departmentId: event.target.value,
                          })
                        }
                      >
                        <option value="">미지정</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.id}>
                            {department.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      직책
                      <input
                        value={editForm.position}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            position: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      내선번호
                      <input
                        value={editForm.extensionNumber}
                        onChange={(event) =>
                          setEditForm({
                            ...editForm,
                            extensionNumber: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      권한
                      <select
                        value={editForm.role}
                        onChange={(event) =>
                          setEditForm({ ...editForm, role: event.target.value })
                        }
                      >
                        <option value="USER">일반 권한</option>
                        <option value="NOTICE_WRITER">쪽지 관리 권한</option>
                        <option value="ADMIN">관리자</option>
                      </select>
                    </label>
                    <button disabled={working} onClick={() => void saveEmployee(e)}>
                      {working ? "저장 중..." : "변경 저장"}
                    </button>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function OrganizationWindow({ me }: { me: Employee }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [favoriteIds, setFavoriteIds] = useState<number[]>(loadFavoriteIds);
  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    employee: Employee;
  } | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );

  useEffect(() => {
    const applyAppearance = (preferences: MessengerSettings) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const resolvedTheme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.setProperty("--user-font-size", `${preferences.fontSize}px`);
      document.documentElement.style.setProperty("--user-font-scale", String(preferences.fontSize / 12));
      document.documentElement.dataset.density = preferences.density;
    };
    const preferences = loadSettings();
    applyAppearance(preferences);
    return window.srghDesktop?.onSettingsChanged((next) => {
      const merged = { ...defaultSettings, ...next };
      localStorage.setItem("srgh_settings", JSON.stringify(merged));
      applyAppearance(merged);
    });
  }, []);
  const refresh = useCallback(() => {
    void Promise.all([
      api.employees().then(setEmployees),
      api.departments().then(setDepartments),
      api.rooms().then(setRooms),
    ]);
  }, []);
  useEffect(() => {
    refresh();
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 3000,
      onConnect: () => client.subscribe("/topic/presence", refresh),
    });
    client.activate();
    const favoritesChanged = (event: Event) =>
      setFavoriteIds(
        (event as CustomEvent<number[]>).detail ?? loadFavoriteIds(),
      );
    window.addEventListener("srgh-favorites-changed", favoritesChanged);
    window.addEventListener("storage", favoritesChanged);
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => {
      void client.deactivate();
      window.removeEventListener("srgh-favorites-changed", favoritesChanged);
      window.removeEventListener("storage", favoritesChanged);
      window.removeEventListener("click", closeMenu);
    };
  }, [refresh]);
  const toggleFavorite = (employeeId: number) => {
    const next = favoriteIds.includes(employeeId)
      ? favoriteIds.filter((id) => id !== employeeId)
      : [...favoriteIds, employeeId];
    setFavoriteIds(next);
    saveFavoriteIds(next);
  };
  const openChat = async (employee: Employee) => {
    if (employee.id === me.id) return;
    const existing = rooms.find(
      (room) =>
        room.memberCount === 2 &&
        room.members.some((member) => member.id === employee.id),
    );
    const room =
      existing ?? (await api.createRoom(employee.name, [employee.id]));
    setRooms((current) =>
      current.some((item) => item.id === room.id)
        ? current
        : [...current, room],
    );
    window.srghDesktop?.openChat(room.id);
  };
  const copyInfo = async (employee: Employee) => {
    await navigator.clipboard.writeText(
      [
        employee.name,
        employee.departmentName,
        employee.position,
        employee.statusMessage,
      ]
        .filter(Boolean)
        .join(" · "),
    );
  };
  const filteredEmployees = employees.filter(
    (employee) =>
      employee.name.includes(query) ||
      (employee.departmentName ?? "").includes(query) ||
      (employee.position ?? "").includes(query) ||
      (employee.statusMessage ?? "").includes(query),
  );
  return (
    <main className="organization-page">
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          favorite={favoriteIds.includes(selectedEmployee.id)}
          onFavorite={() => toggleFavorite(selectedEmployee.id)}
          onChat={() => {
            const employee = selectedEmployee;
            setSelectedEmployee(null);
            void openChat(employee);
          }}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
      <header className="organization-header">
        <button
          className="subwindow-back organization-back"
          onClick={() => window.srghDesktop?.close()}
          aria-label="조직도 창 닫기"
          title="뒤로가기"
        >
          <ArrowLeft />
        </button>
        <div>
          <h1>사랑의병원 조직도</h1>
          <p>
            {departments.length}개 부서 · {employees.length}명
          </p>
        </div>
      </header>
      <div className="organization-search">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이름, 부서, 직급, 상태 메시지 검색"
        />
      </div>
      <div className="organization-tree">
        {departments.map((department) => {
          const members = filteredEmployees.filter(
            (employee) => employee.departmentId === department.id,
          );
          if (query && members.length === 0) return null;
          const isCollapsed = collapsed.has(department.id) && !query;
          return (
            <section className="organization-department" key={department.id}>
              <button
                className="department-node"
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    next.has(department.id)
                      ? next.delete(department.id)
                      : next.add(department.id);
                    return next;
                  })
                }
              >
                <ChevronDown className={isCollapsed ? "collapsed" : ""} />
                <Building2 />
                <strong>{department.name}</strong>
                <span>{members.length}명</span>
              </button>
              {!isCollapsed && (
                <div className="organization-members">
                  {members.map((employee) => (
                    <div
                      className="organization-person"
                      key={employee.id}
                      onDoubleClick={() => void openChat(employee)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setMenu({
                          x: event.clientX,
                          y: event.clientY,
                          employee,
                        });
                      }}
                    >
                      <Avatar
                        name={employee.name}
                        online={employee.online}
                        availability={employee.availability}
                        color={employee.avatarColor}
                        image={employee.avatarImage}
                        onClick={
                          employee.id !== me.id
                            ? () => setSelectedEmployee(employee)
                            : undefined
                        }
                      />
                      <div>
                        <strong>
                          {employee.name}{" "}
                          {employee.position && (
                            <span>{employee.position}</span>
                          )}
                        </strong>
                        {employee.statusMessage && (
                          <small>{employee.statusMessage}</small>
                        )}
                      </div>
                      {employee.id !== me.id && (
                        <button
                          className={`org-favorite ${favoriteIds.includes(employee.id) ? "selected" : ""}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(employee.id);
                          }}
                          aria-label="즐겨찾기"
                        >
                          <Star />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      {menu && (
        <div
          className="employee-context-menu"
          style={{
            left: Math.min(menu.x, window.innerWidth - 185),
            top: Math.min(menu.y, window.innerHeight - 145),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div>
            <Avatar
              name={menu.employee.name}
              color={menu.employee.avatarColor}
              image={menu.employee.avatarImage}
            />
            <span>
              <strong>
                {menu.employee.name}{" "}
                {menu.employee.position && (
                  <small className="position-label">
                    {menu.employee.position}
                  </small>
                )}
              </strong>
              {menu.employee.statusMessage && (
                <small>{menu.employee.statusMessage}</small>
              )}
            </span>
          </div>
          {menu.employee.id !== me.id && (
            <button
              onClick={() => {
                void openChat(menu.employee);
                setMenu(null);
              }}
            >
              <MessageCircleMore /> 대화창 열기
            </button>
          )}
          {menu.employee.id !== me.id && (
            <button
              onClick={() => {
                toggleFavorite(menu.employee.id);
                setMenu(null);
              }}
            >
              <Star />{" "}
              {favoriteIds.includes(menu.employee.id)
                ? "즐겨찾기 해제"
                : "즐겨찾기 추가"}
            </button>
          )}
          <button
            onClick={() => {
              void copyInfo(menu.employee);
              setMenu(null);
            }}
          >
            <Clipboard /> 직원 정보 복사
          </button>
        </div>
      )}
    </main>
  );
}

function Messenger({
  me,
  onMeChange,
  onLogout,
  initialRoomId,
  standaloneChat = false,
}: {
  me: Employee;
  onMeChange: (employee: Employee) => void;
  onLogout: () => void;
  initialRoomId?: number;
  standaloneChat?: boolean;
}) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeId, setActiveId] = useState<number | undefined>(initialRoomId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [query, setQuery] = useState("");
  const [text, setText] = useState("");
  const [panel, setPanel] = useState<"chat" | "people" | "notices">("people");
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [directoryScope, setDirectoryScope] = useState<
    "all" | "online" | "department" | "favorites"
  >("department");
  const [chatScope, setChatScope] = useState<
    "all" | "unread" | "direct" | "group"
  >("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>(loadFavoriteIds);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [messageMenu, setMessageMenu] = useState<{
    x: number;
    y: number;
    message: Message;
  } | null>(null);
  const [roomMenu, setRoomMenu] = useState<{
    x: number;
    y: number;
    room: Room;
  } | null>(null);
  const [renameRoom, setRenameRoom] = useState<Room | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [directoryMenu, setDirectoryMenu] = useState<{
    x: number;
    y: number;
    employee: Employee;
    self: boolean;
  } | null>(null);
  const [pinnedRoomIds, setPinnedRoomIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem("srgh_pinned_rooms") ?? "[]"),
  );
  const [mutedRoomIds, setMutedRoomIds] = useState<number[]>(() =>
    JSON.parse(localStorage.getItem("srgh_muted_rooms") ?? "[]"),
  );
  const [newRoom, setNewRoom] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null,
  );
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null,
  );
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [chatSearchIndex, setChatSearchIndex] = useState(0);
  const [preferences, setPreferences] =
    useState<MessengerSettings>(loadSettings);
  const [compactChat, setCompactChat] = useState(standaloneChat);
  const [socketConnected, setSocketConnected] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileDragDepthRef = useRef(0);
  const messagesRef = useRef<HTMLDivElement>(null);
  const loadingOlderRef = useRef(false);
  const lastScrolledRoomRef = useRef<number | undefined>(undefined);
  const clientRef = useRef<Client | null>(null);
  const roomSubscriptionsRef = useRef(
    new Map<
      number,
      {
        message: { unsubscribe: () => void };
        read: { unsubscribe: () => void };
      }
    >(),
  );
  const activeIdRef = useRef(activeId);
  const roomViewedRef = useRef(
    (standaloneChat || compactChat) &&
      document.visibilityState === "visible" &&
      document.hasFocus(),
  );
  const preferencesRef = useRef(preferences);
  const availabilityRef = useRef(me.availability);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);
  useEffect(() => {
    const updateRoomViewed = () => {
      roomViewedRef.current =
        (standaloneChat || compactChat) &&
        document.visibilityState === "visible" &&
        document.hasFocus();
    };
    updateRoomViewed();
    window.addEventListener("focus", updateRoomViewed);
    window.addEventListener("blur", updateRoomViewed);
    document.addEventListener("visibilitychange", updateRoomViewed);
    return () => {
      window.removeEventListener("focus", updateRoomViewed);
      window.removeEventListener("blur", updateRoomViewed);
      document.removeEventListener("visibilitychange", updateRoomViewed);
    };
  }, [compactChat, standaloneChat]);
  useEffect(() => {
    preferencesRef.current = preferences;
  }, [preferences]);
  useEffect(() => {
    availabilityRef.current = me.availability;
  }, [me.availability]);
  useEffect(() => {
    const updateFavorites = (event: Event) =>
      setFavoriteIds(
        (event as CustomEvent<number[]>).detail ?? loadFavoriteIds(),
      );
    window.addEventListener("srgh-favorites-changed", updateFavorites);
    window.addEventListener("storage", updateFavorites);
    return () => {
      window.removeEventListener("srgh-favorites-changed", updateFavorites);
      window.removeEventListener("storage", updateFavorites);
    };
  }, []);

  useEffect(() => {
    return window.srghDesktop?.onSettingsChanged((next) => {
      const merged = { ...defaultSettings, ...next };
      setPreferences((current) =>
        JSON.stringify(current) === JSON.stringify(merged) ? current : merged,
      );
    });
  }, []);
  useEffect(() => {
    localStorage.setItem("srgh_settings", JSON.stringify(preferences));
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyAppearance = () => {
      const resolvedTheme =
        preferences.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : preferences.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.setProperty(
        "--user-font-size",
        `${preferences.fontSize}px`,
      );
      document.documentElement.style.setProperty("--user-font-scale", String(preferences.fontSize / 12));
      document.documentElement.dataset.density = preferences.density;
    };
    applyAppearance();
    media.addEventListener("change", applyAppearance);
    window.srghDesktop?.applySettings(preferences);
    return () => media.removeEventListener("change", applyAppearance);
  }, [preferences]);
  useEffect(() => {
    const close = () => {
      setMessageMenu(null);
      setRoomMenu(null);
      setDirectoryMenu(null);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  useEffect(() => {
    localStorage.setItem("srgh_pinned_rooms", JSON.stringify(pinnedRoomIds));
  }, [pinnedRoomIds]);
  useEffect(() => {
    localStorage.setItem("srgh_muted_rooms", JSON.stringify(mutedRoomIds));
  }, [mutedRoomIds]);

  const refreshRooms = useCallback(async () => {
    const data = await api.rooms();
    setRooms(data);
    setPinnedRoomIds(data.filter((room) => room.pinned).map((room) => room.id));
    setMutedRoomIds(data.filter((room) => room.muted).map((room) => room.id));
    setActiveId((id) => id ?? data[0]?.id);
  }, []);
  useEffect(() => {
    const requests: Promise<unknown>[] = [
      refreshRooms(),
      api.employees().then(setEmployees),
      api.notices().then(setNotices),
    ];
    if (!standaloneChat)
      requests.push(
        api
          .presence(true)
          .then(() => api.me())
          .then(onMeChange),
      );
    void Promise.all(requests);
    const heartbeat = standaloneChat
      ? undefined
      : window.setInterval(() => void api.presence(true), 45_000);
    return () => {
      if (heartbeat) window.clearInterval(heartbeat);
      if (!standaloneChat) void api.presence(false);
    };
  }, [refreshRooms, standaloneChat, onMeChange]);
  useEffect(() => {
    if (!activeId || !(standaloneChat || compactChat)) return;
    setMessages([]);
    setHasOlderMessages(true);
    void api.messages(activeId, undefined, 30).then(async (data) => {
      setMessages(data);
      setHasOlderMessages(data.length === 30);
      const last = data.at(-1);
      if (
        last &&
        document.visibilityState === "visible" &&
        document.hasFocus()
      ) {
        await api.read(activeId, last.id);
        await refreshRooms();
      }
    });
  }, [activeId, compactChat, refreshRooms, standaloneChat]);
  useEffect(() => {
    if (!activeId || !(standaloneChat || compactChat)) return;
    const synchronize = () => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        void api.messages(activeId, undefined, 30).then(async (data) => {
          setMessages((current) => mergeMessages(current, data));
          const last = data.at(-1);
          if (last) {
            await api.read(activeId, last.id);
            await refreshRooms();
          }
        });
      }
    };
    const timer = window.setInterval(synchronize, 3000);
    window.addEventListener("focus", synchronize);
    document.addEventListener("visibilitychange", synchronize);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", synchronize);
      document.removeEventListener("visibilitychange", synchronize);
    };
  }, [activeId, compactChat, refreshRooms, standaloneChat]);
  useEffect(() => {
    if (!session.token) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(websocketUrl),
      reconnectDelay: 3000,
      onConnect: () => {
        setSocketConnected(true);
        client.subscribe("/topic/rooms", () => void refreshRooms());
        client.subscribe(
          "/topic/presence",
          () =>
            void Promise.all([api.employees(), api.me()]).then(
              ([directory, current]) => {
                setEmployees(directory);
                onMeChange(current);
                setSelectedEmployee((selected) =>
                  selected
                    ? selected.id === current.id
                      ? current
                      : (directory.find(
                          (employee) => employee.id === selected.id,
                        ) ?? selected)
                    : null,
                );
              },
            ),
        );
        client.subscribe("/topic/directory", () => void api.employees().then(setEmployees));
        client.subscribe(`/topic/notices/${me.id}`, (frame) => {
          const notice = JSON.parse(frame.body) as Notice;
          setNotices((current) =>
            current.some((item) => item.id === notice.id)
              ? current
              : [notice, ...current],
          );
          const currentPreferences = preferencesRef.current;
          if (!standaloneChat && currentPreferences.notifications && availabilityRef.current !== "BUSY") {
            window.srghDesktop?.notify(
              notice.title || "새 쪽지",
              notice.content ||
                notice.file?.originalName ||
                "새 쪽지가 도착했습니다.",
              currentPreferences.sound,
            );
          }
        });
      },
      onDisconnect: () => setSocketConnected(false),
      onWebSocketClose: () => {
        setSocketConnected(false);
        roomSubscriptionsRef.current.clear();
      },
    });
    client.activate();
    clientRef.current = client;
    return () => {
      roomSubscriptionsRef.current.forEach((subscription) => {
        subscription.message.unsubscribe();
        subscription.read.unsubscribe();
      });
      roomSubscriptionsRef.current.clear();
      void client.deactivate();
    };
  }, [refreshRooms]);
  useEffect(() => {
    const client = clientRef.current;
    if (!socketConnected || !client?.connected) return;
    const targetRoomIds = new Set(
      standaloneChat
        ? activeId
          ? [activeId]
          : []
        : rooms.map((item) => item.id),
    );
    for (const [roomId, subscription] of roomSubscriptionsRef.current) {
      if (!targetRoomIds.has(roomId)) {
        subscription.message.unsubscribe();
        subscription.read.unsubscribe();
        roomSubscriptionsRef.current.delete(roomId);
      }
    }
    for (const roomId of targetRoomIds) {
      if (roomSubscriptionsRef.current.has(roomId)) continue;
      const messageSubscription = client.subscribe(
        `/topic/rooms/${roomId}`,
        (frame) => {
          const event = JSON.parse(frame.body);
          if (roomId === activeIdRef.current) {
            if (event.type === "MESSAGE_DELETED") {
              setMessages((current) =>
                current.map((message) =>
                  message.id === event.messageId
                    ? {
                        ...message,
                        content: "삭제된 메시지입니다.",
                        file: undefined,
                      }
                    : message,
                ),
              );
            } else {
              setMessages((current) =>
                current.some((message) => message.id === event.id)
                  ? current
                  : [...current, event],
              );
              if (roomViewedRef.current)
                void api.read(roomId, event.id).then(refreshRooms);
            }
          }
          const currentPreferences = preferencesRef.current;
          const mutedRooms: number[] = JSON.parse(
            localStorage.getItem("srgh_muted_rooms") ?? "[]",
          );
          if (
            event.type !== "MESSAGE_DELETED" &&
            event.type !== "SYSTEM" &&
            event.senderId !== me.id &&
            !standaloneChat &&
            availabilityRef.current !== "BUSY" &&
            currentPreferences.notifications &&
            !mutedRooms.includes(roomId)
          ) {
            const body = currentPreferences.notificationPreview
              ? (event.file?.originalName ??
                event.content ??
                "새 메시지가 도착했습니다.")
              : "새 메시지가 도착했습니다.";
            window.srghDesktop?.notify(
              event.senderName ?? "사랑톡",
              body,
              currentPreferences.sound,
              roomId,
            );
          }
          void refreshRooms();
        },
      );
      const readSubscription = client.subscribe(
        `/topic/rooms/${roomId}/read`,
        (frame) => {
          const event = JSON.parse(frame.body) as {
            employeeId: number;
            messageId: number;
          };
          if (event.employeeId !== me.id) {
            setMessages((current) =>
              current.map((message) =>
                message.senderId === me.id &&
                message.id <= event.messageId &&
                message.unreadCount > 0
                  ? { ...message, unreadCount: message.unreadCount - 1 }
                  : message,
              ),
            );
          }
          void refreshRooms();
          if (roomId === activeIdRef.current) {
            void api
              .messages(roomId, undefined, 30)
              .then((data) =>
                setMessages((current) => mergeMessages(current, data)),
              );
          }
        },
      );
      roomSubscriptionsRef.current.set(roomId, {
        message: messageSubscription,
        read: readSubscription,
      });
    }
  }, [activeId, me.id, refreshRooms, rooms, socketConnected, standaloneChat]);
  useEffect(() => {
    const latestMessageId = messages.at(-1)?.id;
    if (!activeId || !latestMessageId) return;
    const firstDisplay = lastScrolledRoomRef.current !== activeId;
    lastScrolledRoomRef.current = activeId;
    const scrollToLatest = () => {
      const container = messagesRef.current;
      if (container)
        container.scrollTo({
          top: container.scrollHeight,
          behavior: firstDisplay ? "auto" : "smooth",
        });
    };
    const frame = window.requestAnimationFrame(() =>
      window.requestAnimationFrame(scrollToLatest),
    );
    const shortTimer = window.setTimeout(scrollToLatest, 120);
    const mediaTimer = window.setTimeout(scrollToLatest, 600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(shortTimer);
      window.clearTimeout(mediaTimer);
    };
  }, [activeId, messages.at(-1)?.id]);

  const room = rooms.find((r) => r.id === activeId);
  const totalUnreadCount = rooms.reduce(
    (total, item) => total + item.unreadCount,
    0,
  );
  const unreadNoticeCount = notices.filter(
    (notice) => !notice.read && notice.senderId !== me.id,
  ).length;
  const roomAvatarMember =
    room?.memberCount && room.memberCount <= 2
      ? (room.members.find((member) => member.id !== me.id) ?? room.members[0])
      : undefined;
  const messageMenuSender = messageMenu
    ? (room?.members.find(
        (member) => member.id === messageMenu.message.senderId,
      ) ??
      employees.find(
        (employee) => employee.id === messageMenu.message.senderId,
      ))
    : undefined;
  const chatSearchMatches = useMemo(() => {
    const needle = chatSearchQuery.trim().toLowerCase();
    if (!needle) return [];
    return messages.filter(
      (message) =>
        (message.content ?? "").toLowerCase().includes(needle) ||
        (message.file?.originalName ?? "").toLowerCase().includes(needle) ||
        (message.senderName ?? "").toLowerCase().includes(needle),
    );
  }, [chatSearchQuery, messages]);
  useEffect(() => {
    setChatSearchIndex(
      chatSearchMatches.length ? chatSearchMatches.length - 1 : 0,
    );
  }, [chatSearchQuery, chatSearchMatches.length]);
  const moveChatSearch = (direction: -1 | 1) => {
    if (!chatSearchMatches.length) return;
    const next =
      (chatSearchIndex + direction + chatSearchMatches.length) %
      chatSearchMatches.length;
    setChatSearchIndex(next);
    document
      .querySelector(`[data-message-id="${chatSearchMatches[next].id}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const filtered = rooms
    .filter((r) => {
      const matchesQuery =
        r.name.includes(query) || r.lastMessage?.content.includes(query);
      const matchesScope =
        chatScope === "all" ||
        (chatScope === "unread" && r.unreadCount > 0) ||
        (chatScope === "direct" && r.memberCount === 2) ||
        (chatScope === "group" && r.memberCount > 2);
      return matchesQuery && matchesScope;
    })
    .sort(
      (a, b) =>
        Number(pinnedRoomIds.includes(b.id)) -
        Number(pinnedRoomIds.includes(a.id)),
    );
  const visibleEmployees = employees.filter((e) => {
    const matchesQuery =
      e.id !== me.id &&
      (e.name.includes(query) ||
        (e.departmentName ?? "").includes(query) ||
        e.employeeNumber.includes(query) ||
        (e.position ?? "").includes(query));
    const matchesScope =
      directoryScope === "all" ||
      (directoryScope === "online" &&
        e.online &&
        e.availability !== "OFFLINE") ||
      (directoryScope === "department" && e.departmentId === me.departmentId) ||
      (directoryScope === "favorites" && favoriteIds.includes(e.id));
    return matchesQuery && matchesScope;
  });
  const employeeGroups = useMemo(
    () =>
      Object.entries(
        visibleEmployees.reduce<Record<string, Employee[]>>(
          (groups, employee) => {
            const department = employee.departmentName ?? "부서 미지정";
            (groups[department] ??= []).push(employee);
            return groups;
          },
          {},
        ),
      ),
    [visibleEmployees],
  );
  const send = async () => {
    if (!activeId) return;
    if (pendingFile) {
      const selectedFile = pendingFile;
      setPendingFile(null);
      await upload(selectedFile);
      return;
    }
    const raw = text.trim();
    if (!raw) return;
    const content = replyTo
      ? `↪ ${replyTo.senderName}: ${(replyTo.file?.originalName ?? replyTo.content ?? "메시지").slice(0, 40)}\n${raw}`
      : raw;
    setText("");
    setReplyTo(null);
    const sent = await api.send(activeId, content);
    setMessages((m) => (m.some((x) => x.id === sent.id) ? m : [...m, sent]));
    await refreshRooms();
  };
  const upload = async (file?: File) => {
    if (!file || !activeId) return;
    const sent = await api.upload(activeId, file);
    setMessages((current) =>
      current.some((message) => message.id === sent.id)
        ? current.map((message) => (message.id === sent.id ? sent : message))
        : [...current, sent],
    );
    await refreshRooms();
  };
  const dragHasFiles = (event: React.DragEvent) =>
    Array.from(event.dataTransfer.types).includes("Files");
  const handleFileDragEnter = (event: React.DragEvent) => {
    if (!room || !dragHasFiles(event)) return;
    event.preventDefault();
    fileDragDepthRef.current += 1;
    setFileDragActive(true);
  };
  const handleFileDragOver = (event: React.DragEvent) => {
    if (!room || !dragHasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };
  const handleFileDragLeave = (event: React.DragEvent) => {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
    if (fileDragDepthRef.current === 0) setFileDragActive(false);
  };
  const handleFileDrop = (event: React.DragEvent) => {
    if (!room || !dragHasFiles(event)) return;
    event.preventDefault();
    fileDragDepthRef.current = 0;
    setFileDragActive(false);
    setPendingFile(event.dataTransfer.files.item(0));
  };
  const loadOlderMessages = async () => {
    const container = messagesRef.current;
    const firstMessageId = messages[0]?.id;
    if (
      !container ||
      !activeId ||
      !firstMessageId ||
      !hasOlderMessages ||
      loadingOlderRef.current
    )
      return;
    loadingOlderRef.current = true;
    setLoadingOlderMessages(true);
    const previousHeight = container.scrollHeight;
    const previousTop = container.scrollTop;
    try {
      const older = await api.messages(activeId, firstMessageId, 30);
      setHasOlderMessages(older.length === 30);
      if (older.length) {
        setMessages((current) => mergeMessages(older, current));
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => {
            const currentContainer = messagesRef.current;
            if (currentContainer)
              currentContainer.scrollTop =
                previousTop + currentContainer.scrollHeight - previousHeight;
          }),
        );
      }
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlderMessages(false);
    }
  };
  const handleMessageScroll = () => {
    const container = messagesRef.current;
    if (container && container.scrollTop <= 36) void loadOlderMessages();
  };
  useEffect(() => {
    const container = messagesRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleMessageScroll, {
      passive: true,
    });
    return () => container.removeEventListener("scroll", handleMessageScroll);
  }, [activeId, hasOlderMessages, messages[0]?.id]);
  const toggleFavorite = (employeeId: number) => {
    const next = favoriteIds.includes(employeeId)
      ? favoriteIds.filter((id) => id !== employeeId)
      : [...favoriteIds, employeeId];
    setFavoriteIds(next);
    saveFavoriteIds(next);
  };
  const downloadMessageFile = async (message: Message) => {
    if (!message.file) return;
    const blob = await fetchAttachment(message.file.downloadUrl);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = message.file.originalName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  };
  const deleteMessage = async (message: Message) => {
    setConfirmRequest({
      title: "메시지를 삭제하시겠습니까?",
      message:
        "삭제한 메시지는 대화 참여자에게 삭제된 메시지로 표시되며 되돌릴 수 없습니다.",
      confirmLabel: "메시지 삭제",
      danger: true,
      onConfirm: async () => {
        await api.deleteMessage(message.id);
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? { ...item, content: "삭제된 메시지입니다.", file: undefined }
              : item,
          ),
        );
      },
    });
  };
  const openRoom = (roomId: number) => {
    setActiveId(roomId);
    if (window.srghDesktop?.isDesktop && !standaloneChat) {
      window.srghDesktop.openChat(roomId);
      return;
    }
    setCompactChat(true);
  };
  const markRoomRead = async (target: Room) => {
    if (target.lastMessage) await api.read(target.id, target.lastMessage.id);
    await refreshRooms();
  };
  const togglePinnedRoom = async (target: Room) => {
    await api.updateRoomPreferences(target.id, { pinned: !target.pinned });
    await refreshRooms();
  };
  const toggleMutedRoom = async (target: Room) => {
    await api.updateRoomPreferences(target.id, { muted: !target.muted });
    await refreshRooms();
  };
  const saveRoomName = async () => {
    if (!renameRoom || !renameValue.trim()) return;
    await api.updateRoomPreferences(renameRoom.id, {
      customName: renameValue.trim(),
    });
    setRenameRoom(null);
    await refreshRooms();
  };
  const changeMyAvailability = async (
    availability: NonNullable<Employee["availability"]>,
  ) => {
    const updated = await api.updateMe({
      name: me.name,
      extensionNumber: me.extensionNumber ?? "",
      statusMessage: me.statusMessage ?? "",
      availability,
      avatarColor: me.avatarColor ?? "#10adc8",
      avatarImage: me.avatarImage ?? "",
    });
    onMeChange(updated);
    await api.presence(availability !== "OFFLINE");
    await api.employees().then(setEmployees);
  };
  useEffect(() => {
    return window.srghDesktop?.onAutoAway(() => {
      if (availabilityRef.current === "ONLINE") void changeMyAvailability("AWAY");
    });
  }, [me.name, me.extensionNumber, me.statusMessage, me.avatarColor, me.avatarImage]);
  const leaveRoom = async (target: Room) => {
    setConfirmRequest({
      title: "대화방에서 나가시겠습니까?",
      message: `'${target.name}' 대화방 목록과 이전 대화 내용을 더 이상 볼 수 없습니다.`,
      confirmLabel: "대화방 나가기",
      onConfirm: async () => {
        await api.leaveRoom(target.id);
        setRooms((current) => current.filter((room) => room.id !== target.id));
        setActiveId((current) => (current === target.id ? undefined : current));
      },
    });
  };
  const startDirectChat = async (employee: Employee) => {
    const existing = rooms.find(
      (r) =>
        r.memberCount === 2 &&
        r.members.some((member) => member.id === employee.id),
    );
    const target =
      existing ?? (await api.createRoom(employee.name, [employee.id]));
    await refreshRooms();
    openRoom(target.id);
  };
  const startSelfChat = async () => {
    const existing = rooms.find(
      (r) =>
        r.memberCount === 1 &&
        r.members.length === 1 &&
        r.members[0].id === me.id,
    );
    const target = existing ?? (await api.createRoom("나와의 채팅", [me.id]));
    await refreshRooms();
    openRoom(target.id);
  };
  const logout = async () => {
    await api.presence(false);
    await api.logout();
    session.token = null;
    window.srghDesktop?.logout();
    onLogout();
  };
  if (admin) return <AdminPanel onClose={() => setAdmin(false)} />;

  return (
    <main
      className={`app-shell ${compactChat ? "compact-chat-open" : ""} ${standaloneChat ? "standalone-chat" : ""} ${panel === "notices" ? "notice-view-open" : ""} ${chatSearchOpen ? "chat-search-open" : ""} ${panel === "people" && directoryScope === "favorites" ? "favorites-directory-open" : ""}`}
    >
      {newRoom && (
        <NewRoomModal
          employees={employees.filter((e) => e.id !== me.id)}
          rooms={rooms}
          meId={me.id}
          onClose={() => setNewRoom(false)}
          onCreated={(r) => {
            setRooms((current) =>
              current.some((room) => room.id === r.id) ? current : [r, ...current],
            );
            void refreshRooms();
            openRoom(r.id);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          value={preferences}
          onChange={setPreferences}
          onAutoLoginDisabled={() => void logout()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {confirmRequest && (
        <ConfirmDialog
          request={confirmRequest}
          onClose={() => setConfirmRequest(null)}
        />
      )}
      {profileOpen && (
        <ProfileModal
          employee={me}
          onSaved={(updated) => {
            onMeChange(updated);
            void api.presence(updated.availability !== "OFFLINE");
            void api.employees().then(setEmployees);
          }}
          onClose={() => setProfileOpen(false)}
        />
      )}
      {selectedEmployee && (
        <EmployeeDetailModal
          employee={selectedEmployee}
          self={selectedEmployee.id === me.id}
          favorite={favoriteIds.includes(selectedEmployee.id)}
          onFavorite={() => toggleFavorite(selectedEmployee.id)}
          onEdit={() => {
            setSelectedEmployee(null);
            setProfileOpen(true);
          }}
          onChat={() => {
            const employee = selectedEmployee;
            setSelectedEmployee(null);
            employee.id === me.id
              ? void startSelfChat()
              : void startDirectChat(employee);
          }}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
      {renameRoom && (
        <div
          className="modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setRenameRoom(null);
          }}
        >
          <section className="rename-room-modal">
            <header>
              <h3>대화방 이름 바꾸기</h3>
              <button onClick={() => setRenameRoom(null)}>
                <X />
              </button>
            </header>
            <p>이 이름은 나에게만 표시됩니다.</p>
            <input
              autoFocus
              maxLength={120}
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void saveRoomName();
              }}
            />
            <footer>
              <button onClick={() => setRenameRoom(null)}>취소</button>
              <button
                className="primary"
                disabled={!renameValue.trim()}
                onClick={() => void saveRoomName()}
              >
                변경
              </button>
            </footer>
          </section>
        </div>
      )}
      <aside className="rail">
        <div className="brand-mark">
          S<span>talk</span>
        </div>
        <nav>
          <button
            title="주소록"
            aria-label="주소록"
            className={
              panel === "people" && directoryScope !== "favorites"
                ? "active"
                : ""
            }
            onClick={() => {
              setPanel("people");
              setDirectoryScope("department");
              setScopeMenuOpen(false);
            }}
          >
            <UsersRound />
          </button>
          <button
            title="채팅"
            aria-label={`채팅${totalUnreadCount > 0 ? `, 읽지 않은 메시지 ${totalUnreadCount}개` : ""}`}
            className={panel === "chat" ? "active" : ""}
            onClick={() => {
              setPanel("chat");
              setScopeMenuOpen(false);
            }}
          >
            <MessageCircleMore />
            {totalUnreadCount > 0 && (
              <i className="chat-unread-badge">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </i>
            )}
          </button>
          <button
            title="즐겨찾기"
            aria-label="즐겨찾기"
            className={
              panel === "people" && directoryScope === "favorites"
                ? "active"
                : ""
            }
            onClick={() => {
              setPanel("people");
              setDirectoryScope("favorites");
              setScopeMenuOpen(false);
            }}
          >
            <Star />
          </button>
          <button
            title="쪽지"
            aria-label={`쪽지${unreadNoticeCount > 0 ? `, 읽지 않은 쪽지 ${unreadNoticeCount}개` : ""}`}
            className={panel === "notices" ? "active" : ""}
            onClick={() => setPanel("notices")}
          >
            <Mail />
            {unreadNoticeCount > 0 && (
              <i>{unreadNoticeCount > 99 ? "99+" : unreadNoticeCount}</i>
            )}
          </button>
          <button
            title="조직도"
            aria-label="조직도"
            onClick={() => window.srghDesktop?.openOrganization()}
          >
            <Network />
          </button>
        </nav>
        <div className="rail-bottom">
          {me.role === "ADMIN" && (
            <button onClick={() => setAdmin(true)} title="관리자">
              <ShieldCheck />
            </button>
          )}
          <button
            onClick={() => setSettingsOpen(true)}
            title="설정"
            aria-label="설정"
          >
            <Settings />
          </button>
          <button onClick={logout} title="로그아웃">
            <LogOut />
          </button>
          <button
            className="profile-trigger"
            onClick={() => setProfileOpen(true)}
            title="내 정보 변경"
            aria-label="내 정보 변경"
          >
            <Avatar
              name={me.name}
              color={me.avatarColor}
              image={me.avatarImage}
              online={me.online}
              availability={me.availability}
            />
          </button>
        </div>
      </aside>
      {panel === "notices" && (
        <NoticeHome
          me={me}
          notices={notices}
          onRead={(notice) => {
            if (!notice.read) {
              void api.readNotice(notice.id);
              setNotices((items) =>
                items.map((item) =>
                  item.id === notice.id ? { ...item, read: true } : item,
                ),
              );
            }
          }}
        />
      )}
      <section className="room-panel">
        <header className="panel-title">
          <div className="panel-heading">
            <span className="eyebrow">사랑의병원</span>
            <button
              className={`panel-heading-button ${scopeMenuOpen ? "open" : ""}`}
              onClick={() => setScopeMenuOpen((open) => !open)}
              aria-expanded={scopeMenuOpen}
            >
              <h1>
                {panel === "chat"
                  ? "채팅"
                  : directoryScope === "favorites"
                    ? "즐겨찾기"
                    : "주소록"}
              </h1>
              <ChevronDown />
            </button>
            {scopeMenuOpen && (
              <div className="scope-menu">
                {panel === "people" ? (
                  <>
                    {(
                      [
                        ["department", "내 부서"],
                        ["all", "전체 직원"],
                        ["online", "접속 중"],
                        ["favorites", "즐겨찾기"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={directoryScope === value ? "selected" : ""}
                        onClick={() => {
                          setDirectoryScope(value);
                          setScopeMenuOpen(false);
                        }}
                      >
                        {label}
                        {directoryScope === value && <span>✓</span>}
                      </button>
                    ))}
                  </>
                ) : (
                  <>
                    {(
                      [
                        ["all", "전체 대화"],
                        ["unread", "읽지 않은 대화"],
                        ["direct", "1:1 대화"],
                        ["group", "그룹 대화"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={chatScope === value ? "selected" : ""}
                        onClick={() => {
                          setChatScope(value);
                          setScopeMenuOpen(false);
                        }}
                      >
                        {label}
                        {chatScope === value && <span>✓</span>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <button
            className="round-button"
            title="새 대화"
            aria-label="새 대화"
            onClick={() => setNewRoom(true)}
          >
            <UsersRound />
          </button>
        </header>
        <div className="search-box">
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              panel === "chat"
                ? "대화방 또는 메시지 검색"
                : "이름, 부서, 사번, 담당업무"
            }
          />
        </div>
        {panel === "chat" ? (
          <>
            <div className="filter-line">
              <span>
                {chatScope === "all"
                  ? "전체 대화"
                  : chatScope === "unread"
                    ? "읽지 않은 대화"
                    : chatScope === "direct"
                      ? "1:1 대화"
                      : "그룹 대화"}
              </span>
              <span>{filtered.length}개의 대화</span>
            </div>
            <div className="room-list">
              {filtered.map((r, i) => {
                const directPartner =
                  r.memberCount === 2
                    ? r.members.find((member) => member.id !== me.id)
                    : undefined;
                return (
                  <button
                    key={r.id}
                    className={`room-item ${activeId === r.id ? "selected" : ""}`}
                    onClick={() => setActiveId(r.id)}
                    onDoubleClick={() => openRoom(r.id)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setRoomMenu({
                        x: event.clientX,
                        y: event.clientY,
                        room: r,
                      });
                    }}
                    title="더블클릭하여 채팅방 열기"
                  >
                    <Avatar
                      name={directPartner?.name ?? r.name}
                      index={i}
                      color={directPartner?.avatarColor}
                      image={directPartner?.avatarImage}
                      online={directPartner?.online}
                      availability={directPartner?.availability}
                    />
                    <span className="room-copy">
                      <strong>
                        {r.name}{" "}
                        {directPartner?.position && (
                          <span className="room-position">
                            {directPartner.position}
                          </span>
                        )}
                        {r.memberCount > 2 && <small>{r.memberCount}</small>}
                      </strong>
                      <em>{r.lastMessage?.content ?? "새 대화방"}</em>
                    </span>
                    <span className="room-meta">
                      <time>{time(r.lastMessage?.sentAt)}</time>
                      {r.unreadCount > 0 && <b>{r.unreadCount}</b>}
                    </span>
                    <span className="room-state-icons">
                      {r.pinned && <Star className="pinned" />}
                      {r.muted && <Bell className="muted" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="people-list directory-list">
            <p className="section-label">내 프로필</p>
            <div
              className="person profile-person"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest(".avatar")) setSelectedEmployee(me);
              }}
              onDoubleClick={() => void startSelfChat()}
              onContextMenu={(event) => {
                event.preventDefault();
                setDirectoryMenu({
                  x: event.clientX,
                  y: event.clientY,
                  employee: me,
                  self: true,
                });
              }}
              title="더블클릭하여 나와의 채팅 시작"
            >
              <Avatar
                name={me.name}
                color={me.avatarColor}
                image={me.avatarImage}
                online={me.online}
                availability={me.availability}
              />
              <span>
                <strong>
                  {me.name}{" "}
                  {me.position && (
                    <small className="position-label">{me.position}</small>
                  )}
                </strong>
                {me.statusMessage && (
                  <small className="person-status-message">
                    {me.statusMessage}
                  </small>
                )}
              </span>
              <button
                className="staff-chat-button"
                onClick={() => void startSelfChat()}
                aria-label="나와의 채팅"
              >
                <MessageCircleMore />
              </button>
            </div>
            {employeeGroups.map(([department, members]) => (
              <section className="department-group" key={department}>
                <p className="section-label">
                  {department} <b>{members.length}</b>
                </p>
                {members.map((employee, i) => (
                  <div
                    className="person"
                    key={employee.id}
                    onDoubleClick={() => void startDirectChat(employee)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setDirectoryMenu({
                        x: event.clientX,
                        y: event.clientY,
                        employee,
                        self: false,
                      });
                    }}
                    title="프로필 사진 클릭 시 상세정보 · 더블클릭 시 채팅"
                  >
                    <Avatar
                      name={employee.name}
                      index={i + 1}
                      online={employee.online}
                      availability={employee.availability}
                      color={employee.avatarColor}
                      image={employee.avatarImage}
                      onClick={() => setSelectedEmployee(employee)}
                    />
                    <span>
                      <strong>
                        {employee.name}{" "}
                        {employee.position && (
                          <small className="position-label">
                            {employee.position}
                          </small>
                        )}
                      </strong>
                      {employee.statusMessage && (
                        <small className="person-status-message">
                          {employee.statusMessage}
                        </small>
                      )}
                    </span>
                    <button
                      className={`favorite-button ${favoriteIds.includes(employee.id) ? "selected" : ""}`}
                      onClick={() => toggleFavorite(employee.id)}
                      aria-label="즐겨찾기"
                    >
                      <Star />
                    </button>
                    <button
                      className="staff-chat-button"
                      onClick={() => void startDirectChat(employee)}
                      aria-label={`${employee.name}님과 대화`}
                    >
                      <MessageCircleMore />
                    </button>
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </section>
      <section
        className={`chat-panel ${fileDragActive ? "file-drag-active" : ""}`}
        onDragEnter={handleFileDragEnter}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
        onDrop={(event) => void handleFileDrop(event)}
      >
        {fileDragActive && (
          <div className="file-drop-overlay">
            <div>
              <Paperclip />
              <strong>파일을 놓아 전송</strong>
              <span>이미지, 동영상 및 모든 파일을 바로 올릴 수 있습니다.</span>
            </div>
          </div>
        )}
        {room ? (
          <>
            <header className="chat-header">
              {standaloneChat ? (
                <button
                  className="subwindow-back"
                  onClick={() => window.srghDesktop?.close()}
                  aria-label="채팅창 닫기"
                  title="뒤로가기"
                >
                  <ArrowLeft />
                </button>
              ) : (
                <button
                  className="compact-back"
                  onClick={() => setCompactChat(false)}
                  aria-label="대화 목록"
                >
                  <ArrowLeft />
                </button>
              )}
              <div className="chat-title">
                <Avatar
                  name={roomAvatarMember?.name ?? room.name}
                  color={roomAvatarMember?.avatarColor}
                  image={roomAvatarMember?.avatarImage}
                  online={roomAvatarMember?.online}
                  availability={roomAvatarMember?.availability}
                  onClick={
                    roomAvatarMember && roomAvatarMember.id !== me.id
                      ? () => setSelectedEmployee(roomAvatarMember)
                      : undefined
                  }
                />
                <div>
                  <h2>{room.name}</h2>
                  <span>{room.memberCount}명 참여</span>
                </div>
              </div>
              <span className="secure-chat">
                <ShieldCheck /> 안전한 업무 채팅
              </span>
              <div className="header-actions">
                <button
                  className={chatSearchOpen ? "active" : ""}
                  aria-label="대화 검색"
                  onClick={() => {
                    setChatSearchOpen((open) => !open);
                    if (chatSearchOpen) setChatSearchQuery("");
                  }}
                >
                  <Search />
                </button>
                <button aria-label="음성 통화">
                  <Phone />
                </button>
                <button aria-label="영상 통화">
                  <Video />
                </button>
                <button
                  aria-label="참여자 초대"
                  onClick={() => setNewRoom(true)}
                >
                  <UserRoundPlus />
                </button>
                <button aria-label="더 보기">
                  <MoreHorizontal />
                </button>
              </div>
            </header>
            {chatSearchOpen && (
              <div className="chat-search-bar">
                <Search />
                <input
                  autoFocus
                  value={chatSearchQuery}
                  onChange={(event) => setChatSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter")
                      moveChatSearch(event.shiftKey ? -1 : 1);
                    if (event.key === "Escape") {
                      setChatSearchOpen(false);
                      setChatSearchQuery("");
                    }
                  }}
                  placeholder="대화 내용, 보낸 사람, 파일 검색"
                />
                <span>
                  {chatSearchMatches.length
                    ? `${chatSearchIndex + 1} / ${chatSearchMatches.length}`
                    : chatSearchQuery
                      ? "결과 없음"
                      : ""}
                </span>
                <button
                  onClick={() => moveChatSearch(-1)}
                  disabled={!chatSearchMatches.length}
                  aria-label="이전 검색 결과"
                >
                  <ChevronUp />
                </button>
                <button
                  onClick={() => moveChatSearch(1)}
                  disabled={!chatSearchMatches.length}
                  aria-label="다음 검색 결과"
                >
                  <ChevronDown />
                </button>
                <button
                  onClick={() => {
                    setChatSearchOpen(false);
                    setChatSearchQuery("");
                  }}
                  aria-label="검색 닫기"
                >
                  <X />
                </button>
              </div>
            )}
            <div className="messages scrollable" ref={messagesRef}>
              <div className="notice">
                <span>
                  안전한 병원 업무 소통을 위해 개인정보 전송에 유의해 주세요.
                </span>
              </div>
              {messages.map((m, index) => {
                const sender =
                  room.members.find((member) => member.id === m.senderId) ??
                  employees.find((employee) => employee.id === m.senderId);
                const selectedMatch =
                  chatSearchMatches[chatSearchIndex]?.id === m.id;
                return (
                  <React.Fragment key={m.id}>
                    {(index === 0 ||
                      dateKey(messages[index - 1].sentAt) !==
                        dateKey(m.sentAt)) && (
                      <div className="message-date-divider">
                        <span>{messageDate(m.sentAt)}</span>
                      </div>
                    )}
                  <div
                    data-message-id={m.id}
                    className={`message-row ${m.type === "SYSTEM" ? "system-message" : ""} ${m.senderId === me.id ? "mine" : ""} ${selectedMatch ? "search-current" : ""}`}
                    >
                      {m.senderId !== me.id && (
                        <Avatar
                          name={m.senderName}
                          color={sender?.avatarColor}
                          image={sender?.avatarImage}
                          online={sender?.online}
                          availability={sender?.availability}
                          onClick={
                            sender && sender.id !== me.id
                              ? () => setSelectedEmployee(sender)
                              : undefined
                          }
                        />
                      )}
                      <div className="bubble-wrap">
                        {m.senderId !== me.id && (
                          <strong>
                            {m.senderName}
                            {sender?.position && (
                              <small className="message-position">
                                {sender.position}
                              </small>
                            )}
                          </strong>
                        )}
                        <div className="bubble-line">
                          {m.senderId === me.id && (
                            <span className="message-meta">
                              {m.unreadCount > 0 && <b>{m.unreadCount}</b>}
                              <time>{time(m.sentAt)}</time>
                            </span>
                          )}
                          <div
                            className={`bubble ${m.file ? "attachment-bubble" : ""}`}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setMessageMenu({
                                x: event.clientX,
                                y: event.clientY,
                                message: m,
                              });
                            }}
                          >
                            {m.file ? (
                              <Attachment file={m.file} />
                            ) : (
                              <HighlightedText
                                text={m.content}
                                query={chatSearchQuery}
                              />
                            )}
                          </div>
                          {m.senderId !== me.id && (
                            <span className="message-meta">
                              {m.unreadCount > 0 && <b>{m.unreadCount}</b>}
                              <time>{time(m.sentAt)}</time>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            <footer className="composer">
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                  setPendingFile(e.target.files?.[0] ?? null);
                  e.currentTarget.value = "";
                }}
              />
              {replyTo && (
                <div className="reply-preview">
                  <MessageCircleMore />
                  <span>
                    <strong>{replyTo.senderName}에게 답장</strong>
                    <small>
                      {replyTo.file?.originalName ?? replyTo.content}
                    </small>
                  </span>
                  <button
                    onClick={() => setReplyTo(null)}
                    aria-label="답장 취소"
                  >
                    <X />
                  </button>
                </div>
              )}
              {pendingFile && (
                <PendingAttachment
                  file={pendingFile}
                  onRemove={() => setPendingFile(null)}
                />
              )}
              <div className="composer-tools">
                <button
                  className="attach-button"
                  onClick={() => fileRef.current?.click()}
                  aria-label="파일 첨부"
                  title="파일 첨부"
                >
                  <Paperclip />
                </button>
              </div>
              <div className="input-wrap">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    const shouldSend = preferences.enterToSend
                      ? e.key === "Enter" && !e.shiftKey
                      : e.key === "Enter" && e.ctrlKey;
                    if (shouldSend) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="메시지를 입력하세요"
                />
                <div>
                  <button>
                    <Smile />
                  </button>
                  <button
                    className="send-button"
                    onClick={() => void send()}
                    disabled={!text.trim() && !pendingFile}
                  >
                    <Send />
                  </button>
                </div>
              </div>
              <span className="input-hint">
                {pendingFile
                  ? "보내기 버튼을 누르면 첨부파일이 전송됩니다."
                  : preferences.enterToSend
                    ? "Enter 전송 · Shift + Enter 줄바꿈"
                    : "Ctrl + Enter 전송"}
              </span>
            </footer>
          </>
        ) : (
          <div className="empty-chat">
            <MessageCircleMore />
            <h2>대화를 시작해 보세요</h2>
            <p>직원을 선택해 새로운 대화방을 만들 수 있습니다.</p>
            <button onClick={() => setNewRoom(true)}>새 대화 시작</button>
          </div>
        )}
      </section>
      <aside className="info-panel">
        {room && (
          <>
            <div className="info-head">
              <h3>대화방 정보</h3>
              <button>
                <Menu />
              </button>
            </div>
            <div className="room-profile">
              <Avatar name={room.name} />
              <h3>{room.name}</h3>
              <p>업무 공유와 빠른 소통을 위한 공간입니다.</p>
            </div>
            <div className="info-block">
              <button className="info-row">
                <span>
                  <UsersRound /> 참여자
                </span>
                <b>{room.memberCount}</b>
              </button>
              {room.members.map((m, i) => (
                <div className="person compact" key={m.id}>
                  <Avatar
                    name={m.name}
                    index={i}
                    online={m.online}
                    availability={m.availability}
                    color={m.avatarColor}
                    image={m.avatarImage}
                    onClick={
                      m.id !== me.id ? () => setSelectedEmployee(m) : undefined
                    }
                  />
                  <span>
                    <strong>
                      {m.name}{" "}
                      {m.position && (
                        <small className="position-label">{m.position}</small>
                      )}
                    </strong>
                    {m.statusMessage && <em>{m.statusMessage}</em>}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
      {messageMenu && (
        <div
          className="message-context-menu unified-context-menu"
          style={{
            left: Math.min(messageMenu.x, window.innerWidth - 200),
            top: Math.min(messageMenu.y, window.innerHeight - 250),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="context-menu-head">
            <Avatar
              name={messageMenu.message.senderName}
              color={messageMenuSender?.avatarColor}
              image={messageMenuSender?.avatarImage}
            />
            <span>
              <strong>
                {messageMenu.message.senderName} {messageMenuSender?.position}
              </strong>
              <small>
                {messageMenu.message.file?.originalName ??
                  messageMenu.message.content}
              </small>
            </span>
          </div>
          <button
            onClick={() => {
              setReplyTo(messageMenu.message);
              setMessageMenu(null);
            }}
          >
            <MessageCircleMore /> 답장
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(
                messageMenu.message.file?.originalName ??
                  messageMenu.message.content ??
                  "",
              );
              setMessageMenu(null);
            }}
          >
            <Copy /> 복사
          </button>
          {messageMenu.message.file && (
            <button
              onClick={() => {
                void downloadMessageFile(messageMenu.message);
                setMessageMenu(null);
              }}
            >
              <Download /> 다운로드
            </button>
          )}
          {(messageMenu.message.senderId === me.id || me.role === "ADMIN") && (
            <button
              className="danger"
              onClick={() => {
                void deleteMessage(messageMenu.message);
                setMessageMenu(null);
              }}
            >
              <Trash2 /> 삭제
            </button>
          )}
        </div>
      )}
      {roomMenu && (
        <div
          className="employee-context-menu room-context-menu"
          style={{
            left: Math.min(roomMenu.x, window.innerWidth - 200),
            top: Math.min(roomMenu.y, window.innerHeight - 350),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div>
            <Avatar name={roomMenu.room.name} />
            <span>
              <strong>{roomMenu.room.name}</strong>
              <small>
                {roomMenu.room.memberCount}명 참여 · {roomMenu.room.unreadCount}
                개 읽지 않음
              </small>
            </span>
          </div>
          <button
            onClick={() => {
              openRoom(roomMenu.room.id);
              setRoomMenu(null);
            }}
          >
            <MessageCircleMore /> 채팅창 열기
          </button>
          <button
            onClick={() => {
              void markRoomRead(roomMenu.room);
              setRoomMenu(null);
            }}
          >
            <Clipboard /> 모두 읽음 처리
          </button>
          <button
            onClick={() => {
              void togglePinnedRoom(roomMenu.room);
              setRoomMenu(null);
            }}
          >
            <Star /> {roomMenu.room.pinned ? "상단 고정 해제" : "상단에 고정"}
          </button>
          <button
            onClick={() => {
              void toggleMutedRoom(roomMenu.room);
              setRoomMenu(null);
            }}
          >
            <Bell /> {roomMenu.room.muted ? "알림 다시 켜기" : "알림 끄기"}
          </button>
          <button
            onClick={() => {
              setRenameValue(roomMenu.room.name);
              setRenameRoom(roomMenu.room);
              setRoomMenu(null);
            }}
          >
            <Settings /> 대화방 이름 바꾸기
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(roomMenu.room.name);
              setRoomMenu(null);
            }}
          >
            <Copy /> 방 이름 복사
          </button>
          <button
            className="danger"
            onClick={() => {
              void leaveRoom(roomMenu.room);
              setRoomMenu(null);
            }}
          >
            <LogOut /> 대화방 나가기
          </button>
        </div>
      )}
      {directoryMenu && (
        <div
          className="employee-context-menu directory-context-menu"
          style={{
            left: Math.min(directoryMenu.x, window.innerWidth - 200),
            top: Math.min(
              directoryMenu.y,
              window.innerHeight - (directoryMenu.self ? 310 : 190),
            ),
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div>
            <Avatar
              name={directoryMenu.employee.name}
              color={directoryMenu.employee.avatarColor}
              image={directoryMenu.employee.avatarImage}
              availability={directoryMenu.employee.availability}
              online={directoryMenu.employee.online}
            />
            <span>
              <strong>
                {directoryMenu.employee.name} {directoryMenu.employee.position}
              </strong>
              <small>{directoryMenu.employee.departmentName}</small>
            </span>
          </div>
          {directoryMenu.self ? (
            <>
              <button
                onClick={() => {
                  void changeMyAvailability("ONLINE");
                  setDirectoryMenu(null);
                }}
              >
                <span className="availability-menu-dot status-online" /> 온라인
              </button>
              <button
                onClick={() => {
                  void changeMyAvailability("AWAY");
                  setDirectoryMenu(null);
                }}
              >
                <span className="availability-menu-dot status-away" /> 자리 비움
              </button>
              <button
                onClick={() => {
                  void changeMyAvailability("BUSY");
                  setDirectoryMenu(null);
                }}
              >
                <span className="availability-menu-dot status-busy" /> 다른 용무
                중
              </button>
              <button
                onClick={() => {
                  void changeMyAvailability("OFFLINE");
                  setDirectoryMenu(null);
                }}
              >
                <span className="availability-menu-dot status-offline" />{" "}
                오프라인
              </button>
              <button
                onClick={() => {
                  setProfileOpen(true);
                  setDirectoryMenu(null);
                }}
              >
                <Settings /> 내 정보 관리
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  void startDirectChat(directoryMenu.employee);
                  setDirectoryMenu(null);
                }}
              >
                <MessageCircleMore /> 대화하기
              </button>
              <button
                onClick={() => {
                  toggleFavorite(directoryMenu.employee.id);
                  setDirectoryMenu(null);
                }}
              >
                <Star />{" "}
                {favoriteIds.includes(directoryMenu.employee.id)
                  ? "즐겨찾기 해제"
                  : "즐겨찾기 추가"}
              </button>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(
                    [
                      directoryMenu.employee.name,
                      directoryMenu.employee.departmentName,
                      directoryMenu.employee.position,
                      directoryMenu.employee.statusMessage,
                    ]
                      .filter(Boolean)
                      .join(" · "),
                  );
                  setDirectoryMenu(null);
                }}
              >
                <Copy /> 직원 정보 복사
              </button>
            </>
          )}
        </div>
      )}
    </main>
  );
}

function App() {
  const [me, setMe] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(
    Boolean(session.token || (loadSettings().autoLogin && window.srghDesktop)),
  );
  useEffect(() => {
    const restoreSession = async () => {
      try {
        if (session.token) {
          setMe(await api.me());
          return;
        }
        if (!loadSettings().autoLogin || !window.srghDesktop) return;
        const credentials = await window.srghDesktop.getCredentials();
        if (!credentials) return;
        const result = await api.login(
          credentials.employeeNumber,
          credentials.password,
        );
        session.token = result.token;
        setMe(result.employee);
      } catch {
        session.token = null;
      } finally {
        setLoading(false);
      }
    };
    void restoreSession();
  }, []);
  useEffect(() => {
    const apply = (settings: MessengerSettings) => {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const resolvedTheme =
        settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : settings.theme;
      document.documentElement.dataset.theme = resolvedTheme;
      document.documentElement.style.setProperty(
        "--user-font-size",
        `${settings.fontSize}px`,
      );
      document.documentElement.style.setProperty("--user-font-scale", String(settings.fontSize / 12));
      document.documentElement.dataset.density = settings.density;
    };
    apply(loadSettings());
    return window.srghDesktop?.onSettingsChanged((settings) =>
      apply({ ...defaultSettings, ...settings }),
    );
  }, []);
  useEffect(() => {
    let fadeTimer = 0;
    let lowFadeTimer = 0;
    let hideTimer = 0;
    const showScrollbar = () => {
      document.documentElement.classList.remove(
        "scrollbar-fading",
        "scrollbar-fading-low",
      );
      document.documentElement.classList.add("scrollbar-active");
      window.clearTimeout(fadeTimer);
      window.clearTimeout(lowFadeTimer);
      window.clearTimeout(hideTimer);
      fadeTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("scrollbar-active");
        document.documentElement.classList.add("scrollbar-fading");
      }, 650);
      lowFadeTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("scrollbar-fading");
        document.documentElement.classList.add("scrollbar-fading-low");
      }, 880);
      hideTimer = window.setTimeout(() => {
        document.documentElement.classList.remove("scrollbar-fading-low");
      }, 1150);
    };
    window.addEventListener("scroll", showScrollbar, true);
    window.addEventListener("wheel", showScrollbar, { passive: true });
    return () => {
      window.removeEventListener("scroll", showScrollbar, true);
      window.removeEventListener("wheel", showScrollbar);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(lowFadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);
  const requestedRoomId =
    Number(new URLSearchParams(window.location.search).get("chatRoomId")) ||
    undefined;
  const standaloneChat = Boolean(requestedRoomId);
  const organization =
    new URLSearchParams(window.location.search).get("organization") === "1";
  const noticeId =
    Number(new URLSearchParams(window.location.search).get("noticeId")) ||
    undefined;
  const noticeCompose =
    new URLSearchParams(window.location.search).get("noticeCompose") === "1";
  const content = loading ? (
    <div className="loading-screen">
      <div className="brand-mark">
        S<span>+</span>
      </div>
      <p>사랑톡을 준비하고 있습니다</p>
    </div>
  ) : me ? (
    organization ? (
      <OrganizationWindow me={me} />
    ) : noticeCompose ? (
      <NoticeComposeWindow me={me} />
    ) : noticeId ? (
      <NoticeDetailWindow me={me} noticeId={noticeId} />
    ) : (
      <Messenger
        me={me}
        onMeChange={setMe}
        onLogout={() => setMe(null)}
        initialRoomId={requestedRoomId}
        standaloneChat={standaloneChat}
      />
    )
  ) : (
    <Login onLogin={setMe} />
  );
  return window.srghDesktop?.isDesktop ? (
    <div className="desktop-shell">
      <DesktopTitleBar />
      {content}
    </div>
  ) : (
    content
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
