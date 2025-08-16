import React, { useState } from "react";
import { IP_ADDR } from "./config";

export default function Signup() {
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus("전송 중...");

    try {
      const res = await fetch(`http://${IP_ADDR}:8000/rooms/signup/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),  // ✅ JSON 형태
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json(); // 서버에서 JSON 응답한다고 가정
      console.log(data);
      setStatus(`회원가입 성공: ${JSON.stringify(data)}`);
    } catch (err) {
      setStatus(`전송 실패: ${err.message}`);
    }
  };

  return (
    <div className="viewport">
      <div className="canvas">
        <form className="authCard" onSubmit={onSubmit}>
          <h2>회원가입</h2>

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

          <button className="authBtn" type="submit">
            회원가입
          </button>

          <div className="authStatus">{status}</div>
        </form>
      </div>
    </div>
  );
}
