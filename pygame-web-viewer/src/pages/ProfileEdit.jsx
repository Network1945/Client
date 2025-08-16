import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function ProfileEdit() {
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

  // 프로필 이미지
  const [profileImage, setProfileImage] = useState(null);
  const fileInputRef = useRef(null);
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) setProfileImage(URL.createObjectURL(file));
  };
  const handleCircleClick = () => fileInputRef.current?.click();

  // 이름: 로그인 시 저장해 둔 nickName을 기본값으로
  const [name, setName] = useState(localStorage.getItem("nickName") || "");

  return (
    <div className="viewport">
      <div className={`canvas ${authed ? "authed" : ""}`}>
        {/* 상단 탭 */}
        <div className="tab main"><Link to="/MainPage"><span>메인 화면</span></Link></div>
        <div className="tab create"><span>방만들기</span></div>

        {!authed && (
          <>
            <div className="tab signup"><Link to="/Signup"><span>회원가입</span></Link></div>
            <div className="tab login"><Link to="/Login"><span>로그인</span></Link></div>
          </>
        )}

        {authed && (
          <>
            <div className="tab profile"><Link to="/ProfileEdit"><span>프로필 편집</span></Link></div>
            <button className="tab logout" onClick={handleLogout}><span>로그아웃</span></button>
          </>
        )}

        {/* 프로필 편집 본문 */}
        <div className="ProfileEditBackGround">
          <div className="ProfileCircleDiv">
            <div className="ProfileCircle" onClick={handleCircleClick} title="사진 업로드">
              {profileImage
                ? <img src={profileImage} alt="프로필" className="ProfileImg" />
                : <span className="AddText">+</span>}
            </div>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
          </div>

          <div className="ProfileInfo">
            <div className="InfoRow">
              <div className="icon">👤</div>
              <input
                type="text"
                className="infoInput"
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="editBtn">수정</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
