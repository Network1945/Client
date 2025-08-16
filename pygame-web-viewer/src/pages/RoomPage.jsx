// RoomPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { IP_ADDR } from "./config";
/** WS 서버 주소 */
const HOST = `${IP_ADDR}:8000`;

/** (옵션) JWT 파싱 – 닉네임 fallback 용 */
function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}

/** 표시용 닉네임: localStorage.nickName → JWT(name/nickname) → "Guest" */
function getDisplayName() {
  const n1 = (localStorage.getItem("nickName") || "").trim();
  if (n1) return n1;

  const token =
    sessionStorage.getItem("accessToken") ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("authToken") ||
    "";

  const p = parseJwt(token) || {};
  const n2 = (p.name || p.nickname || p.nickName || "").trim();
  return n2 || "Guest";
}

/** 전역 레지스트리: roomId별 소켓 추적/정리 (옵션) */
function registerSocket(roomId, kind, ws) {
  window.__roomSockets = window.__roomSockets || {};
  const entry = window.__roomSockets[roomId] || {};
  entry[kind] = ws;
  window.__roomSockets[roomId] = entry;
}
function closeRoomSockets(roomId, reason = "deleted") {
  const entry = window.__roomSockets?.[roomId];
  if (!entry) return;
  try { entry.main?.close(1000, reason); } catch {}
  delete window.__roomSockets[roomId];
}

/** 안전 전송: JSON 우선, 실패 시 텍스트 */
function safeSend(ws, payload, asText = false) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(asText ? String(payload) : JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** URL: /ws/rooms/:roomId?name=닉네임  (끝 슬래시 없음) */
function buildUrl(roomId, name) {
  const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${wsProto}://${HOST}/ws/rooms/${encodeURIComponent(roomId)}?name=${encodeURIComponent(name)}`;
}

/** 하나의 URL로 연결 시도 */
function attempt(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let opened = false;

    ws.onopen = () => { opened = true; resolve(ws); };
    ws.onerror = () => { if (!opened) reject(new Error("onerror")); };
    ws.onclose = (ev) => { if (!opened) reject(new Error(`close ${ev.code} ${ev.reason || ""}`)); };
  });
}

/** ✅ 멤버 표준화: 문자열 → {name}, 객체면 name/nickname/userId/id 중 하나를 name으로 */
function normalizeMembers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return { name: x };
      if (typeof x === "object") {
        const name = x.name || x.nickname || x.nickName || x.userId || x.id || "";
        return { ...x, name: String(name) };
      }
      return null;
    })
    .filter(Boolean);
}

