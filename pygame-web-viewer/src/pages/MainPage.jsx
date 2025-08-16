import React, { useRef, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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
    return saved ? JSON.parse(saved) : ["테스트 방", "2번장", "5번방"];
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

      // ✅ 엔드포인트 확인: /createroom
      const res = await fetch("http://localhost:8000/createroom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: roomName, variable: accessToken }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));

      // 목록 + 저장
      const updatedRooms = [roomName, ...rooms];
      setRooms(updatedRooms);
      localStorage.setItem("rooms", JSON.stringify(updatedRooms));

      // 상세 저장
      const roomId =
        data.id ?? data.room_id ?? data.roomId ?? data.room ?? Date.now().toString(36);
      const details = JSON.parse(localStorage.getItem("roomDetails") || "[]");
      details.push({ id: roomId, name: roomName, password: password || "" });
      localStorage.setItem("roomDetails", JSON.stringify(details));

      setShowCreate(false);
      navigate(`/room/${encodeURIComponent(roomId)}`, {
        state: { id: roomId, name: roomName },
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
    navigate(`/room/${encodeURIComponent(id)}`, { state: { id, name: title } });
  };

  // ✅ 방 카드 "삭제" (해당 인덱스만 제거)
  const handleDeleteRoom = (idxToRemove) => {
    const name = rooms[idxToRemove];
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
        <button className="roomDelete" onClick={onDelete}>삭제</button>
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
