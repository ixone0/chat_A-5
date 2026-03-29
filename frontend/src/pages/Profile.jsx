import React, { useState, useEffect, useRef } from "react";
import "./Profile.css";

const Profile = () => {
  const [username, setUsername] = useState("");
  const [uuid, setUuid] = useState("");
  const [customId, setCustomId] = useState("");
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notif, setNotif] = useState(null);
  const notifTimer = useRef(null);

  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUuid(localStorage.getItem("user_id") || "");
    setCustomId(localStorage.getItem("custom_id") || "");
  }, []);

  useEffect(() => {
    return () => { if (notifTimer.current) clearTimeout(notifTimer.current); };
  }, []);

  const showNotification = (type, message) => {
    setNotif({ type, message });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => setNotif(null), 4000);
  };

  const handleUpdateResult = (res) => {
    setLoading(false);
    if (!res) { showNotification("error", "No response from server"); return; }
    if (res.success) {
      const finalNewId = res.new_id || newId;
      if (finalNewId) { localStorage.setItem("custom_id", finalNewId); setCustomId(finalNewId); }
      setNewId("");
      showNotification("success", res.message || "ID updated successfully");
    } else {
      showNotification("error", res.message || "Update failed");
    }
  };

  const handleChangeId = async () => {
    setNotif(null);
    if (!newId?.trim()) { showNotification("error", "Please enter a new ID"); return; }
    setLoading(true);
    try {
      if (window.electronAPI?.updateUserId) {
        const res = await window.electronAPI.updateUserId({ user_id: uuid, new_id: newId.trim() });
        handleUpdateResult(res);
      } else { setLoading(false); showNotification("error", "API not available"); }
    } catch (err) { setLoading(false); showNotification("error", err?.message || "Request failed"); }
  };

  const avatarChar = username ? username.charAt(0).toUpperCase() : "U";

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar-large">{avatarChar}</div>
        <h2 className="profile-username">{username || "Unknown"}</h2>
        <span className="profile-custom-id">@{customId || "no-id"}</span>
      </div>

      <div className="profile-section">
        <h3 className="profile-section-title">Change Custom ID</h3>
        <div className="profile-id-form">
          <input
            className="profile-input"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="New ID (3-20 chars: a-z A-Z 0-9 _)"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleChangeId()}
          />
          <button className="profile-save-btn" onClick={handleChangeId} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
        {notif && (
          <div className={`profile-notif ${notif.type === "success" ? "profile-notif-success" : "profile-notif-error"}`}>
            {notif.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
