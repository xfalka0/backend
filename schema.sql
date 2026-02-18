-- Enable UUID extension
CREATE TYPE "role_enum" AS ENUM ('user', 'operator', 'admin', 'super_admin');
CREATE TYPE "content_type_enum" AS ENUM ('text', 'image', 'video', 'gift', 'call_stub'); -- call_stub is for fake calls
CREATE TYPE "transaction_type_enum" AS ENUM ('purchase', 'spend_chat', 'spend_gift', 'spend_call', 'bonus');

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user', -- user, operator, admin, super_admin, moderator
    balance INT DEFAULT 0,
    is_vip BOOLEAN DEFAULT FALSE,
    vip_xp INT DEFAULT 0,
    avatar_url TEXT,
    gender VARCHAR(10) DEFAULT 'kadin',
    last_login_at TIMESTAMP,
    ban_expires_at TIMESTAMP,
    account_status VARCHAR(50) DEFAULT 'active',
    job VARCHAR(100),
    relationship VARCHAR(50),
    zodiac VARCHAR(50),
    interests TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activities (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operators (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    is_online BOOLEAN DEFAULT FALSE,
    category VARCHAR(100), -- e.g., 'Flirty', 'Listener', etc.
    rating FLOAT DEFAULT 5.0,
    commission_rate FLOAT DEFAULT 0.3, -- 30% comm
    bio TEXT,
    photos TEXT[] -- Array of photo URLs for profile
);

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    operator_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'active', -- active, closed
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    content_type VARCHAR(50) DEFAULT 'text', -- text, image, video, gift, call_stub
    content TEXT, -- Text message or URL to media
    gift_id INT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gifts (
    id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    cost INT NOT NULL,
    icon_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coin_packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    coins INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fake_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id UUID REFERENCES users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    title VARCHAR(255),
    duration_sec INT
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount INT NOT NULL, -- Negative for spend, positive for purchase
    type VARCHAR(50) NOT NULL, -- purchase, spend_chat, spend_gift...
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- 'avatar' or 'album'
    url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_likes (
    post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS otps (
    id SERIAL PRIMARY KEY,
    identifier VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
