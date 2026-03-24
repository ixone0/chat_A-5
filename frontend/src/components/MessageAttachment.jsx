import React from 'react';

const MessageAttachment = ({ attachment }) => {
  if (!attachment) return null;

  const { type, url, name } = attachment;

  // ถ้าเป็นรูปภาพ
  if (type && type.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={name || 'attachment'}
        style={{
          maxWidth: 240,
          maxHeight: 240,
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 8
        }}
        onClick={() => window.open(url, '_blank')}
        onError={(e) => {
          e.target.alt = 'Image failed to load';
        }}
      />
    );
  }

  // ถ้าเป็นไฟล์อื่นๆ
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 8,
        maxWidth: 240
      }}
      onClick={() => window.open(url, '_blank')}
      title={`Download: ${name}`}
    >
      <span style={{ fontSize: '20px' }}>📎</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: '0 0 2px 0',
          fontSize: '14px',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {name || 'File'}
        </p>
      </div>
    </div>
  );
};

export default MessageAttachment;
