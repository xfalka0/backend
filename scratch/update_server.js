const fs = require('fs');
let code = fs.readFileSync('backend/server.js', 'utf8');

// 1. Add imports if missing
const oldImport = "const { checkProfileText, checkPhotoSecurity } = require('./utils/moderationFilter');";
const newImport = "const { checkProfileText, checkPhotoSecurity } = require('./utils/moderationFilter');\nconst { resolveTab, VALID_TABS } = require('./constants/tabs');\nconst { validateAge } = require('./utils/validation');";
if (!code.includes('resolveTab')) {
    code = code.replace(oldImport, newImport);
}

// 2. Age validation in app.put('/api/users/:id')
const oldPutId = "const { name, display_name, age, gender, bio, job, edu } = req.body;";
const newPutId = `const { name, display_name, age, gender, bio, job, edu } = req.body;

    if (age !== undefined && age !== null && age !== '') {
        const ageCheck = validateAge(age);
        if (!ageCheck.valid) return res.status(400).json({ error: ageCheck.error });
    }`;
if (!code.includes('const ageCheck = validateAge(age);') && code.includes(oldPutId)) {
    code = code.replace(oldPutId, newPutId);
}

// 3. Age validation in app.put('/api/users/:id/profile') line ~2068
const oldPutProfile1 = "const { display_name, name, bio, avatar_url, gender, interests, onboarding_completed, relationship, zodiac, age, city } = req.body;";
const newPutProfile1 = `const { display_name, name, bio, avatar_url, gender, interests, onboarding_completed, relationship, zodiac, age, city } = req.body;

    if (age !== undefined && age !== null && age !== '') {
        const ageCheck = validateAge(age);
        if (!ageCheck.valid) return res.status(400).json({ error: ageCheck.error });
    }`;
if (code.includes(oldPutProfile1)) {
    code = code.replace(oldPutProfile1, newPutProfile1);
}

// 4. Age validation in app.put('/api/users/:id/profile', authenticateToken) line ~3273
const oldPutProfile2 = "const { name, bio, job, relationship, zodiac, interests, age, edu, boy, kilo, city } = req.body;";
const newPutProfile2 = `const { name, bio, job, relationship, zodiac, interests, age, edu, boy, kilo, city } = req.body;

    if (age !== undefined && age !== null && age !== '') {
        const ageCheck = validateAge(age);
        if (!ageCheck.valid) return res.status(400).json({ error: ageCheck.error });
    }`;
if (code.includes(oldPutProfile2)) {
    code = code.replace(oldPutProfile2, newPutProfile2);
}

