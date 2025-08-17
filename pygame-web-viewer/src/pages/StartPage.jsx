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
  const [logs, setLogs] = useState([]);               // 디버그 로그 (최근 200개 유지)
  const [frameSrc, setFrameSrc] = useState(null);     // <img src>
  const [frameNo, setFrameNo] = useState(null);
  const [frameCount, setFrameCount] = useState(0);
  const [lastAt, setLastAt] = useState(null);
  const [input, setInput] = useState("");

  const wsRef = useRef(null);
  const pingRef = useRef(null);
  const objectUrlRef = useRef(null); // Blob URL 정리용

  // === 실시간 디버그용 상태 ===
  const [rxCount, setRxCount] = useState(0);      // 총 수신 프레임 수
  const [rxBytes, setRxBytes] = useState(0);      // 총 수신 바이트
  const [fps, setFps] = useState(0);              // 최근 1초 FPS
  const [bps, setBps] = useState(0);              // 최근 1초 수신 바이트/초
  const [lastLen, setLastLen] = useState(0);      // 마지막 프레임 바이트
  const [lastType, setLastType] = useState("");   // 마지막 프레임 타입 표시
  const [lastRawPreview, setLastRawPreview] = useState(""); // 마지막 JSON/텍스트 미리보기
  const meterRef = useRef({ ticks: 0, bytes: 0 });

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
      // 🔧 바이너리 프레임도 처리
      ws.binaryType = "arraybuffer";
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

  // 디버그 로그 유틸
  function addLog(line) {
    const t = new Date().toLocaleTimeString();
    const s = `[${t}] ${line}`;
    console.log(s);
    setLogs((prev) => {
      const next = [...prev, s];
      if (next.length > 200) next.shift();
      return next;
    });
  }

  // 사람이 읽기 좋은 바이트 단위
  function prettyBytes(n) {
    if (!Number.isFinite(n)) return `${n}`;
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0, v = n;
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
  }

  // base64 길이를 대략적인 바이트로 환산
  function base64BytesLen(b64) {
    if (!b64) return 0;
    const body = b64.startsWith("data:") ? (b64.split(",")[1] || "") : b64;
    const pad = (body.endsWith("==") ? 2 : body.endsWith("=") ? 1 : 0);
    return Math.max(0, Math.floor((body.length * 3) / 4) - pad);
  }

  // 1초마다 FPS/BPS 계산
  useEffect(() => {
    const t = setInterval(() => {
      setFps(meterRef.current.ticks);
      setBps(meterRef.current.bytes);
      meterRef.current.ticks = 0;
      meterRef.current.bytes = 0;
    }, 1000);
    return () => clearInterval(t);
  }, []);

  function bump(bytes, typeLabel) {
    meterRef.current.ticks += 1;
    meterRef.current.bytes += (bytes || 0);
    setRxCount((c) => c + 1);
    setRxBytes((b) => b + (bytes || 0));
    setLastLen(bytes || 0);
    setLastType(typeLabel || "");
  }

  // base64 문자열 추정
  const isProbablyBase64 = (s) =>
    typeof s === "string" &&
    (s.startsWith("data:image/") || /^[A-Za-z0-9+/=]+$/.test(s));

  // 수신된 base64를 <img>로 세팅
  function showBase64(payload, prefer = "png") {
    const src = payload.startsWith("data:image/")
      ? payload
      : `data:image/${prefer};base64,${payload}`;
    // 이미지 onerror도 잡아서 로그
    const testImg = new Image();
    testImg.onload = () => {
      setFrameSrc(src);
      setFrameCount((c) => c + 1);
      setLastAt(new Date());
    };
    testImg.onerror = () => {
      addLog(`❌ image onerror (base64 length=${payload.length})`);
    };
    testImg.src = src;
  }

  // 수신된 바이너리(Blob/ArrayBuffer)를 <img>로 세팅
  function showBinary(buf, typeGuess = "image/png") {
    try {
      const blob = buf instanceof Blob ? buf : new Blob([buf], { type: typeGuess });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const testImg = new Image();
      testImg.onload = () => {
        setFrameSrc(url);
        setFrameCount((c) => c + 1);
        setLastAt(new Date());
      };
      testImg.onerror = () => addLog("❌ image onerror (binary)");
      testImg.src = url;
    } catch (e) {
      addLog(`❌ showBinary failed: ${e?.message}`);
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
        addLog("✅ WebSocket open");

        // keepalive
        pingRef.current = setInterval(() => {
          try {
            wsLocal.send(JSON.stringify({ type: "ping" }));
            addLog("→ ping");
          } catch {}
        }, 25000);

        // 메시지 핸들링
        wsLocal.onmessage = (ev) => {
          const raw = ev.data;

          // 🔎 바이너리?
          if (raw instanceof ArrayBuffer || raw instanceof Blob) {
            const sz = raw instanceof Blob ? raw.size : raw.byteLength;
            addLog(`← binary frame (${sz} bytes)`);
            bump(sz, "binary");
            setLastRawPreview(`(binary ${prettyBytes(sz)})`);
            showBinary(raw); // 타입 미지정시 image/png 추정
            return;
          }

          // 🔎 텍스트
          if (typeof raw === "string") {
            // 너무 긴 base64라면 바로 이미지로 시도
            if (isProbablyBase64(raw) && raw.length > 200) {
              const approx = base64BytesLen(raw);
              addLog(`← long text (looks like base64, len=${raw.length}, ~${prettyBytes(approx)})`);
              bump(approx, "base64(text)");
              setLastRawPreview(`${raw.slice(0, 80)}…`);
              showBase64(raw);
              return;
            }

            // JSON 파싱
            try {
              const msg = JSON.parse(raw);

              // 각종 키 요약 로그
              const keys = Object.keys(msg);
              addLog(`← json keys=[${keys.join(", ")}]`);

              // 서버 포맷: { frame_no, payload }
              if ("payload" in msg && (typeof msg.payload === "string")) {
                setFrameNo(msg.frame_no ?? null);
                const approx = base64BytesLen(msg.payload);
                addLog(
                  `   frame payload (no=${msg.frame_no ?? "?"}, len=${msg.payload.length}, ~${prettyBytes(approx)})`
                );
                bump(approx, "json/base64");
                setLastRawPreview(
                  JSON.stringify({ ...msg, payload: `(base64 ${prettyBytes(approx)})` }).slice(0, 120) + "…"
                );
                showBase64(msg.payload);
                return;
              }

              // 혹시 다른 필드명으로 올 수도 있음 (image/data 등)
              if (typeof msg.image === "string") {
                setFrameNo(msg.frame_no ?? null);
                const approx = base64BytesLen(msg.image);
                addLog(`   image field (len=${msg.image.length}, ~${prettyBytes(approx)})`);
                bump(approx, "json/image");
                setLastRawPreview(
                  JSON.stringify({ ...msg, image: `(base64 ${prettyBytes(approx)})` }).slice(0, 120) + "…"
                );
                showBase64(msg.image);
                return;
              }
              if (typeof msg.data === "string" && isProbablyBase64(msg.data)) {
                setFrameNo(msg.no ?? msg.frame_no ?? null);
                const approx = base64BytesLen(msg.data);
                addLog(`   data field (len=${msg.data.length}, ~${prettyBytes(approx)})`);
                bump(approx, "json/data");
                setLastRawPreview(
                  JSON.stringify({ ...msg, data: `(base64 ${prettyBytes(approx)})` }).slice(0, 120) + "…"
                );
                showBase64(msg.data);
                return;
              }

              // 정보/로그 메시지
              setLastRawPreview(raw.slice(0, 160));
              setLogs((prev) => {
                const next = [...prev, `[${new Date().toLocaleTimeString()}] ${raw}`];
                if (next.length > 200) next.shift();
                return next;
              });
            } catch {
              addLog(`← text (non-JSON, len=${raw.length})`);
              setLastRawPreview(raw.slice(0, 160));
              setLogs((prev) => {
                const next = [...prev, `[${new Date().toLocaleTimeString()}] ${raw}`];
                if (next.length > 200) next.shift();
                return next;
              });
            }
          }
        };

        wsLocal.onerror = () => {
          setStatus("error");
          addLog("❌ WebSocket error");
        };
        wsLocal.onclose = () => {
          setStatus("closed");
          addLog("⛔ WebSocket closed");
          clearInterval(pingRef.current);
          pingRef.current = null;
        };
      } catch (e) {
        console.error("WS connect failed:", e?.message);
        setStatus("error");
        addLog(`❌ connect failed: ${e?.message || "unknown"}`);
        alert(`웹소켓 연결 실패: ${e?.message || "원인 불명"}`);
      }
    })();

    return () => {
      clearInterval(pingRef.current);
      pingRef.current = null;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      wsRef.current?.close(1000, "leaving");
    };
  }, []);

  /** ===== 패킷 전송 핸들러 ===== */
  const payloadByType = {
    ICMP: { type: "ICMP", count: 3, timeout: 1.0, iface: "en0", payload: "hello" },
    TCP:  { type: "TCP", tcp_flags: "S", count: 1, iface: "en0" },
    UDP:  { type: "UDP", count: 1, iface: "en0", payload: "game-msg" },
    ARP:  { type: "ARP", iface: "en0", timeout: 1.0 },
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
      addLog(`→ HTTP send-packet ${kind}`);
    } catch (err) {
      addLog(`❌ send-packet failed: ${err?.message}`);
    }
  }

  const sendMsg = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== 1) return;
    wsRef.current.send(JSON.stringify({ type: "chat", text }));
    addLog(`→ chat "${text}"`);
    setInput("");
  };

  /** 원형 버튼 공통 스타일 */
  const circleBtn = (bg) => ({
    width: 76, height: 76, borderRadius: "50%", border: "none",
    color: "#fff", fontWeight: 700, fontSize: 16, cursor: "pointer",
    background: bg, boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
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
            <small style={{ fontSize: 14, color: "#666" }}>
              ({status}{frameNo != null ? ` · #${frameNo}` : ""}{frameCount ? ` · ${frameCount} frames` : ""})
              {lastAt ? ` · last ${lastAt.toLocaleTimeString()}` : ""}
            </small>
          </h2>

          {/* 컨트롤 버튼들 */}
          <div style={{ display: "flex", gap: 14, margin: "8px 0 14px 0" }}>
            <button title="Send TCP packet"  style={circleBtn("#4dabf7")} onClick={() => sendPacket("TCP")}>TCP</button>
            <button title="Send UDP packet"  style={circleBtn("#51cf66")} onClick={() => sendPacket("UDP")}>UDP</button>
            <button title="Send ICMP packet" style={circleBtn("#ff6b6b")} onClick={() => sendPacket("ICMP")}>ICMP</button>
            <button title="Send ARP packet"  style={circleBtn("#fcc419")} onClick={() => sendPacket("ARP")}>ARP</button>
          </div>

          {/* ✅ 실시간 프레임 표시 영역 */}
          <div
            style={{
              background: "#111",
              border: "1px solid #333",
              borderRadius: 10,
              height: 420,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              marginBottom: 12,
              position: "relative",
            }}
          >
            {/* 디버그 HUD */}
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                background: "rgba(0,0,0,0.55)",
                color: "#d1fae5",
                padding: "8px 10px",
                borderRadius: 8,
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                fontSize: 12,
                lineHeight: 1.4,
                pointerEvents: "none",
                maxWidth: 480,
              }}
            >
              <div><b>WS</b> {status} · <b>frame</b> #{frameNo ?? "-"} · <b>total</b> {frameCount}f</div>
              <div><b>FPS</b> {fps} · <b>In</b> {prettyBytes(bps)}/s</div>
              <div><b>Last</b> {lastType} · {prettyBytes(lastLen)}{lastAt ? ` · ${lastAt.toLocaleTimeString()}` : ""}</div>
              {lastRawPreview && (
                <div style={{ color: "#a7f3d0", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {lastRawPreview}
                </div>
              )}
            </div>

            {frameSrc ? (
              <img
                src={frameSrc}
                alt="pygame-stream"
                style={{ maxWidth: "100%", maxHeight: "100%", imageRendering: "pixelated" }}
              />
            ) : (
              <div style={{ color: "#aaa" }}>프레임 대기중…</div>
            )}
          </div>

          {/* 🔍 Debug 패널: 최근 로그 */}
          <div style={{ background: "#f6f6f6", border: "1px solid #ddd", borderRadius: 10, padding: 12, height: 200, overflow: "auto", marginBottom: 12 }}>
            {logs.length === 0 && <div style={{ color: "#888" }}>로그 없음</div>}
            {logs.map((line, i) => (
              <div key={i} style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: 12 }}>
                {line}
              </div>
            ))}
          </div>

          {/* (선택) 간단 채팅 전송 폼 */}
          <form onSubmit={sendMsg} style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="서버로 chat 전송 (디버깅용)"
              style={{ flex: 1, padding: "8px 10px", border: "1px solid #ccc", borderRadius: 8 }}
            />
            <button type="submit" style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
              보내기
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
