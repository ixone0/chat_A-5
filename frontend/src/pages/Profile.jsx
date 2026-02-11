// src/pages/Profile.jsx
import React, { useState, useEffect } from "react";

const Profile = () => {
  const [username, setUsername] = useState("");
  const [uuid, setUuid] = useState("");
  const [customId, setCustomId] = useState("");
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // โหลดค่าจาก localStorage
  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUuid(localStorage.getItem("user_id") || "");
    setCustomId(localStorage.getItem("custom_id") || "");
  }, []);

  // ฟัง response จาก electron
  useEffect(() => {
    if (!window.electronAPI?.onUpdateUserIdResponse) return;

    const unsubscribe = window.electronAPI.onUpdateUserIdResponse((res) => {
      setLoading(false);

      if (res?.success) {
        // ✅ อัปเดต custom id ใหม่
        localStorage.setItem("custom_id", res.new_id || newId);

        setCustomId(res.new_id || newId);
        setNewId("");
        setError("");
      } else {
        setError(res?.message || "Update failed");
      }
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []); // 🔥 ต้องเป็น [] เท่านั้น

  const handleChangeId = () => {
    setError("");

    if (!newId.trim()) {
      setError("Please enter new ID");
      return;
    }

    setLoading(true);

    window.electronAPI.updateUserId({
      user_id: uuid,
      new_id: newId
    });
  };

  return (
    <div style={{ padding: "40px" }}>
      <h2>Profile</h2>

      <p><b>Username:</b> {username}</p>
      <p><b>ID:</b> {customId}</p>

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

      {error && (
        <div style={{ color: "red", marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default Profile;
