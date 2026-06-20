const db = require('../db');

const sanitizeUser = (user, req) => {
    if (!user) return null;

    // Safety check for req
    if (!req) return user;

    // Force HTTPS on Render or if x-forwarded-proto is https
    let protocol = 'http';
    const hostHeader = req.get ? req.get('host') : null;

    if (hostHeader && (hostHeader.includes('onrender.com') || req.headers['x-forwarded-proto'] === 'https')) {
        protocol = 'https';
    } else {
        protocol = req?.protocol || 'http';
    }
    const host = (req?.get ? (req.get('x-forwarded-host') || req.get('host')) : null) || 'localhost:3000';

    const newUser = { ...user };

    const rewrite = (url) => {
        if (!url || typeof url !== 'string' || url.trim() === '') return url;

        const trimmedUrl = url.trim();

        // 1. If it's already an absolute URL (http/https), just return it
        if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
            return trimmedUrl;
        }

        // 2. Fix invalid prefixes injected sometimes
        if (trimmedUrl.startsWith('http')) {
            return trimmedUrl.replace('http:', 'http://').replace('https:', 'https://');
        }

        // 3. If it's a relative URL, prepend the server host
        const cleanRelativePath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
        return `${protocol}://${host}${cleanRelativePath}`;
    };

    // Rewrite common image fields
    if (newUser.avatar_url) newUser.avatar_url = rewrite(newUser.avatar_url);
    if (newUser.avatar) newUser.avatar = rewrite(newUser.avatar);
    if (newUser.image_url) newUser.image_url = rewrite(newUser.image_url);
    if (newUser.image) newUser.image = rewrite(newUser.image);

    // Casing compatibility mapping for Phase 1
    newUser.displayName = user.display_name !== undefined ? user.display_name : user.displayName;
    newUser.avatarUrl = user.avatar_url !== undefined ? user.avatar_url : user.avatarUrl;
    newUser.coinBalance = user.coin_balance !== undefined ? user.coin_balance : (user.balance !== undefined ? user.balance : user.coinBalance);
    newUser.diamondBalance = user.diamond_balance !== undefined ? user.diamond_balance : user.diamondBalance;
    newUser.vipLevel = user.vip_level !== undefined ? user.vip_level : (user.vipLevel !== undefined ? user.vipLevel : 0);
    newUser.status = user.status !== undefined ? user.status : (user.account_status !== undefined ? user.account_status : user.status);

    // Nobility status mapping
    newUser.nobilityKey = user.nobility_key !== undefined ? user.nobility_key : user.nobilityKey;
    newUser.nobilityName = user.nobility_name !== undefined ? user.nobility_name : user.nobilityName;
    newUser.nobilityLevel = user.nobility_level !== undefined ? user.nobility_level : user.nobilityLevel;
    newUser.nobilityBadgeUrl = user.nobility_badge_url !== undefined ? user.nobility_badge_url : user.nobilityBadgeUrl;
    newUser.nobilityNameColor = user.nobility_name_color !== undefined ? user.nobility_name_color : user.nobilityNameColor;

    // Pass through onboarding status
    if (user.onboarding_completed !== undefined) {
        newUser.onboarding_completed = !!user.onboarding_completed;
    }

    // Rewrite Photos array if exists (for operators)
    if (newUser.photos && Array.isArray(newUser.photos)) {
        newUser.photos = newUser.photos.map(p => rewrite(p));
    }

    return newUser;
};

// Helper: Log Activity & Emit Socket Event
const logActivity = async (io, userId, actionType, description) => {
    try {
        // 1. Insert into DB
        const result = await db.query(
            'INSERT INTO activities (user_id, action_type, description) VALUES ($1, $2, $3) RETURNING *',
            [userId, actionType, description]
        );

        // 2. Fetch User Details for UI
        const act = result.rows[0];
        const userRes = await db.query('SELECT username, avatar_url FROM users WHERE id = $1', [userId]);
        const user = userRes.rows[0] || { username: 'Unknown', avatar_url: '' };

        const fullActivity = { ...act, user_name: user.username, user_avatar: user.avatar_url };

        // 3. Emit Real-time Event if io is provided
        if (io) {
            io.emit('new_activity', fullActivity);
        }

        return fullActivity;
    } catch (err) {
        console.error("Log Activity Error:", err.message);
    }
};

