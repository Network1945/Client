import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import MainPage from "./pages/MainPage";
import ProfileEdit from "./pages/ProfileEdit";

import "./styles/MainPage.css";
import "./styles/ProfileEdit.css";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/MainPage" element={<MainPage />} />
        <Route path="/ProfileEdit" element={<ProfileEdit />} />
      </Routes>
    </Router>
  );
}
