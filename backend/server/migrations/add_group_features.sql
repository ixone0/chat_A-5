-- Migration: Add columns for group description, mute, pin, admin role
-- Run this on your PostgreSQL database before deploying

-- 1. Group description
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Mute per user
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS muted BOOLEAN DEFAULT FALSE;

-- 3. Pin message
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

-- Note: Admin role uses existing 'role' column in conversation_members
-- Valid values: 'owner', 'admin', 'member'