// Add fake social interactions for new users (Favorites and Views)
const assignFakeInteractions = async (newUserId) => {
    try {
        // Fetch user gender first
        const userRes = await db.query('SELECT gender FROM users WHERE id = $1', [newUserId]);
        if (userRes.rows.length === 0) return;
        
        const userGenderRaw = userRes.rows[0].gender || 'erkek';
        const userGender = (userGenderRaw === 'male' || userGenderRaw === 'erkek') ? 'erkek' : 'kadin';
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        // Find random active users of OPPOSITE gender
        const limitCount = Math.floor(Math.random() * 6) + 3;
        const randomUsers = await db.query(
            "SELECT id FROM users WHERE id != $1 AND account_status = 'active' AND gender = $2 AND role = 'user' ORDER BY RANDOM() LIMIT $3",
            [newUserId, targetGender, limitCount]
        );

        if (randomUsers.rows.length === 0) return;

        const fakeUsers = randomUsers.rows;

        for (let i = 0; i < fakeUsers.length; i++) {
            const actorId = fakeUsers[i].id;

            if (Math.random() > 0.4) {
                await db.query(
                    'INSERT INTO favorites (user_id, target_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [actorId, newUserId]
                );
            }

            if (Math.random() > 0.2) {
                const randomSeconds = Math.floor(Math.random() * 86400);
                await db.query(
                    `INSERT INTO profile_views (viewer_id, viewed_user_id, created_at) 
                     VALUES ($1, $2, NOW() - INTERVAL '${randomSeconds} seconds')`,
                    [actorId, newUserId]
                );
            }
        }
    } catch (err) {
        console.error("Fake Interaction Error:", err.message);
    }
};

