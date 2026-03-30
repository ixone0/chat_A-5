import React, { useState, useEffect } from 'react';
import './GroupMembersModal.css';
import { XIcon, ArrowLeftIcon, CheckIcon, CrownIcon, TrashIcon, LogOutIcon } from './Icons';
import { useConfirm } from './ConfirmDialog';
import { useToast } from './Toast';

const GroupMembersModal = ({ conversationId, isOwner, currentUserId, friends, onClose, onRefresh }) => {
  const confirm = useConfirm();
  const toast = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);
  const [addLoading, setAddLoading] = useState(false);
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [description, setDescription] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [isMuted, setIsMuted] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await window.electronAPI.getGroupMembers(conversationId);
      console.log('getGroupMembers response:', res);
      if (res?.status === 'success') setMembers(res.members || []);
      else console.error('getGroupMembers failed:', res?.message);
    } catch (err) { console.error('Failed to fetch members:', err); }
    finally { setLoading(false); }
  };

  const fetchGroupInfo = async () => {
    try {
      const res = await window.electronAPI.getGroupInfo(conversationId);
      console.log('getGroupInfo response:', res);
      if (res?.status === 'success' && res.data) {
        setDescription(res.data.description || '');
      }
    } catch (err) { console.error('Failed to fetch group info:', err); }
  };

  useEffect(() => { fetchMembers(); fetchGroupInfo(); }, [conversationId]);

  // Check if current user is admin or owner
  const myMember = members.find(m => String(m.user_id) === String(currentUserId));
  const isAdminOrOwner = myMember?.role === 'owner' || myMember?.role === 'admin';

  const handleKick = async (targetUserId, displayName) => {
    const ok = await confirm(`Kick ${displayName} from the group?`, { title: 'Kick Member', confirmText: 'Kick', danger: true });
    if (!ok) return;
    try {
      const res = await window.electronAPI.kickGroupMember({ conversation_id: conversationId, target_user_id: targetUserId });
      if (res?.status === 'success') { toast.success(`${displayName} was removed`); await fetchMembers(); if (onRefresh) onRefresh(); }
      else toast.error(res?.message || 'Failed to kick member');
    } catch (err) { toast.error(err.message); }
  };

  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setAddLoading(true);
    try {
      const res = await window.electronAPI.addGroupMembers({ conversation_id: conversationId, members: selectedToAdd });
      if (res?.status === 'success') { toast.success('Members added'); setShowAddPanel(false); setSelectedToAdd([]); await fetchMembers(); if (onRefresh) onRefresh(); }
      else toast.error(res?.message || 'Failed to add members');
    } catch (err) { toast.error(err.message); }
    finally { setAddLoading(false); }
  };

  const handleLeaveGroup = async () => {
    const ok = await confirm('Leave this group?', { title: 'Leave Group', confirmText: 'Leave', danger: true });
    if (!ok) return;
    try {
      const res = await window.electronAPI.leaveGroup(conversationId);
      if (res?.status === 'success') { toast.success('You left the group'); onClose(); if (onRefresh) onRefresh(); }
      else toast.error(res?.message || 'Failed to leave group');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteGroup = async () => {
    const ok = await confirm('Delete this group permanently? All messages will be lost.', { title: 'Delete Group', confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      const res = await window.electronAPI.deleteGroup(conversationId);
      if (res?.status === 'success') { toast.success('Group deleted'); onClose(); if (onRefresh) onRefresh(); }
      else toast.error(res?.message || 'Failed to delete group');
    } catch (err) { toast.error(err.message); }
  };

  const handleTransferOwnership = async (newOwnerId, displayName) => {
    const ok = await confirm(`Transfer ownership to ${displayName}?`, { title: 'Transfer Ownership', confirmText: 'Transfer' });
    if (!ok) return;
    try {
      const res = await window.electronAPI.transferOwnership({ conversation_id: conversationId, new_owner_id: newOwnerId });
      if (res?.status === 'success') { toast.success('Ownership transferred'); setShowTransferPanel(false); await fetchMembers(); if (onRefresh) onRefresh(); }
      else toast.error(res?.message || 'Failed to transfer ownership');
    } catch (err) { toast.error(err.message); }
  };

  const handleSaveDescription = async () => {
    try {
      const res = await window.electronAPI.updateGroupDescription({ conversation_id: conversationId, description: descDraft });
      if (res?.status === 'success') { toast.success('Description updated'); setDescription(descDraft); setEditingDesc(false); }
      else toast.error(res?.message || 'Failed to update description');
    } catch (err) { toast.error(err.message); }
  };

  const handleToggleMute = async () => {
    const newMuted = !isMuted;
    try {
      const res = await window.electronAPI.toggleMute({ conversation_id: conversationId, muted: newMuted });
      if (res?.status === 'success') setIsMuted(newMuted);
    } catch (err) { console.error(err); }
  };

  const handleSetRole = async (targetUserId, newRole, displayName) => {
    const label = newRole === 'admin' ? 'Promote' : 'Demote';
    const ok = await confirm(`${label} ${displayName} to ${newRole}?`, { title: 'Change Role', confirmText: label });
    if (!ok) return;
    try {
      const res = await window.electronAPI.setMemberRole({ conversation_id: conversationId, target_user_id: targetUserId, role: newRole });
      if (res?.status === 'success') { toast.success(`${displayName} is now ${newRole}`); await fetchMembers(); }
      else toast.error(res?.message || 'Failed to change role');
    } catch (err) { toast.error(err.message); }
  };

  const toggleAddMember = (friendId) => {
    setSelectedToAdd(prev => prev.includes(friendId) ? prev.filter(id => id !== friendId) : [...prev, friendId]);
  };

  const memberIds = members.map(m => String(m.user_id));
  const availableFriends = (friends || []).filter(f => !memberIds.includes(String(f.id)));
  const nonOwnerMembers = members.filter(m => m.role !== 'owner' && String(m.user_id) !== String(currentUserId));

  const currentPanel = showTransferPanel ? 'transfer' : showAddPanel ? 'add' : 'main';
  const panelTitle = currentPanel === 'transfer' ? 'Transfer Ownership' : currentPanel === 'add' ? 'Add Members' : 'Group Members';

  const handleBack = () => {
    if (showTransferPanel) setShowTransferPanel(false);
    else if (showAddPanel) setShowAddPanel(false);
    else onClose();
  };

  const getRoleBadge = (role) => {
    if (role === 'owner') return <span className="gm-role-badge">Owner</span>;
    if (role === 'admin') return <span className="gm-role-badge gm-role-admin">Admin</span>;
    return null;
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
                      <div className="gm-info"><span className="gm-name">{name}</span></div>
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
                    <div className="gm-avatar">{(friend.display_name || friend.username || '?').charAt(0).toUpperCase()}</div>
                    <div className="gm-info"><span className="gm-name">{friend.display_name || friend.username}</span></div>
                    <div className="gm-checkbox">{selectedToAdd.includes(friend.id) ? <CheckIcon size={16} color="#5865f2" /> : ''}</div>
                  </div>
                ))}
              </div>
            )}
            {availableFriends.length > 0 && (
              <button className="gm-add-confirm-btn" onClick={handleAddMembers} disabled={selectedToAdd.length === 0 || addLoading}>
                {addLoading ? 'Adding...' : `Add ${selectedToAdd.length} member${selectedToAdd.length !== 1 ? 's' : ''}`}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Description section */}
            <div className="gm-desc-section">
              {editingDesc ? (
                <div className="gm-desc-edit">
                  <textarea className="gm-desc-input" value={descDraft} onChange={e => setDescDraft(e.target.value)}
                    placeholder="Add a group description..." maxLength={200} rows={2} autoFocus />
                  <div className="gm-desc-edit-actions">
                    <button className="gm-desc-cancel" onClick={() => setEditingDesc(false)}>Cancel</button>
                    <button className="gm-desc-save" onClick={handleSaveDescription}>Save</button>
                  </div>
                </div>
              ) : (
                <div className="gm-desc-display" onClick={() => { if (isOwner) { setDescDraft(description); setEditingDesc(true); } }}>
                  <p className="gm-desc-text">{description || (isOwner ? 'Tap to add description...' : 'No description')}</p>
                </div>
              )}
            </div>

            {/* Mute toggle */}
            <div className="gm-mute-row" onClick={handleToggleMute}>
              <span className="gm-mute-label">{isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
              <div className={`gm-toggle ${isMuted ? 'gm-toggle-on' : ''}`}>
                <div className="gm-toggle-knob" />
              </div>
            </div>

            {/* Members list */}
            {loading ? (
              <p className="gm-loading">Loading...</p>
            ) : (
              <div className="gm-list">
                {members.map(member => {
                  const name = member.display_name || member.username || 'Unknown';
                  const isMe = String(member.user_id) === String(currentUserId);
                  const canManageRole = isOwner && !isMe && member.role !== 'owner';
                  const canKick = isAdminOrOwner && !isMe && member.role !== 'owner';
                  return (
                    <div key={member.user_id} className="gm-item">
                      <div className="gm-avatar">{name.charAt(0).toUpperCase()}</div>
                      <div className="gm-info">
                        <span className="gm-name">{name} {isMe && <span className="gm-you">(You)</span>}</span>
                        {getRoleBadge(member.role)}
                      </div>
                      <div className="gm-item-actions">
                        {canManageRole && (
                          <button className="gm-role-toggle-btn"
                            onClick={() => handleSetRole(member.user_id, member.role === 'admin' ? 'member' : 'admin', name)}
                            title={member.role === 'admin' ? 'Demote to member' : 'Promote to admin'}>
                            {member.role === 'admin' ? 'Demote' : 'Admin'}
                          </button>
                        )}
                        {canKick && (
                          <button className="gm-kick-btn" onClick={() => handleKick(member.user_id, name)}>Kick</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="gm-footer">
              <span className="gm-count">{members.length} member{members.length !== 1 ? 's' : ''}</span>
              {isAdminOrOwner && (
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
