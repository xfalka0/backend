-- Phase 2 Room System tables
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_code VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    background_image_url TEXT NULL,
    cover_image_url TEXT NULL,
    room_type VARCHAR(50) DEFAULT 'voice', -- party, voice, private
    max_seats INT DEFAULT 12,
    is_private BOOLEAN DEFAULT false,
    password_hash VARCHAR(255) NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, closed, banned
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member', -- owner, admin, member, guest
    is_muted BOOLEAN DEFAULT false,
    is_chat_banned BOOLEAN DEFAULT false,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL
);

-- Performance indices
CREATE INDEX IF NOT EXISTS idx_rooms_owner ON rooms(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(room_code);
CREATE INDEX IF NOT EXISTS idx_room_members_room ON room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id);