// Auto-Engagement: Send messages from operators to new users over time
const triggerAutoEngagement = async (io, newUserId) => {
    try {
        console.log(`[AUTO-ENGAGEMENT] Triggered for user: ${newUserId}`);

        // 1. Fetch user gender
        const userRes = await db.query('SELECT gender, username FROM users WHERE id = $1', [newUserId]);
        if (userRes.rows.length === 0) return;

        const userGenderRaw = userRes.rows[0].gender || 'erkek';
        const userGender = (userGenderRaw === 'male' || userGenderRaw === 'erkek') ? 'erkek' : 'kadin';
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        // 2. Find random operators of OPPOSITE gender WHO DON'T HAVE A CHAT YET
        const opsRes = await db.query(
            `SELECT u.id, u.username FROM users u 
             JOIN operators o ON u.id = o.user_id 
             WHERE u.account_status = 'active' 
             AND u.gender = $1
             AND u.role = 'operator'
             AND NOT EXISTS (
                 SELECT 1 FROM chats c 
                 WHERE (c.user_id = $2 AND c.operator_id = u.id)
                    OR (c.user_id = u.id AND c.operator_id = $2)
             )
             ORDER BY RANDOM() LIMIT 3`,
            [targetGender, newUserId]
        );

        if (opsRes.rows.length === 0) {
            console.log("[AUTO-ENGAGEMENT] No compatible operators found to send messages.");
            return;
        }

        const operators = opsRes.rows;
        const messages = [
            "Selam, yeni misin buralarda? 😊",
            "Merhaba, profilin çok hoşuma gitti, tanışabilir miyiz?",
            "Hey! Sesin olsa nasıl olurdu merak ettim, burası çok eğlenceli!",
            "Günün nasıl geçiyor? Seninle sohbet etmek isterim.",
            "Selamlar! Profilini gördüm ve kayıtsız kalamadım ✨",
            "Hoş geldin! Aradığın birisi var mı yoksa sadece takılıyor musun? :)"
        ];

        // Schedule 1 or 2 messages between 5 and 35 seconds
        const schedule = [];
        const firstDelay = Math.floor(Math.random() * 30000) + 5000; // 5 - 35 seconds
        schedule.push({ delay: firstDelay, op: operators[0], msg: messages[Math.floor(Math.random() * messages.length)] });
        
        if (operators.length > 1 && Math.random() > 0.4) {
             const secondDelay = firstDelay + Math.floor(Math.random() * 15000) + 15000; // 15 - 30 seconds after first
             schedule.push({ delay: secondDelay, op: operators[1], msg: messages[Math.floor(Math.random() * messages.length)] });
        }

        schedule.forEach(item => {
            setTimeout(async () => {
                try {
                    // Check if chat exists or create it
                    let chatRes = await db.query(
                        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
                        [newUserId, item.op.id]
                    );

                    let chatId;
                    if (chatRes.rows.length === 0) {
                        const newChat = await db.query(
                            'INSERT INTO chats (user_id, operator_id, last_message, last_message_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                            [newUserId, item.op.id, item.msg]
                        );
                        chatId = newChat.rows[0].id;
                    } else {
                        chatId = chatRes.rows[0].id;
                    }

                    // Insert message
                    const msgResult = await db.query(
                        'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
                        [chatId, item.op.id, item.msg, 'text']
                    );
                    const savedMsg = msgResult.rows[0];

                    // Update last message in chat
                    await db.query('UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2', [item.msg, chatId]);

                    // Emit to user via socket
                    if (io) {
                        const roomName = chatId.toString();
                        const msgToEmit = {
                            ...savedMsg,
                            chat_id: roomName,
                            sender_username: item.op.username
                        };

                        console.log(`[AUTO-MESSAGE] Sending to ${newUserId} from ${item.op.username}`);
                        io.to(roomName).emit('receive_message', msgToEmit);
                        io.emit('admin_notification', msgToEmit);
                    }

                } catch (err) {
                    console.error("[AUTO-ENGAGEMENT ERROR] Failed to send scheduled message:", err.message);
                }
            }, item.delay);
        });

    } catch (err) {
        console.error("[AUTO-ENGAGEMENT ERROR]:", err.message);
    }
};

