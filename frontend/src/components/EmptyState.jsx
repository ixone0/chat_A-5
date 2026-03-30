import React from 'react';
import { MessageCircleIcon, UsersIcon, UserPlusIcon } from './Icons';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    textAlign: 'center',
    opacity: 0.7,
  },
  icon: { marginBottom: 16, opacity: 0.5 },
  title: { color: 'var(--text-secondary)', fontSize: '1rem', fontWeight: 600, margin: '0 0 6px' },
  subtitle: { color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 },
};

export function EmptyChat() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}><MessageCircleIcon size={48} color="var(--text-secondary)" /></div>
      <p style={styles.title}>No conversation selected</p>
      <p style={styles.subtitle}>Pick a friend or group from the sidebar to start chatting</p>
    </div>
  );
}

export function EmptySidebar() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}><UsersIcon size={40} color="var(--text-secondary)" /></div>
      <p style={styles.title}>No chats yet</p>
      <p style={styles.subtitle}>Add a friend to get started</p>
    </div>
  );
}

export function EmptyFriends() {
  return (
    <div style={styles.container}>
      <div style={styles.icon}><UserPlusIcon size={40} color="var(--text-secondary)" /></div>
      <p style={styles.title}>No friends yet</p>
      <p style={styles.subtitle}>Search for users by their ID</p>
    </div>
  );
}
