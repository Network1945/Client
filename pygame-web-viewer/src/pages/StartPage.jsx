// StartPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IP_ADDR } from "./config";

/** ==== WS 서버 설정 ==== */
const START_WS_HOST = IP_ADDR;
const START_WS_PORT = 8000;
const START_WS_PATH = "/ws/stream/";

/** ==== HTTP API ==== */
const PACKET_API_URL = `http://${IP_ADDR}:8000/packet/api/send-packet/`;

export default function StartPage() {
  const [status, setStatus] = useState("connecting"); // connecting | open | closed | error
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const pingRef = useRef(null);

  /** URL 후보 2개 생성: /, 없음 */
  function buildUrls() {
    const wsProto = window.location.protocol === "https:" ? "wss" : "ws";
    const base1 = `${wsProto}://${START_WS_HOST}:${START_WS_PORT}${START_WS_PATH}`;
    const base2 = base1.replace(/\/+$/, "");
    return [base1, base2];
  }

  /** 단일 URL로 연결 시도 */
  function attempt(url) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      let opened = false;

      ws.onopen = () => { opened = true; resolve(ws); };
      ws.onerror = () => { if (!opened) reject(new Error("onerror")); };
      ws.onclose = (ev) => { if (!opened) reject(new Error(`close ${ev.code} ${ev.reason || ""}`)); };
    });
  }

  /** 순차 재시도: /ws/stream/ → /ws/stream */
  async function connectOnce() {
    const [u1, u2] = buildUrls();
    try { return await attempt(u1); }
    catch (e1) {
      console.warn("[WS] 1st failed:", u1, e1.message);
      return await attempt(u2);
    }
  }

  useEffect(() => {
    let wsLocal = null;

    (async () => {
      setStatus("connecting");
      try {
        wsLocal = await connectOnce();
        wsRef.current = wsLocal;
        setStatus("open");

        // keepalive
        pingRef.current = setInterval(() => {
          try { wsLocal.send(JSON.stringify({ type: "ping" })); } catch {}
        }, 25000);

        // 메시지 핸들링
        wsLocal.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            setMessages((prev) => [...prev, msg]);
          } catch {
            setMessages((prev) => [...prev, { type: "text", text: ev.data }]);
          }
        };

        wsLocal.onerror = () => setStatus("error");
        wsLocal.onclose = () => {
          setStatus("closed");
          clearInterval(pingRef.current);
          pingRef.current = null;
        };
      } catch (e) {
        console.error("WS connect failed:", e?.message);
        setStatus("error");
        alert(`웹소켓 연결 실패: ${e?.message || "원인 불명"}`);
      }
    })();

    return () => {
      clearInterval(pingRef.current);
      pingRef.current = null;
      wsRef.current?.close(1000, "leaving");
    };
  }, []);

  const sendMsg = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "chat", text }));
    setInput("");
  };

  /** ===== 패킷 전송 핸들러 ===== */
  const payloadByType = {
    ICMP: {
      type: "ICMP",
      count: 3,
      timeout: 1.0,
      iface: "en0",
      payload: "hello",
    },
    TCP: {
      type: "TCP",
      target_ip: "192.168.0.10",
      tcp_flags: "S",
      count: 1,
      iface: "en0",
    },
    UDP: {
      type: "UDP",
      count: 1,
      iface: "en0",
      payload: "game-msg",
    },
    ARP: {
      type: "ARP",
      iface: "en0",
      timeout: 1.0,
    },
  };
    async function sendPacket(kind) {
    const body = payloadByType[kind];
    if (!body) return;
    try {
    await fetch(PACKET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    // 응답/에러를 UI에 표시하지 않음 (필요하면 console 사용)
    console.log("sent", kind);
    } catch (err) {
        console.error("send failed:", err);
    }
}

  /** 원형 버튼 공통 스타일 */
  const circleBtn = (bg) => ({
    width: 76,
    height: 76,
    borderRadius: "50%",
    border: "none",
    color: "#fff",
    fontWeight: 700,
    fontSize: 16,
    cursor: "pointer",
    background: bg,
    boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  });

  return (
    <div className="viewport">
      <div className="canvas">
        {/* 상단 탭 */}
        <div className="tab main">
          <Link to="/MainPage"><span>메인 화면</span></Link>
        </div>
        <div className="tab start">
          <Link to="/StartPage"><span>시작하기</span></Link>
        </div>

        {/* 탭 아래 1px 외곽선 */}
        <div className="contentFrame" />

        <div style={{ padding: 24 }}>
          <h2 style={{ marginBottom: 8 }}>
            PyGame{" "}
            <small style={{ fontSize: 14, color: "#666" }}>({status})</small>
          </h2>

          {/* ===== 여기: PyGame 제목 바로 아래 4개의 원형 버튼 ===== */}
          <div style={{ display: "flex", gap: 14, margin: "8px 0 14px 0" }}>
            <button
              title="Send TCP packet"
              style={circleBtn("#4dabf7")} // 파랑
              onClick={() => sendPacket("TCP")}
            >TCP</button>

            <button
              title="Send UDP packet"
              style={circleBtn("#51cf66")} // 초록
              onClick={() => sendPacket("UDP")}
            >UDP</button>

            <button
              title="Send ICMP packet"
              style={circleBtn("#ff6b6b")} // 빨강/코랄
              onClick={() => sendPacket("ICMP")}
            >ICMP</button>

            <button
              title="Send ARP packet"
              style={circleBtn("#fcc419")} // 노랑
              onClick={() => sendPacket("ARP")}
            >ARP</button>
          </div>
          {/* =============================================== */}

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
            {/* 메시지 로그 */}
            <div style={{ background: "#F6F6F6", border: "1px solid #ddd", borderRadius: 10, padding: 16, height: 470, overflow: "auto" }}>
              {messages.length === 0 && <div style={{ color: "#888" }}>수신된 메시지가 없습니다.</div>}
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <code style={{ whiteSpace: "pre-wrap" }}>
                    {m?.type ? JSON.stringify(m) : String(m)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