// Auto-Engagement: Send a single message from an operator when user logs in / opens app
const triggerLoginAutoEngagement = async (io, userId) => {
    try {
        console.log(`[LOGIN-ENGAGEMENT] Triggered for user: ${userId}`);

        // 1. Fetch user gender
        const userRes = await db.query("SELECT gender, username, role FROM users WHERE id = $1 AND role = 'user'", [userId]);
        if (userRes.rows.length === 0) return;

        const userGenderRaw = userRes.rows[0].gender || 'erkek';
        const userGender = (userGenderRaw === 'male' || userGenderRaw === 'erkek') ? 'erkek' : 'kadin';
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';

        // 2. Find random operators of OPPOSITE gender WHO DON'T HAVE A CHAT YET
        const opsRes = await db.query(
            `SELECT u.id, u.username FROM users u 
             JOIN operators o ON u.id = o.user_id 
             WHERE u.account_status = 'active' 
             AND u.gender = $1
             AND u.role = 'operator'
             AND NOT EXISTS (
                SELECT 1 FROM chats c 
                WHERE (c.user_id = $2 AND c.operator_id = u.id)
                   OR (c.user_id = u.id AND c.operator_id = $2)
             )
             ORDER BY RANDOM() LIMIT 2`,
            [targetGender, userId]
        );

        if (opsRes.rows.length === 0) return;

        const operators = opsRes.rows;
        const messages = [
            "Selam, tekrar hoş geldin! Nasılsın? 😊",
            "Gözüm yollarda kaldı, nasılsın bugün?",
            "Hey! Seni buralarda görmek ne güzel ✨",
            "Selamlar, günün nasıl geçiyor?",
            "Hoş geldin! Sohbet etmek istersen buradayım.",
            "Merhaba, bugün nasılsın? Konuşalım mı?"
        ];

        // Send messages from up to 2 new operators with staggered delays
        operators.forEach((op, index) => {
            const msgText = messages[Math.floor(Math.random() * messages.length)];
            // Delay 10 to 40 seconds (staggered if multiple)
            const delay = Math.floor(Math.random() * 30000) + 10000 + (index * 25000);

            setTimeout(async () => {
                try {
                    let chatRes = await db.query(
                        'SELECT id FROM chats WHERE (user_id = $1 AND operator_id = $2) OR (user_id = $2 AND operator_id = $1)',
                        [userId, op.id]
                    );

                    let chatId;
                    if (chatRes.rows.length === 0) {
                        const newChat = await db.query(
                            'INSERT INTO chats (user_id, operator_id, last_message, last_message_at) VALUES ($1, $2, $3, NOW()) RETURNING id',
                            [userId, op.id, msgText]
                        );
                        chatId = newChat.rows[0].id;
                    } else {
                        chatId = chatRes.rows[0].id;
                    }

                    const msgResult = await db.query(
                        'INSERT INTO messages (chat_id, sender_id, content, content_type) VALUES ($1, $2, $3, $4) RETURNING *',
                        [chatId, op.id, msgText, 'text']
                    );
                    const savedMsg = msgResult.rows[0];

                    await db.query('UPDATE chats SET last_message = $1, last_message_at = NOW() WHERE id = $2', [msgText, chatId]);

                    if (io) {
                        const roomName = chatId.toString();
                        const msgToEmit = {
                            ...savedMsg,
                            chat_id: roomName,
                            sender_username: op.username
                        };
                        io.to(roomName).emit('receive_message', msgToEmit);
                        io.emit('admin_notification', msgToEmit);
                    }
                } catch (err) {
                    console.error("[LOGIN-ENGAGEMENT ERROR] Failed to send message:", err.message);
                }
            }, delay);
        });
    } catch (err) {
        console.error("[LOGIN-ENGAGEMENT ERROR]:", err.message);
    }
};

