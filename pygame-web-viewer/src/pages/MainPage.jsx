import React, { useRef } from "react";
import { Link } from "react-router-dom";

export default function MainPage() {
  const scrollRef = useRef(null);

  return (
    <div className="viewport">
      <div className="canvas">
        {/* 상단 탭 */}
        <div className="tab main">
          <Link to="/MainPage"><span>메인 화면</span></Link>
        </div>
        <div className="tab create"><span>방만들기</span></div>
        <div className="tab rank"><span>랭킹</span></div>
        <div className="tab profile">
          <Link to="/ProfileEdit"><span>프로필 편집</span></Link>
        </div>

        {/* 좌측 상단 */}
        <div className="leftTop" />
        <div className="rightTop">
          <div className="rooms" ref={scrollRef}>
            {ROOMS.map((room, i) => (
              <RoomCard key={i} index={i + 1} title={room} />
            ))}
          </div>
        </div>

        {/* 하단 좌측 */}
        <div className="leftBottom" />
        <div className="myInfoTitle"><div className="icon" /><span>내 정보</span></div>
        <div className="avatar" />
        <div className="nickname">NickName</div>

        {/* 하단 우측 */}
        <div className="rightBottom" />
        <div className="chatTitle"><div className="icon" /><span>채팅</span></div>
        <input className="chatInput" placeholder="메시지를 입력하세요" />
        <button className="sendBtn">전송</button>
      </div>
    </div>
  );
}

function RoomCard({ index, title }) {
  return (
    <div className="roomCard">
      <div className="roomIdx"><span>{String(index).padStart(2, "0")}</span></div>
      <div className="roomBody">
        <div className="roomTitle">{title}</div>
        <button className="roomEntry">입장</button>
      </div>
    </div>
  );
}

const ROOMS = ["테스트 방", "테스트 방", "테스트 방", "테스트 방"];
