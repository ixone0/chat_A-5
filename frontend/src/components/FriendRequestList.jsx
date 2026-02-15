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
            // เรียกใช้ API จาก Electron
            const response = await window.electronAPI.getPendingRequests();
            console.log("Pending Requests:", response);
            
            if (response && response.status === 'success') {
                setRequests(response.data);
            } else {
                setRequests([]);
            }
        } catch (error) {
            console.error("Error fetching requests:", error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    // 2. ฟังก์ชันกดรับเพื่อน
    const handleAccept = async (senderId) => {
        try {
            const result = await window.electronAPI.acceptFriend(senderId);
            if (result.status === 'success') {
                // ลบรายการออกจากหน้าจอทันที (ไม่ต้องรอโหลดใหม่)ให้ UI รู้สึกเร็ว
                setRequests((prev) => prev.filter(req => req.sender_id !== senderId));
            } else {
                alert("Failed to accept: " + result.message);
            }
        } catch (error) {
            console.error("Error accepting:", error);
        }
    };

    // 3. ฟังก์ชันปฏิเสธ (ถ้ามี API ให้ใส่ตรงนี้)
    const handleReject = async (senderId) => {
        // TODO: เรียก API rejectFriend(senderId)
        console.log("Rejecting:", senderId);
        // เบื้องต้นลบออกจากหน้าจอไปก่อน
        setRequests((prev) => prev.filter(req => req.sender_id !== senderId));
    };

    return (
        <div className="request-modal-overlay" onClick={onClose}>
            {/* stopPropagation เพื่อให้กดที่กล่องแล้วไม่ปิด */}
            <div className="request-modal" onClick={(e) => e.stopPropagation()}>
                
                {/* --- Header พร้อมไอคอนกระดิ่ง SVG --- */}
                <div className="modal-header">
                    <div className="header-title">
                        <svg className="bell-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <h3>Friend Requests</h3>
                        {requests.length > 0 && <span className="req-count">{requests.length}</span>}
                    </div>
                    
                    <button className="close-btn" onClick={onClose}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                {/* --- Content List --- */}
                <div className="request-list">
                    {loading ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                        </div>
                    ) : requests.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon-svg">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                                    <path d="M22 6l-10 7L2 6"></path>
                                </svg>
                            </div>
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
                                    {/* ปุ่ม Accept สีเขียว */}
                                    <button 
                                        className="btn-icon-accept" 
                                        onClick={() => handleAccept(req.sender_id)}
                                        title="Accept"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </button>
                                    
                                    {/* ปุ่ม Reject สีแดง */}
                                    <button 
                                        className="btn-icon-reject" 
                                        onClick={() => handleReject(req.sender_id)}
                                        title="Decline"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
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