const MALE_NAMES_ARRAY = [
    'abdurrahman', 'abdullah', 'abdulkadir', 'abdulkerim', 'adabi', 'adem', 'adnan', 'afsin', 'affiliate', 'akin', 'ahmet', 'ali', 'alper', 'alperen', 'anil', 'arda', 'arif', 'atilla', 'aziz', 'ayhan', 'aykut', 'baris', 'batuhan', 'bayram', 'behcet', 'berat', 'berk', 'berkay', 'bekir', 'bora', 'bulent', 'burak', 'cafer', 'cagatay', 'cavit', 'celal', 'cem', 'cemal', 'cevat', 'cihan', 'cengiz', 'cumali', 'davut', 'dogan', 'dogukan', 'dundar', 'ekrem', 'emir', 'emircan', 'emrah', 'emre', 'enes', 'enver', 'eray', 'ercan', 'erdem', 'erdogan', 'eren', 'erhan', 'erol', 'ersin', 'faruk', 'fatih', 'ferhat', 'fikret', 'fuat', 'furkan', 'gencay', 'gokhan', 'gokay', 'goksel', 'gursel', 'hakan', 'halil', 'hamza', 'harun', 'hasan', 'haydar', 'hikmet', 'huseyin', 'ibrahim', 'ihsan', 'ilhan', 'isa', 'ismail', 'ismet', 'kadir', 'kaan', 'kamil', 'karadayi', 'kazim', 'kemal', 'kerem', 'kiziltas', 'koksal', 'koray', 'levent', 'lokman', 'mahmut', 'mehmet', 'mert', 'mertcan', 'mesut', 'metehan', 'metin', 'mgelvg', 'muhammed', 'muhammet', 'murat', 'mustafa', 'muzaffer', 'necati', 'necip', 'nevzat', 'nihat', 'nuri', 'nusret', 'nurullah', 'okan', 'okten', 'omer', 'onur', 'orhan', 'osman', 'ozan', 'ozgur', 'polat', 'ramadan', 'ramazan', 'rasim', 'recep', 'ridvan', 'riza', 'sabri', 'sadik', 'sahin', 'sait', 'salih', 'sami', 'samet', 'savas', 'sedat', 'sefa', 'selcuk', 'selim', 'semih', 'serdar', 'serdal', 'serhat', 'sevket', 'sinan', 'suat', 'sultan', 'suleyman', 'taha', 'tamer', 'taner', 'tarik', 'tayyip', 'tekin', 'tolga', 'tuncay', 'turan', 'ugur', 'umut', 'ummet', 'veysel', 'volkan', 'yilmaz', 'yunus', 'yusuf', 'zafer', 'zeki', 'izzet', 'bilal', 'faysal', 'alpaslan',
    'sefer', 'celil', 'suha', 'dadas', 'durmus', 'dursun', 'genel', 'abuzer', 'agah', 
    'akif', 'asim', 'aslan', 'atac', 'aybars', 'ayberk', 'aydemir', 'aydin', 'ayhan', 
    'aytekin', 'aziz', 'azmi', 'bahadir', 'bahtiyar', 'baki', 'balkan', 'bamsi', 
    'barbaros', 'baskin', 'baskurt', 'basri', 'battal', 'bedir', 'bedirhan', 'bedri', 
    'behzad', 'bera', 'berkan', 'besim', 'beyani', 'birol', 'boran', 'boyzan', 
    'bozkurt', 'bugra', 'bulut', 'bunyamin', 'burhan', 'burhanettin', 'cabbar', 
    'cahit', 'can', 'caner', 'canip', 'canpolat', 'celalettin', 'cemali', 'cemil', 
    'cemsit', 'cenk', 'cevahir', 'cevdet', 'cevher', 'cezmi', 'cihangir', 'civan', 
    'coskun', 'cuma', 'cumhur', 'cuneyt', 'daghan', 'dalay', 'danis', 'demir', 
    'demirhan', 'dervis', 'devran', 'devrim', 'dilaver', 'dinc', 'dinger', 'diren', 
    'dogu', 'dogus', 'duran', 'dursun', 'duru', 'ebu', 'ebubekir', 'ecevit', 'ediz', 
    'efe', 'efecan', 'efendi', 'eflatun', 'egemen', 'ege', 'ender', 'engin', 'enis', 
    'ensar', 'eralp', 'erbak', 'erden', 'ergin', 'ergun', 'erkin', 'erkut', 'ertan', 
    'ertekin', 'ertugrul', 'esat', 'esref', 'evren', 'eymen', 'eyup', 'fahrettin', 
    'fahri', 'faik', 'fahriddin', 'fazil', 'fehmi', 'fehim', 'ferit', 'ferdi', 
    'feridun', 'ferman', 'fethi', 'fevzi', 'feyyaz', 'feyzullah', 'fikri', 'galip', 
    'gani', 'gazi', 'gediz', 'gencer', 'giyas', 'giyasettin', 'gokalp', 'gokcan', 
    'gokdeniz', 'gokmen', 'gokturk', 'gorkem', 'guven', 'guney', 'guray', 'gurbuz', 
    'gurkan', 'hakki', 'haldun', 'halim', 'halis', 'halit', 'haluk', 'hamdi', 
    'hamit', 'hasbi', 'hasim', 'hatay', 'hayati', 'hayrettin', 'hayri', 'hazim', 
    'hazrat', 'hidayet', 'hilmi', 'himmet', 'hulusi', 'husnu', 'husrev', 'idris', 
    'ikbal', 'ilhami', 'ilker', 'ilter', 'ilyas', 'imdat', 'inan', 'inanc', 'kaan', 
    'kadri', 'kasim', 'kaya', 'kayahan', 'kemalettin', 'kenan', 'koray', 'korkut', 
    'koksal', 'kudret', 'kurban', 'kursat', 'kutay', 'lutfi', 'lutfullah', 'mahir', 
    'mahzun', 'malkoc', 'mansur', 'mazhar', 'mazin', 'mecit', 'medeni', 'melih', 
    'memduh', 'menderes', 'menduh', 'menter', 'merter', 'mete', 'mithat', 'muammer', 
    'muaz', 'muharrem', 'muhlis', 'muhsin', 'muhtar', 'muhyiddin', 'mujdat', 
    'mukremin', 'mumin', 'munir', 'murtaza', 'musa', 'mutlu', 'muslum', 'nabi', 
    'naci', 'nadir', 'nafi', 'nail', 'naim', 'namik', 'nasir', 'nasuh', 'nazif', 
    'nazim', 'nazmi', 'nebi', 'necdet', 'necmettin', 'necmi', 'nedim', 'nejat', 
    'neset', 'nezat', 'nezih', 'niyazi', 'nizam', 'nizamettin', 'nuh', 'numan', 
    'nurettin', 'ogun', 'oguz', 'oguzhan', 'oktay', 'okyanus', 'olcay', 'omerfaruk', 
    'onder', 'orhun', 'ozcan', 'ozdemir', 'ozer', 'ozhan', 'ozkan', 'paksoy', 
    'pala', 'pamir', 'parlan', 'pars', 'pasa', 'peyami', 'polat', 'poyraz', 'rafey', 
    'rafet', 'rahim', 'rahmi', 'raif', 'ramiz', 'rasit', 'rauf', 'refik', 'reha', 
    'remzi', 'resul', 'resat', 'resit', 'ridvan', 'rifat', 'rifki', 'ruchan', 
    'rustem', 'rustu', 'sadi', 'sadullah', 'safa', 'saffet', 'sahir', 'sakip', 
    'salim', 'samih', 'sener', 'sermet', 'sertac', 'servet', 'seyfi', 'seyfullah', 
    'seyit', 'sezai', 'sezer', 'sezgin', 'sitki', 'soner', 'subhi', 'suphi', 
    'sumer', 'sungur', 'saban', 'sadi', 'safak', 'sahin', 'sakir', 'samil', 
    'sanal', 'sansal', 'sayan', 'sefik', 'semsi', 'senol', 'serafettin', 'serif', 
    'sevki', 'sih', 'sinasi', 'sukru', 'taha', 'tahir', 'tahsin', 'talat', 'talha', 
    'talip', 'tanju', 'tarkan', 'tayfun', 'tayfur', 'taylan', 'tayyar', 'temel', 
    'teoman', 'tevfik', 'tunc', 'tuncer', 'turgay', 'turgut', 'turkay', 'turker', 
    'tursun', 'ufuk', 'ugur', 'ulas', 'ulvi', 'umit', 'unal', 'unalmis', 'utku', 
    'uysal', 'uzun', 'uzer', 'vakas', 'vahit', 'varol', 'vedat', 'vefa', 'vehbi', 
    'vural', 'yalcin', 'yaman', 'yekta', 'yener', 'yetkin', 'yucel', 'yuksel', 
    'yup', 'yusa', 'zahit', 'zekai', 'zekeriya', 'zeynel', 'zeynelabidin', 'zihni', 
    'ziya', 'zorlu', 'zulfu', 'zulkuf'
];

const MALE_NAME_PATTERN = '\\y(' + MALE_NAMES_ARRAY.join('|') + ')\\y';

module.exports = {
    sanitizeUser,
    logActivity,
    assignFakeInteractions,
    triggerAutoEngagement,
    triggerLoginAutoEngagement,
    MALE_NAMES_ARRAY,
    MALE_NAME_PATTERN
};