export default function RoomPage() {
  const { id: roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);  // always [{name: "..."}]
  const [count, setCount] = useState(0);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const wsRef = useRef(null);         // 메인 소켓
  const pingRef = useRef(null);       // ping interval
  const whoTimerRef = useRef(null);   // 2초 who interval
  const reconnectTimer = useRef(null);
  const shouldReconnect = useRef(true);

  const username = getDisplayName();

  function connectOnce() {
    return attempt(buildUrl(roomId, username));
  }

  /** 방 삭제 */
  const handleDeleteRoom = async () => {
    if (!window.confirm("이 방을 삭제하시겠어요?")) return;

    shouldReconnect.current = false;
    try { clearInterval(pingRef.current); } catch {}
    try { clearInterval(whoTimerRef.current); } catch {}
    pingRef.current = null;
    whoTimerRef.current = null;
    try { wsRef.current?.close(1000, "deleted"); } catch {}

    const headers = { "Content-Type": "application/json" };
    const token =
      sessionStorage.getItem("accessToken") ||
      localStorage.getItem("accessToken") ||
      localStorage.getItem("authToken") ||
      "";
    if (token) headers.Authorization = `Bearer ${token}`;

    const tries = [
      { url: `http://${HOST}/rooms/${encodeURIComponent(roomId)}/delete/`, method: "DELETE" },
      { url: `http://${HOST}/rooms/${encodeURIComponent(roomId)}/`, method: "DELETE" },
      { url: `http://${HOST}/rooms/delete/`, method: "POST", body: JSON.stringify({ roomId }) },
    ];
    for (const t of tries) {
      try {
        const res = await fetch(t.url, { method: t.method, headers, credentials: "include", body: t.body });
        if (res.ok) break;
      } catch {}
    }

    try {
      const rooms = JSON.parse(localStorage.getItem("rooms") || "[]");
      const details = JSON.parse(localStorage.getItem("roomDetails") || "[]");
      const detail = details.find((d) => d.id === roomId);
      const nameToRemove = detail?.name;
      const nextRooms = nameToRemove ? rooms.filter((r) => r !== nameToRemove) : rooms;
      const nextDetails = details.filter((d) => d.id !== roomId);
      nextRooms.length ? localStorage.setItem("rooms", JSON.stringify(nextRooms)) : localStorage.removeItem("rooms");
      nextDetails.length ? localStorage.setItem("roomDetails", JSON.stringify(nextDetails)) : localStorage.removeItem("roomDetails");
    } catch {}

    navigate("/MainPage", { replace: true });
  };

  // 삭제 브로드캐스트 수신 시 정리하고 메인으로
  useEffect(() => {
    const onRoomDeleted = (ev) => {
      const deletedId = ev?.detail?.id;
      if (deletedId && deletedId === roomId) {
        shouldReconnect.current = false;
        closeRoomSockets(roomId, "deleted");
        navigate("/MainPage");
      }
    };
    window.addEventListener("room-delete", onRoomDeleted);
    return () => window.removeEventListener("room-delete", onRoomDeleted);
  }, [roomId, navigate]);

  /** 연결된 소켓에 핸들러 부착 */
  function attach(ws) {
    wsRef.current = ws;
    registerSocket(roomId, "main", ws);

    ws.onopen = () => {
      if (!safeSend(ws, { type: "who" })) safeSend(ws, "who", true);

      pingRef.current = setInterval(() => {
        safeSend(ws, { type: "ping" }) || safeSend(ws, "ping", true);
      }, 25000);

      whoTimerRef.current = setInterval(() => {
        if (!safeSend(ws, { type: "who" })) safeSend(ws, "who", true);
      }, 2000);
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return; // JSON이 아니면 무시
      }

      switch (msg?.type) {
        case "presence_update": {
          const norm = normalizeMembers(msg.members);
          setMembers(norm);
          setCount(Number(msg.count) || norm.length || 0);
          return;
        }
        case "presence_count": {
          // 서버가 문자열 배열로 내려줄 수 있음
          const norm = normalizeMembers(msg.members);
          if (norm.length) setMembers(norm);
          setCount(Number(msg.count) || norm.length || 0);
          return;
        }
        case "chat": {
          if (typeof msg.text === "string" && msg.text.trim()) {
            setMessages((prev) => [
              ...prev,
              { type: "chat", from: msg.from || msg.name || "익명", text: msg.text },
            ]);
          }
          return;
        }
        case "system": {
          if (msg.text) setMessages((prev) => [...prev, { type: "system", text: msg.text }]);
          return;
        }
        default:
          return;
      }
    };

    ws.onerror = () => {};

    ws.onclose = () => {
      clearInterval(pingRef.current);
      pingRef.current = null;
      clearInterval(whoTimerRef.current);
      whoTimerRef.current = null;

      if (shouldReconnect.current) {
        reconnectTimer.current = setTimeout(async () => {
          try {
            const ws2 = await connectOnce();
            attach(ws2);
          } catch (e) {
            alert(`웹소켓 재연결 실패: ${e?.message || "원인 불명"}`);
          }
        }, 2000);
      }
    };
  }

  // 메인 소켓 연결 & 정리
  useEffect(() => {
    shouldReconnect.current = true;

    (async () => {
      try {
        const ws = await connectOnce();
        attach(ws);
      } catch (e) {
        alert(`웹소켓 연결에 실패했습니다: ${e?.message || "원인 불명"}`);
      }
    })();

    return () => {
      shouldReconnect.current = false;
      clearInterval(pingRef.current);
      pingRef.current = null;
      clearInterval(whoTimerRef.current);
      whoTimerRef.current = null;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close(1000, "leaving");
    };
  }, [roomId]);

  /** 채팅 전송 */
  const sendChat = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("연결이 끊어졌습니다.");
      return;
    }
    wsRef.current.send(JSON.stringify({ type: "chat", text, from: username }));
    setInput("");
  };

  return (
    <div className="viewport">
      <div className="canvas">
        <div className="tab main">
          <Link to="/MainPage"><span>메인 화면</span></Link>
        </div>
        <div className="tab start">
          <Link to="/StartPage"><span>시작하기</span></Link>
        </div>
        <button
          className="tab delete"
          onClick={handleDeleteRoom}
          style={{
            left: 509.6, width: 140,
            background: "#ffc9c9", border: "1px solid #bbb", cursor: "pointer"
          }}
          title="이 방을 삭제합니다"
        >
          <span>삭제</span>
        </button>

        <div className="contentFrame" />

        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>
            방: <b>{location.state?.name || roomId}</b>
          </h2>
          <div style={{ marginBottom: 16 }}>접속 인원: {count}</div>

          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
            {/* 참여자 */}
            <div style={{ background: "#F6F6F6", border: "1px solid #ddd", borderRadius: 10, padding: 16, minHeight: 420 }}>
              <b>참여자</b>
              <ul style={{ marginTop: 10, listStyle: "none", padding: 0 }}>
                {members.map((m, idx) => (
                  <li key={m.userId || m.id || m.name || idx} style={{ marginBottom: 6 }}>
                    {m.name || m.nickname || m.userId || m.id}
                  </li>
                ))}
              </ul>
            </div>

            {/* 채팅 */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ background: "#F6F6F6", border: "1px solid #ddd", borderRadius: 10, padding: 16, height: 420, overflow: "auto" }}>
                {messages.map((m, i) => (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {m.type === "system" ? (
                      <em>{m.text}</em>
                    ) : (
                      <>
                        <b>{m.from || "나"}</b>: {m.text}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <form onSubmit={sendChat} style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="메시지를 입력하세요"
                  style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #ccc", padding: "0 12px" }}
                />
                <button
                  type="submit"
                  style={{ width: 90, height: 44, borderRadius: 10, border: "1px solid #bbb", background: "#E6E6E6", cursor: "pointer" }}
                >
                  전송
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
