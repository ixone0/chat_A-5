import React, { useState, useEffect } from 'react';
import './GroupMembersModal.css';

const GroupMembersModal = ({ conversationId, isOwner, currentUserId, friends, onClose, onRefresh }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [addLoading, setAddLoading] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await window.electronAPI.getGroupMembers(conversationId);
      if (res?.status === 'success') {
        setMembers(res.members || []);
      }
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [conversationId]);

  const handleKick = async (targetUserId, displayName) => {
    if (!window.confirm(`ต้องการเตะ ${displayName} ออกจากกลุ่มจริงหรือไม่?`)) return;
    try {
      const res = await window.electronAPI.kickGroupMember({
        conversation_id: conversationId,
        target_user_id: targetUserId
      });
      if (res?.status === 'success') {
        await fetchMembers();
        if (onRefresh) onRefresh();
      } else {
        alert(res?.message || 'Failed to kick member');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setAddLoading(true);
    try {
      const res = await window.electronAPI.addGroupMembers({
        conversation_id: conversationId,
        members: selectedToAdd
      });
      if (res?.status === 'success') {
        setShowAddPanel(false);
        setSelectedToAdd([]);
        await fetchMembers();
        if (onRefresh) onRefresh();
      } else {
        alert(res?.message || 'Failed to add members');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const toggleAddMember = (friendId) => {
    setSelectedToAdd(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  // เพื่อนที่ยังไม่อยู่ในกลุ่ม
  const memberIds = members.map(m => String(m.user_id));
  const availableFriends = (friends || []).filter(f => !memberIds.includes(String(f.id)));

  return (
    <div className="gm-overlay" onClick={onClose}>
      <div className="gm-modal" onClick={e => e.stopPropagation()}>
        <div className="gm-header">
          <h3>{showAddPanel ? 'Add Members' : 'Group Members'}</h3>
          <button className="gm-close-btn" onClick={showAddPanel ? () => setShowAddPanel(false) : onClose}>
            {showAddPanel ? '←' : '✕'}
          </button>
        </div>

        {showAddPanel ? (
          <div className="gm-add-panel">
            {availableFriends.length === 0 ? (
              <p className="gm-empty">No friends available to add</p>
            ) : (
              <div className="gm-list">
                {availableFriends.map(friend => (
                  <div
                    key={friend.id}
                    className={`gm-item gm-item-selectable ${selectedToAdd.includes(friend.id) ? 'gm-item-selected' : ''}`}
                    onClick={() => toggleAddMember(friend.id)}
                  >
                    <div className="gm-avatar">
                      {(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="gm-info">
                      <span className="gm-name">{friend.display_name || friend.username}</span>
                    </div>
                    <div className="gm-checkbox">{selectedToAdd.includes(friend.id) ? '✓' : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {availableFriends.length > 0 && (
              <button
                className="gm-add-confirm-btn"
                onClick={handleAddMembers}
                disabled={selectedToAdd.length === 0 || addLoading}
              >
                {addLoading ? 'Adding...' : `Add ${selectedToAdd.length} member${selectedToAdd.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        ) : (
          <>
            {loading ? (
              <p className="gm-loading">Loading...</p>
            ) : (
              <div className="gm-list">
                {members.map(member => {
                  const name = member.display_name || member.username || 'Unknown';
                  const isMe = String(member.user_id) === String(currentUserId);
                  return (
                    <div key={member.user_id} className="gm-item">
                      <div className="gm-avatar">{name.charAt(0).toUpperCase()}</div>
                      <div className="gm-info">
                        <span className="gm-name">
                          {name} {isMe && <span className="gm-you">(You)</span>}
                        </span>
                        {member.role === 'owner' && <span className="gm-role-badge">Owner</span>}
                      </div>
                      {isOwner && !isMe && member.role !== 'owner' && (
                        <button className="gm-kick-btn" onClick={() => handleKick(member.user_id, name)}>
                          Kick
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="gm-footer">
              <span className="gm-count">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              {isOwner && (
                <button className="gm-add-btn" onClick={() => setShowAddPanel(true)}>
                  + Add Members
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default GroupMembersModal;
