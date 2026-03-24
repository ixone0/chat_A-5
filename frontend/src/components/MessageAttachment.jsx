// components/MessageAttachment.jsx
// ใช้ใน chat bubble เพื่อแสดงไฟล์ที่แนบมากับ message

import React from 'react';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

export default function MessageAttachment({ attachment }) {
  if (!attachment) return null;

  const { file_name, file_url, mime_type, file_size } = attachment;

  // แสดงขนาดไฟล์อ่านง่าย
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── รูปภาพ ───────────────────────────────────────────────────
  if (IMAGE_TYPES.includes(mime_type)) {
    return (
      <div style={{ marginTop: 6 }}>
        <img
          src={file_url}
          alt={file_name}
          style={{
            maxWidth: 280,
            maxHeight: 200,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'block',
          }}
          onClick={() => window.open(file_url, '_blank')}
        />
        <span style={{ fontSize: 11, color: '#888' }}>{file_name} · {formatSize(file_size)}</span>
      </div>
    );
  }

  // ─── วิดีโอ ───────────────────────────────────────────────────
  if (VIDEO_TYPES.includes(mime_type)) {
    return (
      <div style={{ marginTop: 6 }}>
        <video
          src={file_url}
          controls
          style={{ maxWidth: 280, borderRadius: 8, display: 'block' }}
        />
        <span style={{ fontSize: 11, color: '#888' }}>{file_name} · {formatSize(file_size)}</span>
      </div>
    );
  }

  // ─── ไฟล์ทั่วไป (PDF, docx, zip ...) ─────────────────────────
  return (
    <div
      style={{
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: '#f0f0f0',
        borderRadius: 8,
        maxWidth: 280,
        cursor: 'pointer',
      }}
      onClick={() => window.open(file_url, '_blank')}
    >
      <span style={{ fontSize: 24 }}>📎</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{file_name}</div>
        <div style={{ fontSize: 11, color: '#888' }}>{formatSize(file_size)}</div>
      </div>
    </div>
  );
}