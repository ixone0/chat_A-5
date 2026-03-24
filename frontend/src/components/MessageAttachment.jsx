// components/MessageAttachment.jsx
import React from 'react';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

export default function MessageAttachment({ attachment }) {
  if (!attachment) return null;

  // ดึงข้อมูลแบบรองรับทั้งชื่อตัวแปรเก่าและใหม่ (Fallback)
  const name = attachment.file_name || attachment.name || 'File';
  const url = attachment.file_url || attachment.url;
  const type = attachment.mime_type || attachment.type;
  const size = attachment.file_size || 0;

  // ฟังก์ชันแสดงขนาดไฟล์
  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ─── 1. รูปภาพ ───────────────────────────────────────────────────
  if (type && (type.startsWith('image/') || IMAGE_TYPES.includes(type))) {
    return (
      <div style={{ marginTop: 6, marginBottom: 8 }}>
        <img
          src={url}
          alt={name}
          style={{
            maxWidth: 240,
            maxHeight: 240,
            borderRadius: 8,
            cursor: 'pointer',
            display: 'block',
          }}
          onClick={() => window.open(url, '_blank')}
          onError={(e) => { e.target.alt = 'Image failed to load'; }}
        />
        <div style={{ fontSize: 10, color: '#94B4C1', marginTop: 4, opacity: 0.8 }}>
          {name} {size > 0 && `· ${formatSize(size)}`}
        </div>
      </div>
    );
  }

  // ─── 2. วิดีโอ ───────────────────────────────────────────────────
  if (type && (type.startsWith('video/') || VIDEO_TYPES.includes(type))) {
    return (
      <div style={{ marginTop: 6, marginBottom: 8 }}>
        <video
          src={url}
          controls
          style={{ maxWidth: 240, borderRadius: 8, display: 'block' }}
        />
        <div style={{ fontSize: 10, color: '#94B4C1', marginTop: 4, opacity: 0.8 }}>
          {name} {size > 0 && `· ${formatSize(size)}`}
        </div>
      </div>
    );
  }

  // ─── 3. ไฟล์ทั่วไป (PDF, docx, zip ...) ─────────────────────────
  return (
    <div
      style={{
        marginTop: 6,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        maxWidth: 240,
        cursor: 'pointer',
      }}
      onClick={() => window.open(url, '_blank')}
      title={`Download: ${name}`}
    >
      <span style={{ fontSize: '20px' }}>📎</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '13px',
          fontWeight: '600',
          color: '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {name}
        </div>
        {size > 0 && (
          <div style={{ fontSize: '11px', color: '#94B4C1' }}>{formatSize(size)}</div>
        )}
      </div>
    </div>
  );
}