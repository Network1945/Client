import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import MainPage from "./pages/MainPage";
import ProfileEdit from "./pages/ProfileEdit";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

import "./styles/MainPage.css";
import "./styles/ProfileEdit.css";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/MainPage" element={<MainPage />} />
        <Route path="/Signup" element={<Signup />} />
        <Route path="/Login" element={<Login />} />
        <Route path="/ProfileEdit" element={<ProfileEdit />} />
      </Routes>
    </Router>
  );
}
