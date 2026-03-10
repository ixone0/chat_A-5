// src/pages/Profile.jsx
import React, { useState, useEffect, useRef } from "react";

const Profile = () => {
  const [username, setUsername] = useState("");
  const [uuid, setUuid] = useState("");
  const [customId, setCustomId] = useState("");
  const [newId, setNewId] = useState("");
  const [loading, setLoading] = useState(false);

  // notification: { type: 'success'|'error', message: string }
  const [notif, setNotif] = useState(null);
  const notifTimer = useRef(null);

  // โหลดค่าจาก localStorage ตอน mount
  useEffect(() => {
    setUsername(localStorage.getItem("username") || "");
    setUuid(localStorage.getItem("user_id") || "");
    setCustomId(localStorage.getItem("custom_id") || "");
  }, []);

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (notifTimer.current) {
        clearTimeout(notifTimer.current);
        notifTimer.current = null;
      }
    };
  }, []);

  // ฟัง event push จาก electron (ถ้ามี)
  useEffect(() => {
    if (!window.electronAPI?.onUpdateUserIdResponse) return;

    const unsubscribe = window.electronAPI.onUpdateUserIdResponse((res) => {
      // res shape: { success: boolean, message: string, new_id?: string }
      handleUpdateResult(res);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [newId]); // no needจริงๆ แต่ใส่ deps เล็กน้อย

  const showNotification = (type, message) => {
    setNotif({ type, message });
    if (notifTimer.current) clearTimeout(notifTimer.current);
    notifTimer.current = setTimeout(() => {
      setNotif(null);
      notifTimer.current = null;
    }, 4000);
  };

  const handleUpdateResult = (res) => {
    setLoading(false);

    if (!res) {
      showNotification("error", "No response from server");
      return;
    }

    if (res.success) {
      // backend อาจคืน new_id หรือไม่ คืน only success
      const finalNewId = res.new_id || newId;

      // อัปเดต localStorage และ state
      if (finalNewId) {
        localStorage.setItem("custom_id", finalNewId);
        setCustomId(finalNewId);
      }

      setNewId("");
      showNotification("success", res.message || "ID updated successfully");
    } else {
      showNotification("error", res.message || "Update failed");
    }
  };

  const handleChangeId = async () => {
    setNotif(null);

    if (!newId || !newId.trim()) {
      showNotification("error", "กรุณากรอก ID ใหม่ก่อน");
      return;
    }

    setLoading(true);

    try {
      // ถ้า preload ใช้ ipcRenderer.invoke จะคืน Promise
      if (window.electronAPI?.updateUserId) {
        const res = await window.electronAPI.updateUserId({
          user_id: uuid,
          new_id: newId.trim(),
        });

        // บางสถาปัตยกรรมส่ง response ผ่าน invoke (res) หรือ push event
        handleUpdateResult(res);
      } else {
        // fallback: ถ้าไม่มี function
        setLoading(false);
        showNotification("error", "updateUserId API not available");
      }
    } catch (err) {
      setLoading(false);
      showNotification("error", err?.message || "Request failed");
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: 640 }}>
      <h2>Profile</h2>

      <p>
        <b>Username:</b> {username || "-"}
      </p>
      <p>
        <b>ID (custom_id):</b> {customId || "-"}
      </p>

      <hr style={{ margin: "20px 0" }} />

      <h3>Change ID</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <input
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          placeholder="New ID (3-20 chars: a-z A-Z 0-9 _ )"
          disabled={loading}
          style={{ flex: 1, padding: "8px 12px", fontSize: 14 }}
        />

        <button
          onClick={handleChangeId}
          disabled={loading}
          style={{
            padding: "8px 12px",
            cursor: loading ? "not-allowed" : "pointer",
            background: "#0b76d1",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          {loading ? "Changing..." : "Change ID"}
        </button>
      </div>

      {/* notification box */}
      {notif && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 6,
            color: notif.type === "success" ? "#064e3b" : "#7f1d1d",
            background: notif.type === "success" ? "#d1fae5" : "#fee2e2",
            border: notif.type === "success" ? "1px solid #10b98122" : "1px solid #ef444422",
          }}
        >
          {notif.message}
        </div>
      )}
    </div>
  );
};

export default Profile;
