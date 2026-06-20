-- Migration to create Family/Guild system tables

-- 1. Families Table
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    badge_url TEXT,
    description VARCHAR(255),
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    level INT DEFAULT 1,
    points INT DEFAULT 0,
    member_count INT DEFAULT 1,
    max_members INT DEFAULT 10, -- Level 1 starts with 10 max members
    join_type VARCHAR(20) DEFAULT 'approval_required', -- 'open', 'approval_required', 'invite_only'
    total_gift_revenue INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Family Members Table
CREATE TABLE IF NOT EXISTS family_members (
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'new_member', -- 'leader', 'co_leader', 'officer', 'member', 'new_member'
    daily_xp_contributed INT DEFAULT 0,
    total_xp_contributed INT DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (family_id, user_id),
    CONSTRAINT unique_user_in_family UNIQUE (user_id) -- User can only belong to 1 family
);

-- 3. Family Applications Table
CREATE TABLE IF NOT EXISTS family_applications (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_pending_app UNIQUE (family_id, user_id, status)
);

-- 4. Family Invites Table
CREATE TABLE IF NOT EXISTS family_invites (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Family XP Logs Table
CREATE TABLE IF NOT EXISTS family_xp_logs (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    xp_amount INT NOT NULL,
    source_type VARCHAR(50) NOT NULL, -- 'check_in', 'voice_room', 'gift_sent', 'gift_received', 'task', 'event'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Family Wallet Table
CREATE TABLE IF NOT EXISTS family_wallet (
    family_id INT PRIMARY KEY REFERENCES families(id) ON DELETE CASCADE,
    balance INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. Family Tasks Table
CREATE TABLE IF NOT EXISTS family_tasks (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    task_name VARCHAR(100) NOT NULL,
    target_value INT NOT NULL,
    current_value INT DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    xp_reward INT DEFAULT 100,
    created_at DATE DEFAULT CURRENT_DATE
);

-- 8. Family Chat Messages Table
CREATE TABLE IF NOT EXISTS family_chat_messages (
    id SERIAL PRIMARY KEY,
    family_id INT REFERENCES families(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

