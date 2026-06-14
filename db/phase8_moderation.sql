-- Drop reports if exists to reconstruct with Phase 8 specs
DROP TABLE IF EXISTS reports CASCADE;

CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id UUID NULL REFERENCES rooms(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    description TEXT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, reviewed, rejected, accepted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reconstruct admin_actions table with Phase 8 specs
DROP TABLE IF EXISTS admin_actions CASCADE;

CREATE TABLE admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
    room_id UUID NULL REFERENCES rooms(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- kick, mute, chat-ban, assign-role
    payload_json JSONB NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_room ON reports(room_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_room ON admin_actions(room_id);
