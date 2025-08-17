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

  // 서버 방 목록 (객체 배열)
  const [rooms, setRooms] = useState([]); // [{ roomId, name, host, status, created_at }, ...]

  const [nickName, setNickName] = useState(localStorage.getItem("nickName") || "NickName");
  useEffect(() => {
    const onAuth = () => setNickName(localStorage.getItem("nickName") || "NickName");
    window.addEventListener("auth-changed", onAuth);
    return () => window.removeEventListener("auth-changed", onAuth);
  }, []);

  // === 방 리스트 불러오기 ===
  const fetchRooms = async () => {
    try {
      const accessToken =
        sessionStorage.getItem("accessToken") ||
        localStorage.getItem("accessToken") ||
        localStorage.getItem("authToken") ||
        "";

      const res = await fetch(`http://${IP_ADDR}:8000/rooms/list/`, {
        method: "GET",
        headers: {
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        credentials: "include",
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // 기대 포맷: [{ roomId, host, status, created_at, name }, ...]
      setRooms(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("방 목록 조회 실패:", e);
      setRooms([]); // 실패 시 빈 목록
    }
  };

  // 최초 진입 시 목록 로드
  useEffect(() => {
    fetchRooms();
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

      const payload = {
        name: roomName,
        password: password || "",
        variable: accessToken,
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

      // 서버 응답: { roomId, name, password? }
      const data = await res.json();
      if (!data?.roomId) throw new Error("서버가 roomId를 반환하지 않았습니다.");

      const displayName = data.name || roomName;

      // UI 즉시 반영 (서버에서 다시 받아오면 덮어씀)
      setRooms(prev => [
        { roomId: data.roomId, name: displayName, host: nickName, status: "lobby", created_at: new Date().toISOString() },
        ...prev,
      ]);

      setShowCreate(false);

      // 상세 페이지로 이동
      navigate(`/room/${encodeURIComponent(data.roomId)}`, {
        state: { id: data.roomId, name: displayName, nickname: nickName },
      });

      // 최신 목록 재조회(신뢰원은 서버)
      fetchRooms();
    } catch (e) {
      console.error(e);
      alert("방 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setCreating(false);
    }
  };

  // 방 카드 "입장"
  const handleEnterRoom = (room) => {
    const id = room.roomId || room.id;
    navigate(`/room/${encodeURIComponent(id)}`, {
      state: { id, name: room.name, nickname: nickName },
    });
  };

  // (선택) 클라이언트 목록에서만 제거
  const handleDeleteRoom = (room) => {
    if (!window.confirm(`'${room.name}' 방을 목록에서 제거할까요?`)) return;
    setRooms(prev => prev.filter(r => r.roomId !== room.roomId));
    // 서버 삭제가 필요하면 여기에 DELETE 요청 추가 가능
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
                key={room.roomId || `${room.name}-${i}`}
                index={i + 1}
                room={room}
                onEnter={handleEnterRoom}
                onDelete={handleDeleteRoom}
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

function RoomCard({ index, room, onEnter, onDelete }) {
  const rid = room.roomId || room.id; // 안전하게

  return (
    <div className="roomCard">
      <div className="roomIdx"><span>{String(index).padStart(2, "0")}</span></div>
      <div className="roomBody">
        <div className="roomTitle">
          <span className="roomName">{room.name}</span>
          <span className="roomId">#{rid}</span>
        </div>
        <button className="roomEntry" onClick={() => onEnter(room)}>입장</button>
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
