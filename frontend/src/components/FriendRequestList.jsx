import React, { useState, useEffect } from 'react';
import './FriendRequestList.css';

const FriendRequestList = ({ onClose }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    // 1. ดึงข้อมูลคำขอเมื่อเปิดหน้าต่างขึ้นมา
    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            // เรียกใช้ API ที่เตรียมไว้
            const response = await window.electronAPI.getPendingRequests();
            console.log("Pending Requests:", response);
            
            if (response && response.status === 'success') {
                setRequests(response.data);
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    // 2. ฟังก์ชันกดรับเพื่อน
    const handleAccept = async (senderId) => {
        try {
            const result = await window.electronAPI.acceptFriend(senderId);
            if (result.status === 'success') {
                // ลบรายการออกจากหน้าจอทันที (ไม่ต้องรอโหลดใหม่)
                setRequests((prev) => prev.filter(req => req.sender_id !== senderId));
                alert("Friend Added!");
            } else {
                alert("Failed to accept: " + result.message);
            }
        } catch (error) {
            console.error("Error accepting:", error);
        }
    };

    return (
        <div className="request-modal-overlay">
            <div className="request-modal">
                <div className="modal-header">
                    <h3>🔔 Friend Requests</h3>
                    <button className="close-btn" onClick={onClose}>X</button>
                </div>

                <div className="request-list">
                    {loading ? (
                        <p className="loading-text">Loading...</p>
                    ) : requests.length === 0 ? (
                        <div className="empty-state">
                            <p>No pending requests</p>
                        </div>
                    ) : (
                        requests.map((req) => (
                            <div key={req.request_id} className="request-item">
                                <div className="req-avatar">
                                    {req.sender_name.charAt(0).toUpperCase()}
                                </div>
                                <div className="req-info">
                                    <span className="req-name">{req.sender_name}</span>
                                    <span className="req-id">@{req.sender_custom_id}</span>
                                </div>
                                <div className="req-actions">
                                    <button 
                                        className="btn-accept" 
                                        onClick={() => handleAccept(req.sender_id)}
                                    >
                                        Confirm
                                    </button>
                                    {/* ปุ่ม Reject (ถ้าจะทำเพิ่มก็เรียก API ลบ row) */}
                                    <button className="btn-reject">Delete</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default FriendRequestList;