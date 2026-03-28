// components/MessageAttachment.jsx
import { useState } from 'react';
import './MessageAttachment.css';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEO_TYPES = ['video/mp4', 'video/quicktime'];

export function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileIcon(mimeType) {
  if (!mimeType) return '📎';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return '🗜️';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
  if (mimeType === 'text/plain') return '📃';
  return '📎';
}

function DownloadButton({ url, name }) {
  return (
    <a
      href={url}
      download={name}
      className="attachment-download-btn"
      title="ดาวน์โหลด"
      onClick={(e) => e.stopPropagation()}
    >
      ⬇️
    </a>
  );
}

export default function MessageAttachment({ attachment }) {
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  if (!attachment) return null;

  const name = attachment.file_name || attachment.name || 'File';
  const url = attachment.file_url || attachment.url;
  const type = attachment.mime_type || attachment.type;
  const size = attachment.file_size || 0;

  // ─── 1. รูปภาพ ───────────────────────────────────────────────────
  if (type && (type.startsWith('image/') || IMAGE_TYPES.includes(type))) {
    // Fallback: แสดง icon + ชื่อไฟล์ เมื่อโหลดรูปไม่สำเร็จ
    if (imgError) {
      return (
        <div className="attachment-wrapper">
          <div className="attachment-image-fallback">
            <span className="attachment-image-fallback-icon">🖼️</span>
            <span className="attachment-image-fallback-name">{name}</span>
            <DownloadButton url={url} name={name} />
          </div>
        </div>
      );
    }

    return (
      <div className="attachment-wrapper">
        {imgLoading && (
          <div className="attachment-image-placeholder">กำลังโหลด...</div>
        )}
        <img
          src={url}
          alt={name}
          className="attachment-image"
          style={imgLoading ? { display: 'none' } : undefined}
          onClick={() => window.open(url, '_blank')}
          onLoad={() => setImgLoading(false)}
          onError={() => { setImgLoading(false); setImgError(true); }}
        />
        {!imgLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <span className="attachment-info" style={{ margin: 0 }}>
              {name} {size > 0 && `· ${formatFileSize(size)}`}
            </span>
            <DownloadButton url={url} name={name} />
          </div>
        )}
      </div>
    );
  }

  // ─── 2. วิดีโอ ───────────────────────────────────────────────────
  if (type && (type.startsWith('video/') || VIDEO_TYPES.includes(type))) {
    return (
      <div className="attachment-wrapper">
        <video src={url} controls className="attachment-video" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span className="attachment-info" style={{ margin: 0 }}>
            {name} {size > 0 && `· ${formatFileSize(size)}`}
          </span>
          <DownloadButton url={url} name={name} />
        </div>
      </div>
    );
  }

  // ─── 3. ไฟล์ทั่วไป (PDF, docx, zip ...) ─────────────────────────
  return (
    <div className="attachment-wrapper">
      <div
        className="attachment-file-card"
        onClick={() => window.open(url, '_blank')}
        title={`Download: ${name}`}
      >
        <span className="attachment-file-icon">{getFileIcon(type)}</span>
        <div className="attachment-file-details">
          <div className="attachment-file-name">{name}</div>
          {size > 0 && (
            <div className="attachment-file-size">{formatFileSize(size)}</div>
          )}
        </div>
        <DownloadButton url={url} name={name} />
      </div>
    </div>
  );
}
