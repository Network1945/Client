import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
// Login.jsx 성공시
import { setAccessToken } from "./tokenStore";

export default function Login() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("로그인 중...");

    try {
      // 📌 서버 라우트에 슬래시가 있다면 그대로 맞추세요 (예: /rooms/login/)
        const res = await fetch("http://192.168.2.96:8000/rooms/login/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, password }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // ✅ 토큰/닉네임 저장
        localStorage.setItem("isLoggedIn", "1");
        if (data.access)  localStorage.setItem("accessToken", data.access);
        if (data.refresh) localStorage.setItem("refreshToken", data.refresh);
        if (data.user?.name) localStorage.setItem("nickName", data.user.name);

        if (data.access) {
            // persist=true면 세션 동안만 저장(새 탭/새 창엔 안 퍼짐)
            setAccessToken(data.access, { persist: true }); 
        }
        if (data.refresh) {
        // 권장: 서버가 이 값을 HttpOnly 쿠키로 내려주도록 바꾸세요.
        // 만약 JSON으로 온다면 쿠키로 전환하는 것이 안전함.
        }

      // UI 갱신 이벤트
      window.dispatchEvent(new Event("auth-changed"));

      setStatus("로그인 성공!");
      navigate("/MainPage", { replace: true });
    } catch (err) {
      setStatus(`로그인 실패: ${err.message}`);
    }
  };

  return (
    <div className="viewport">
      <div className="canvas">
        <form className="authCard" onSubmit={onSubmit}>
          <h2>로그인</h2>

          <label className="authLabel">이름</label>
          <input
            className="authInput"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            required
          />

          <label className="authLabel">패스워드</label>
          <input
            className="authInput"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="패스워드를 입력하세요"
            required
          />

          <button className="authBtn" type="submit">로그인</button>
          <div className="authStatus">{status}</div>
        </form>
      </div>
    </div>
  );
}
