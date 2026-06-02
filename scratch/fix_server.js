const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '../server.js');
let content = fs.readFileSync(serverPath, 'utf8');

// The target text to replace
const target = `    } catch (err) {
        res.status(500).json({ error: 'Ajansa katılırken bir hata oluştu.' });
    }
});`;

// The replacement text
const replacement = `// ASSIGN USER TO AGENCY
app.post('/api/admin/users/:userId/assign-agency', authenticateToken, authorizeRole('admin', 'super_admin'), async (req, res) => {
    const { userId } = req.params;
    const { agencyId } = req.body;
    try {
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agencyId || null, userId]);
        res.json({ success: true, message: 'Kullanıcı ajansa başarıyla atandı.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// JOIN AGENCY (User side)
app.post('/api/agencies/join', authenticateToken, async (req, res) => {
    const { agencyId } = req.body; // Can be agency UUID or referral code (e.g. FLK123)
    const userId = req.user.id;

    if (!agencyId) return res.status(400).json({ error: 'Ajans kodu veya davet kodu gerekli.' });

    try {
        // 1. Double Join prevention check
        const userCheck = await db.query('SELECT agency_id FROM users WHERE id = $1', [userId]);
        if (userCheck.rows.length > 0 && userCheck.rows[0].agency_id) {
            return res.status(400).json({ error: 'Zaten bir ajansa bağlısınız. Ajanstan ayrılmak için ajans yöneticiniz ile iletişime geçmelisiniz.' });
        }

        // 2. Find agency by ID or referral code
        const agencyRes = await db.query(
            "SELECT id, name FROM agencies WHERE (id = $1 OR UPPER(referral_code) = UPPER($1)) AND status = 'active'",
            [agencyId.trim()]
        );
        if (agencyRes.rows.length === 0) {
            return res.status(404).json({ error: 'Geçersiz veya aktif olmayan ajans kodu / davet kodu.' });
        }

        const agency = agencyRes.rows[0];

        // 3. Update user's agency
        await db.query('UPDATE users SET agency_id = $1 WHERE id = $2', [agency.id, userId]);
        
        console.log(\`[AGENCY] User \${userId} joined agency \${agency.name} using code \${agencyId}\`);
        res.json({ success: true, message: \`\${agency.name} ajansına başarıyla katıldınız!\`, agencyName: agency.name });
    } catch (err) {
        console.error('[AGENCY-JOIN] Join error:', err);
        res.status(500).json({ error: 'Ajansa katılırken bir hata oluştu.' });
    }
});`;

// Replace target, taking care of potential CRLF differences
const targetCRLF = target.replace(/\n/g, '\r\n');

if (content.includes(target)) {
    content = content.replace(target, replacement);
    console.log('Found and replaced LF target!');
} else if (content.includes(targetCRLF)) {
    content = content.replace(targetCRLF, replacement);
    console.log('Found and replaced CRLF target!');
} else {
    console.log('Could not find target in server.js! Let\'s show a substring match check.');
    // Let's do a fuzzy search of the first line
    const targetFirstLine = "    } catch (err) {";
    if (content.includes(targetFirstLine)) {
        console.log('First line exists in file!');
    }
}

fs.writeFileSync(serverPath, content, 'utf8');
console.log('Server file updated successfully!');
