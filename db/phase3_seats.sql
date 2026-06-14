-- Phase 3 Room Seats Table
CREATE TABLE IF NOT EXISTS room_seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    seat_index INT NOT NULL,
    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    is_locked BOOLEAN DEFAULT false,
    mic_on BOOLEAN DEFAULT false,
    seat_role VARCHAR(50) DEFAULT 'normal', -- normal, host, vip
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, seat_index)
);

CREATE INDEX IF NOT EXISTS idx_room_seats_room ON room_seats(room_id);
CREATE INDEX IF NOT EXISTS idx_room_seats_user ON room_seats(user_id);
