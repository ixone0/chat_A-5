import React, { useState, useEffect } from "react";

const Profile = () => {

  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [newId, setNewId] = useState("");

  useEffect(() => {
    // โหลดจาก localStorage ก่อน
    setUsername(localStorage.getItem("username") || "");
    setUserId(localStorage.getItem("user_id") || "");
  }, []);

  const handleChangeId = () => {
    if (!newId.trim()) return;

    window.electronAPI.updateUserId({
        user_id: userId,
        new_id: newId
    });

    window.electronAPI.onUpdateUserIdResponse((res) => {
    if(res.success){
        localStorage.setItem("user_id", newId);
        setUserId(newId);
    }
    });




    localStorage.setItem("user_id", newId);
    setUserId(newId);
    setNewId("");
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
      />

      <button onClick={handleChangeId}>
        Change ID
      </button>

    </div>
  );
};

export default Profile;
