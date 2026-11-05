const db = require('../db');

const sanitizeUser = (user, req) => {
    if (!user) return null;

    // Safety check for req
    if (!req) return user;

    // Force HTTPS on Render or if x-forwarded-proto is https
    let protocol = 'http';
    const hostHeader = req.get ? req.get('host') : null;

    if (hostHeader && (hostHeader.includes('onrender.com') || req?.headers?.['x-forwarded-proto'] === 'https')) {
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

    // Strip sensitive security & internal fields
    delete newUser.password_hash;
    delete newUser.password;
    delete newUser.otp_code;
    delete newUser.otp_expires;
    delete newUser.device_token;

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
    // %100 dogal ve gercek: otomatik sahte takip/goruntuleme kaldirildi
    return;
};

// Auto-Engagement functions moved to dedicated autoMessageSystem.js
const triggerAutoEngagement = async (io, newUserId) => {
    return;
};

const triggerLoginAutoEngagement = async (io, userId) => {
    return;
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

