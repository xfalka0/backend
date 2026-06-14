-- Migration: Create Party Rooms and Seats tables
CREATE TABLE IF NOT EXISTS party_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    host_id TEXT NOT NULL,
    background_url TEXT,
    room_level INT DEFAULT 1,
    is_private BOOLEAN DEFAULT FALSE,
    password VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS party_room_seats (
    id SERIAL PRIMARY KEY,
    room_id UUID REFERENCES party_rooms(id) ON DELETE CASCADE,
    seat_number INT NOT NULL,
    user_id TEXT, -- NULL if empty
    is_locked BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    UNIQUE(room_id, seat_number)
);

CREATE INDEX IF NOT EXISTS idx_party_rooms_host_id ON party_rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_party_room_seats_room_id ON party_room_seats(room_id);
