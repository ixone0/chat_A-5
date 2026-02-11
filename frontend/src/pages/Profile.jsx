// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";

const Profile = () => {
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUserId(localStorage.getItem("user_id") || "");
  }, []);

  // ฟัง response หนึ่งรอบ (mount) แล้ว unsubscribe (สำคัญ)
  useEffect(() => {
    if (!window.electronAPI?.onUpdateUserIdResponse) return;

    const unsubscribe = window.electronAPI.onUpdateUserIdResponse((res) => {
      setLoading(false);
      if (res && res.success) {
        localStorage.setItem("user_id", newId);
        setUserId(newId);
        setNewId("");
        setError("");
      } else {
        setError(res?.message || "Update failed");
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleChangeId = () => {
    setError("");
    if (!newId.trim()) {
      setError("Please enter new ID");
      return;
    }

    setLoading(true);

    const payload = {
      user_id: userId || localStorage.getItem("user_id"),
      new_id: newId
    };

    // ส่งไป electron (preload) — main จะส่งต่อไป server
    window.electronAPI.updateUserId(payload);
    // **อย่าอัปเดต localStorage/ UI ตรงนี้** — รอ response
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Profile</h2>

      <p><b>Username:</b> {username}</p>
      <p><b>User ID:</b> {userId}</p>

      <hr />

      <h3>Change ID</h3>

      <input
        value={newId}
        onChange={(e) => setNewId(e.target.value)}
        placeholder="New ID"
        disabled={loading}
      />

      <button onClick={handleChangeId} disabled={loading}>
        {loading ? "Changing..." : "Change ID"}
      </button>

      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </div>
  );
};

export default Profile;
