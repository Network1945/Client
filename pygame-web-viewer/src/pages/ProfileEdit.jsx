import React, { useState, useRef } from "react";
import { Link } from "react-router-dom";

export default function ProfileEdit() {
    const [profileImage, setProfileImage] = useState(null);
    const fileInputRef = useRef(null);

    // 파일 선택 시 실행
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
        setProfileImage(URL.createObjectURL(file)); // 미리보기
        }
    };

    // 원 클릭 시 파일 선택 창 열기
    const handleCircleClick = () => {
        fileInputRef.current.click();
    };

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

        {/* 프로필 편집 배경 */}
        <div className="ProfileEditBackGround">
            <div className="ProfileCircleDiv">
                <div className="ProfileCircle" onClick={handleCircleClick}>
                    {profileImage ? (
                        <img src={profileImage} alt="프로필" className="ProfileImg" />
                    ) : (
                        <span className="AddText">+</span>
                    )}
                    </div>
                    <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        style={{ display: "none" }}
                        onChange={handleImageChange}
                    />
                </div>

                {/* 이름 / 생년월일 */}
                <div className="ProfileInfo">
                    <div className="InfoRow">
                    <div className="icon">👤</div>
                    <input type="text" className="infoInput" placeholder="이름" />
                    <button className="editBtn">수정</button>
                    </div>
                    <div className="InfoRow">
                    <div className="icon">📅</div>
                    <input type="text" className="infoInput" placeholder="생년월일" />
                    <button className="editBtn">수정</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
