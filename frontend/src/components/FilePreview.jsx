import React from 'react';
import { formatFileSize, getFileIcon } from './MessageAttachment';
import './FilePreview.css';

export default function FilePreview({ preview, onConfirm, onCancel }) {
  if (!preview) return null;

  const { name, size, mimeType, thumbnail } = preview;
  const isImage = thumbnail && mimeType && mimeType.startsWith('image/');

  return (
    <div className="file-preview-overlay" onClick={onCancel}>
      <div className="file-preview-card" onClick={(e) => e.stopPropagation()}>
        <h4>ยืนยันส่งไฟล์</h4>

        {isImage ? (
          <img
            className="file-preview-thumbnail"
            src={thumbnail}
            alt={name}
          />
        ) : (
          <div className="file-preview-icon">
            {getFileIcon(mimeType)}
          </div>
        )}

        <div className="file-preview-info">
          <div className="file-preview-name">{name}</div>
          <div className="file-preview-meta">
            {formatFileSize(size)} · {mimeType || 'ไม่ทราบประเภท'}
          </div>
        </div>

        <div className="file-preview-actions">
          <button className="file-preview-btn-cancel" onClick={onCancel}>
            ยกเลิก
          </button>
          <button className="file-preview-btn-confirm" onClick={onConfirm}>
            ส่งไฟล์
          </button>
        </div>
      </div>
    </div>
  );
}
