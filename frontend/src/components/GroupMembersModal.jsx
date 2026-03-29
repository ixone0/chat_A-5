import React, { useState, useEffect } from 'react';
import './GroupMembersModal.css';
import { XIcon, ArrowLeftIcon, CheckIcon, CrownIcon, TrashIcon, LogOutIcon } from './Icons';

const GroupMembersModal = ({ conversationId, isOwner, currentUserId, friends, onClose, onRefresh }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [showTransferPanel, setShowTransferPanel] = useState(false);

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

  useEffect(() => { fetchMembers(); }, [conversationId]);

  const handleKick = async (targetUserId, displayName) => {
    if (!window.confirm(`Kick ${displayName} from the group?`)) return;
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
    } catch (err) { alert('Error: ' + err.message); }
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
    } catch (err) { alert('Error: ' + err.message); }
    finally { setAddLoading(false); }
  };

  const handleLeaveGroup = async () => {
    if (!window.confirm('Leave this group?')) return;
    try {
      const res = await window.electronAPI.leaveGroup(conversationId);
      if (res?.status === 'success') {
        onClose();
        if (onRefresh) onRefresh();
      } else {
        alert(res?.message || 'Failed to leave group');
      }
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('Delete this group permanently? All messages will be lost.')) return;
    try {
      const res = await window.electronAPI.deleteGroup(conversationId);
      if (res?.status === 'success') {
        onClose();
        if (onRefresh) onRefresh();
      } else {
        alert(res?.message || 'Failed to delete group');
      }
    } catch (err) { alert('Error: ' + err.message); }
  };

  const handleTransferOwnership = async (newOwnerId, displayName) => {
    if (!window.confirm(`Transfer ownership to ${displayName}?`)) return;
    try {
      const res = await window.electronAPI.transferOwnership({
        conversation_id: conversationId,
        new_owner_id: newOwnerId
      });
      if (res?.status === 'success') {
        setShowTransferPanel(false);
        await fetchMembers();
        if (onRefresh) onRefresh();
      } else {
        alert(res?.message || 'Failed to transfer ownership');
      }
    } catch (err) { alert('Error: ' + err.message); }
  };

  const toggleAddMember = (friendId) => {
    setSelectedToAdd(prev =>
      prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]
    );
  };

  const memberIds = members.map(m => String(m.user_id));
  const availableFriends = (friends || []).filter(f => !memberIds.includes(String(f.id)));
  const nonOwnerMembers = members.filter(m => m.role !== 'owner' && String(m.user_id) !== String(currentUserId));

  // Determine current panel
  const currentPanel = showTransferPanel ? 'transfer' : showAddPanel ? 'add' : 'main';
  const panelTitle = currentPanel === 'transfer' ? 'Transfer Ownership' : currentPanel === 'add' ? 'Add Members' : 'Group Members';

  const handleBack = () => {
    if (showTransferPanel) setShowTransferPanel(false);
    else if (showAddPanel) setShowAddPanel(false);
    else onClose();
  };

  return (
    <div className="gm-overlay" onClick={onClose}>
      <div className="gm-modal" onClick={e => e.stopPropagation()}>
        <div className="gm-header">
          <h3>{panelTitle}</h3>
          <button className="gm-close-btn" onClick={handleBack}>
            {currentPanel !== 'main' ? <ArrowLeftIcon size={16} /> : <XIcon size={16} />}
          </button>
        </div>

        {currentPanel === 'transfer' ? (
          <div className="gm-add-panel">
            {nonOwnerMembers.length === 0 ? (
              <p className="gm-empty">No members to transfer ownership to</p>
            ) : (
              <div className="gm-list">
                {nonOwnerMembers.map(member => {
                  const name = member.display_name || member.username || 'Unknown';
                  return (
                    <div key={member.user_id} className="gm-item gm-item-selectable"
                      onClick={() => handleTransferOwnership(member.user_id, name)}>
                      <div className="gm-avatar">{name.charAt(0).toUpperCase()}</div>
                      <div className="gm-info">
                        <span className="gm-name">{name}</span>
                      </div>
                      <span className="gm-transfer-icon"><CrownIcon size={18} color="#ffc107" /></span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : currentPanel === 'add' ? (
          <div className="gm-add-panel">
            {availableFriends.length === 0 ? (
              <p className="gm-empty">No friends available to add</p>
            ) : (
              <div className="gm-list">
                {availableFriends.map(friend => (
                  <div key={friend.id}
                    className={`gm-item gm-item-selectable ${selectedToAdd.includes(friend.id) ? 'gm-item-selected' : ''}`}
                    onClick={() => toggleAddMember(friend.id)}>
                    <div className="gm-avatar">
                      {(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}
                    </div>
                    <div className="gm-info">
                      <span className="gm-name">{friend.display_name || friend.username}</span>
                    </div>
                    <div className="gm-checkbox">{selectedToAdd.includes(friend.id) ? <CheckIcon size={16} color="#5865f2" /> : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {availableFriends.length > 0 && (
              <button className="gm-add-confirm-btn" onClick={handleAddMembers}
                disabled={selectedToAdd.length === 0 || addLoading}>
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
                <button className="gm-add-btn" onClick={() => setShowAddPanel(true)}>+ Add</button>
              )}
            </div>
            <div className="gm-actions">
              {isOwner && (
                <>
                  <button className="gm-action-btn gm-transfer-btn" onClick={() => setShowTransferPanel(true)}>
                    <CrownIcon size={16} /> Transfer Ownership
                  </button>
                  <button className="gm-action-btn gm-delete-btn" onClick={handleDeleteGroup}>
                    <TrashIcon size={16} /> Delete Group
                  </button>
                </>
              )}
              {!isOwner && (
                <button className="gm-action-btn gm-leave-btn" onClick={handleLeaveGroup}>
                  <LogOutIcon size={16} /> Leave Group
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
