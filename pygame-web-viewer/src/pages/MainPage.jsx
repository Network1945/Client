import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { IP_ADDR } from "./config";

export default function MainPage() {
  const navigate = useNavigate();

  // 로그인 상태
  const [authed, setAuthed] = useState(localStorage.getItem("isLoggedIn") === "1");
  useEffect(() => {
    const onAuth = () => setAuthed(localStorage.getItem("isLoggedIn") === "1");
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
  }, []);

  // 로그아웃
  const handleLogout = () => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authToken");
    localStorage.removeItem("nickName");
    localStorage.removeItem("isLoggedIn");
    window.dispatchEvent(new Event("auth-changed"));
    navigate("/MainPage", { replace: true });
  };

  const scrollRef = useRef(null);

  // rooms 초기 로드
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem("rooms");
    return saved ? JSON.parse(saved) : [];
  });

  const [nickName, setNickName] = useState(localStorage.getItem("nickName") || "NickName");
  useEffect(() => {
    const onAuth = () => setNickName(localStorage.getItem("nickName") || "NickName");
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
  }, []);

  // === 방만들기 모달 ===
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  const openCreate = () => setShowCreate(true);

  // 만들기: 서버로 POST -> 성공 시 목록 갱신 + 이동
  // 만들기: 서버로 POST -> 성공 시 목록 갱신 + 이동
  const handleCreateRoom = async (name, password) => {
    if (creating) return;
    const roomName = (name || "").trim();
    if (!roomName) {
      alert("방 이름을 입력해주세요.");
      return;
    }

    setCreating(true);
    try {
      const accessToken =
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        "";

      const payload = {
        name: roomName,
        password: password || "",
        variable: accessToken, // 서버가 body로도 토큰 받는다면 유지
      };

      const res = await fetch(`http://${IP_ADDR}:8000/rooms/create/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const err = await res.json();
          if (err?.detail) msg += ` - ${Array.isArray(err.detail) ? err.detail[0]?.msg : err.detail}`;
        } catch {}
        if (res.status === 401) {
          alert("로그인이 필요합니다. 다시 로그인해 주세요.");
          navigate("/Login");
          return;
        }
        throw new Error(msg);
      }

      // ✅ 서버 응답: { roomId, name, password }
      const data = await res.json();

      if (!data?.roomId) {
        throw new Error("서버가 roomId를 반환하지 않았습니다.");
      }

      // 화면 표시용 이름은 서버가 준 name 우선, 없으면 입력값 사용
      const displayName = data.name || roomName;

      // 목록 + 저장
      const updatedRooms = [displayName, ...rooms];
      setRooms(updatedRooms);
      localStorage.setItem("rooms", JSON.stringify(updatedRooms));

      // 상세 저장 (id 필수)
      const details = JSON.parse(localStorage.getItem("roomDetails") || "[]");
      const detail = { id: data.roomId, name: displayName };
      if (typeof data.password !== "undefined") detail.password = data.password;
      details.push(detail);
      localStorage.setItem("roomDetails", JSON.stringify(details));

      // 모달 닫고, ✅ roomId로 이동
      setShowCreate(false);
      navigate(`/room/${encodeURIComponent(data.roomId)}`, {
        state: { id: data.roomId, name: displayName, nickname: nickName },
      });
    } catch (e) {
      console.error(e);
      alert("방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCreating(false);
    }
  };


  // 방 카드 "입장"
  const handleEnterRoom = (index, title) => {
    const details = JSON.parse(localStorage.getItem("roomDetails") || "[]");
    const found = details.find((r) => r.name === title);
    const id = found ? found.id : `idx-${index}`;
    navigate(`/room/${encodeURIComponent(id)}`, { id, name: title, nickname: nickName });
  };

  // ✅ 방 카드 "삭제" (해당 인덱스만 제거)
  const handleDeleteRoom = (idxToRemove) => {
    const name = rooms[idxToRemove];
    const detailsAll = JSON.parse(localStorage.getItem("roomDetails") || "[]");
    const removedDetails = detailsAll.filter((r) => r.name === name);

    removedDetails.forEach((d) => {
      const id = d.id;
      const entry = window.__roomSockets?.[id];
      if (entry) {
        try { entry.main?.close(1000, "deleted"); } catch {}
        try { entry.poll?.close(1000, "deleted"); } catch {}
        delete window.__roomSockets[id];
      }
    });

    removedDetails.forEach((d) => {
      window.dispatchEvent(new CustomEvent("room-delete", { detail: { id: d.id } }));
    });

    if (!window.confirm(`'${name}' 방을 목록에서 제거할까요?`)) return;

    const updated = rooms.filter((_, i) => i !== idxToRemove);
    setRooms(updated);
    updated.length
      ? localStorage.setItem("rooms", JSON.stringify(updated))
      : localStorage.removeItem("rooms");

    // roomDetails 에서 같은 이름을 가진 항목 제거(여러 개면 모두 삭제)
    const details = JSON.parse(localStorage.getItem("roomDetails") || "[]")
      .filter((r) => r.name !== name);
    details.length
      ? localStorage.setItem("roomDetails", JSON.stringify(details))
      : localStorage.removeItem("roomDetails");
  };

  return (
    <div className="viewport">
      <div className={`canvas ${authed ? "authed" : ""}`}>
        {/* 상단 탭 */}
        <div className="tab main">
          <Link to="/MainPage"><span>메인 화면</span></Link>
        </div>

        {!authed ? (
          <>
            <div className="tab signup"><Link to="/Signup"><span>회원가입</span></Link></div>
            <div className="tab login"><Link to="/Login"><span>로그인</span></Link></div>
          </>
        ) : (
          <>
            <button className="tab create" onClick={openCreate}><span>방만들기</span></button>
            <div className="tab profile"><Link to="/ProfileEdit"><span>프로필 편집</span></Link></div>
            <button className="tab logout" onClick={handleLogout}><span>로그아웃</span></button>
          </>
        )}

        {/* 좌상/우상 영역 */}
        <div className="leftTop" />
        <div className="rightTop">

          <div className="rooms" ref={scrollRef}>
            {rooms.map((room, i) => (
              <RoomCard
                key={`${room}-${i}`}
                index={i + 1}
                title={room}
                onEnter={handleEnterRoom}
                onDelete={() => handleDeleteRoom(i)}
              />
            ))}
          </div>
        </div>

        {/* 하단 좌측 */}
        <div className="leftBottom" />
        <div className="myInfoTitle">
          <img src="/icons/person.png" alt="내 정보 아이콘" className="icon" />
          <span>내 정보</span>
        </div>
        <div className="avatar" />
        <div className="nickname">{nickName}</div>

        {/* 하단 우측 */}
        <div className="rightBottom" />
        <div className="chatTitle">
          <span>채팅</span>
          <img src="/icons/chat.png" alt="채팅 아이콘" className="icon" />
        </div>
        <input className="chatInput" placeholder="메시지를 입력하세요" />
        <button className="sendBtn">전송</button>

        {/* 방만들기 모달 */}
        {showCreate && (
          <CreateRoomModal
            onClose={() => setShowCreate(false)}
            onCreate={(name, pw) => handleCreateRoom(name, pw)}
            creating={creating}
          />
        )}
      </div>
    </div>
  );
}

function RoomCard({ index, title, onEnter, onDelete }) {
  return (
    <div className="roomCard">
      <div className="roomIdx"><span>{String(index).padStart(2, "0")}</span></div>
      <div className="roomBody">
        <div className="roomTitle">{title}</div>
        <button className="roomEntry" onClick={() => onEnter(index, title)}>입장</button>
      </div>
    </div>
  );
}

/* 모달 */
function CreateRoomModal({ onClose, onCreate, creating }) {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");

  const submit = (e) => {
    e.preventDefault();
    onCreate(name, pw);
  };

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard">
        <div className="modalHeader">
          <div>방만들기</div>
          <button className="modalClose" aria-label="close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit}>
          <div className="modalRow">
            <div className="modalLabel">방 이름</div>
            <input
              className="modalInput"
              placeholder="예: 스트라이커즈 1방"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="modalRow">
            <div className="modalLabel">비밀번호</div>
            <input
              type="password"
              className="modalInput"
              placeholder="(선택)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>

          <div className="modalFooter">
            <button type="submit" className="modalCreateBtn" disabled={creating}>
              {creating ? "만드는 중..." : "만들기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