// 5. Update /api/discovery
const oldDiscoveryStart = "app.get('/api/discovery', authenticateToken, async (req, res) => {";
// Let's find the discovery route and replace its body up to result rows mapping
const discoveryRegex = /app\.get\('\/api\/discovery'[\s\S]*?const rows = result\.rows\.map[\s\S]*?res\.json\(rows\);/m;

const newDiscoveryCode = `app.get('/api/discovery', authenticateToken, async (req, res) => {
    try {
        const userGenderRaw = (req.user.gender || '').toString().toLowerCase().trim();
        const userGender = ['kadin', 'kadın', 'female', 'woman'].includes(userGenderRaw) ? 'kadin' : 'erkek';
        
        // STRICT TARGET GENDER: Determined strictly by user's registered gender in token
        // Men see women; Women see men. Coin dealers are handled as exception.
        const targetGender = userGender === 'kadin' ? 'erkek' : 'kadin';
        
        const { page = 1, limit = 20, gender: filterGender, tab: rawTab } = req.query;

        // Security check: Ignore and log any attempt to override targetGender via query parameter
        if (filterGender) {
            console.warn(\`[DISCOVERY SECURITY] User \${req.user.id} (\${userGender}) attempted to send gender filter "\${filterGender}". Parameter IGNORED. Strict opposite gender (\${targetGender}) enforced.\`);
        }

        // Tab validation
        const tab = resolveTab(rawTab);
        if (!tab) {
            console.warn(\`[DISCOVERY] Invalid tab received: "\${rawTab}" from User \${req.user.id}. Returning HTTP 400.\`);
            return res.status(400).json({
                error: 'Geçersiz sekme parametresi.',
                received: rawTab,
                validTabs: VALID_TABS
            });
        }

        const pageNum = Math.max(1, parseInt(page) || 1);
        const requestedLimit = parseInt(limit) || 20;
        const limitNum = Math.min(30, Math.max(1, requestedLimit)); // Upper bounded at 30
        const offset = (pageNum - 1) * limitNum;
        const userId = req.user.id;

        console.log(\`[DISCOVERY] User \${userId} (\${userGender}) -> Target: \${targetGender}. Tab: \${tab}, Page: \${pageNum}, Limit: \${limitNum}\`);

        let whereClause = \`WHERE (LOWER(u.gender) = LOWER($1) OR u.gender = 'coin_bayisi' OR (LOWER($1) = 'kadin' AND LOWER(u.gender) IN ('kadin', 'kadın', 'female')) OR (LOWER($1) = 'erkek' AND LOWER(u.gender) IN ('erkek', 'male'))) AND u.role NOT IN ('admin', 'super_admin', 'moderator', 'staff') AND (u.gender_confirmed_at IS NOT NULL OR u.role = 'operator' OR u.gender = 'coin_bayisi')\`;

        let orderByClause = '';
        if (tab === 'Yeni') {
            orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
        } else if (tab === 'Popüler') {
            orderByClause = 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC';
        } else if (tab === 'Çevrimiçi') {
            whereClause += ' AND o.is_online = TRUE';
            orderByClause = 'ORDER BY o.last_active_at DESC NULLS LAST, u.vip_level DESC, u.created_at DESC, u.id DESC';
        } else {
            // "Önerilen" or Default: Online -> New User (3 Days) -> Boosted -> VIP levels
            orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \\'3 days\\') DESC, COALESCE(active_boosts.val, FALSE) DESC, u.vip_level DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';
        }

        const query = \`
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, 
                u.gender, 
                u.age, 
                u.vip_level, 
                u.job,
                u.relationship,
                u.zodiac,
                u.interests,
                u.role,
                u.boy,
                u.city,
                o.category, 
                o.rating, 
                o.is_online, 
                COALESCE(o.bio, u.bio) as bio, 
                o.photos,
                CASE WHEN o.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_operator,
                COALESCE(active_stories.val, FALSE) as has_active_story,
                COALESCE(active_boosts.val, FALSE) as is_boosted,
                un.expires_at as nobility_expires_at, 
                nt.key as nobility_key, 
                nt.name as nobility_name, 
                nt.level as nobility_level, 
                nt.badge_url as nobility_badge_url, 
                nt.name_color as nobility_name_color,
                a.name as agency_name
            FROM users u
            LEFT JOIN operators o ON u.id = o.user_id
            LEFT JOIN user_nobility un ON u.id = un.user_id AND un.is_active = TRUE AND un.expires_at > NOW()
            LEFT JOIN nobility_titles nt ON un.title_id = nt.id
            LEFT JOIN agencies a ON u.agency_id::text = a.id::text
            LEFT JOIN LATERAL (
                SELECT TRUE as val FROM boosts b WHERE b.user_id = u.id AND b.end_time > NOW() LIMIT 1
            ) active_boosts ON TRUE
            LEFT JOIN LATERAL (
                SELECT TRUE as val FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW() LIMIT 1
            ) active_stories ON TRUE
            \${whereClause}
              AND u.id != $2
              AND u.account_status = 'active'
            \${orderByClause}
            LIMIT $3 OFFSET $4
        \`;

        const queryParams = [targetGender, userId, limitNum, offset];
        const startTime = Date.now();
        const result = await db.query(query, queryParams);
        const duration = Date.now() - startTime;
        
        if (duration > 300) {
            console.warn(\`[PERFORMANCE WARNING] Discovery query for tab "\${tab}" took \${duration}ms!\`);
        }

        const rows = result.rows.map(row => {
            let parsedPhotos = [];
            if (row.photos) {
                if (typeof row.photos === 'string') {
                    try {
                        parsedPhotos = JSON.parse(row.photos);
                    } catch (e) {
                        parsedPhotos = row.photos.replace(/[{}]/g, '').split(',').map(s => s.trim().replace(/"/g, ''));
                    }
                } else if (Array.isArray(row.photos)) {
                    parsedPhotos = row.photos;
                }
            }
            return {
                ...row,
                photos: parsedPhotos,
                avatar_url: row.avatar_url || (parsedPhotos.length > 0 ? parsedPhotos[0] : null)
            };
        });

        const sanitizedRows = rows.map(r => sanitizeUser(r, req));
        res.json({
            data: sanitizedRows,
            hasMore: sanitizedRows.length >= limitNum,
            page: pageNum,
            limit: limitNum
        });`;

code = code.replace(discoveryRegex, newDiscoveryCode);

// 6. Update /api/operators endpoint
const oldOpStart = "app.get('/api/operators', async (req, res) => {";
const opRegex = /app\.get\('\/api\/operators', async \(req, res\) => {[\s\S]*?const result = await db\.query\(query, params\);/m;

const newOpCode = `app.get('/api/operators', async (req, res) => {
    try {
        const { gender, page = 1, limit = 20, tab = 'Önerilen' } = req.query;
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(30, Math.max(1, parseInt(limit) || 20));
        const offset = (pageNum - 1) * limitNum;

        let enforcedGender = null;
        // If an authenticated user token is provided, enforce opposite gender rule strictly
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
        if (token) {
            try {
                const decoded = jwt.verify(token, SECRET_KEY);
                const userGenderRaw = (decoded.gender || '').toString().toLowerCase().trim();
                const userGender = ['kadin', 'kadın', 'female', 'woman'].includes(userGenderRaw) ? 'kadin' : 'erkek';
                enforcedGender = userGender === 'kadin' ? 'erkek' : 'kadin';
                if (gender) {
                    console.warn(\`[OPERATORS SECURITY] User \${decoded.id} (\${userGender}) tried to send gender filter "\${gender}". Overridden by opposite gender rule (\${enforcedGender}).\`);
                }
            } catch (e) {
                // Invalid token, proceed
            }
        }

        console.log(\`[OPERATORS] Fetching. EnforcedGender: \${enforcedGender || gender || 'all'}, Tab: \${tab}, Page: \${pageNum}, Limit: \${limitNum}\`);

        let query = \`
            SELECT 
                u.id, 
                COALESCE(u.display_name, u.username) as name, 
                u.avatar_url, u.gender, u.age, u.vip_level, u.job, u.relationship, u.zodiac, u.interests, u.role, u.boy, u.city,
                o.category, o.rating, o.is_online, 
                COALESCE(o.bio, u.bio) as bio, o.photos,
                EXISTS(SELECT 1 FROM stories s WHERE s.operator_id = u.id AND s.expires_at > NOW()) as has_active_story,
                un.expires_at as nobility_expires_at, 
                nt.key as nobility_key, 
                nt.name as nobility_name, 
                nt.level as nobility_level, 
                nt.badge_url as nobility_badge_url, 
                nt.name_color as nobility_name_color,
                a.name as agency_name
            FROM users u
            JOIN operators o ON u.id = o.user_id
            LEFT JOIN user_nobility un ON u.id = un.user_id AND un.is_active = TRUE AND un.expires_at > NOW()
            LEFT JOIN nobility_titles nt ON un.title_id = nt.id
            LEFT JOIN agencies a ON u.agency_id::text = a.id::text
            WHERE u.account_status = 'active'
              AND u.role = 'operator'
        \`;

        let params = [];
        let paramCount = 1;

        if (enforcedGender) {
            query += \` AND (u.gender = $\${paramCount} OR u.gender = 'coin_bayisi') \`;
            params.push(enforcedGender);
            paramCount++;
        } else if (gender === 'erkek' || gender === 'kadin' || gender === 'male' || gender === 'female') {
            const normalizedGender = (gender === 'male' || gender === 'erkek') ? 'erkek' : 'kadin';
            query += \` AND (u.gender = $\${paramCount} OR u.gender = 'coin_bayisi') \`;
            params.push(normalizedGender);
            paramCount++;
        }

        let orderByClause = '';
        if (tab === 'Yeni') {
            orderByClause = 'ORDER BY u.created_at DESC, u.id DESC';
        } else if (tab === 'Popüler') {
            orderByClause = 'ORDER BY u.vip_level DESC, o.rating DESC NULLS LAST, u.created_at DESC, u.id DESC';
        } else {
            orderByClause = 'ORDER BY o.is_online DESC NULLS LAST, (u.created_at >= NOW() - INTERVAL \\'3 days\\') DESC, (coalesce(cardinality(o.photos), 0) > 0) DESC, u.created_at DESC, u.id DESC';
        }

        query += \` \${orderByClause} LIMIT $\${paramCount} OFFSET $\${paramCount + 1}\`;
        params.push(limitNum, offset);

        const result = await db.query(query, params);`;

code = code.replace(opRegex, newOpCode);

fs.writeFileSync('backend/server.js', code, 'utf8');
console.log('Successfully updated backend/server.js');

