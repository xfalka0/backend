const express = require('express');
const router = express.Router();
const db = require('../db');

// Handle Web Account Deletion Requests (Google Play Data Safety Requirement)
router.post('/account-deletion-requests', async (req, res) => {
    const { identifier, reason, details } = req.body;

    if (!identifier || typeof identifier !== 'string' || identifier.trim() === '') {
        return res.status(400).json({ error: 'Kayıtlı e-posta veya telefon numarası zorunludur.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const requestId = 'DEL-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

    try {
        // Try finding user by email or phone
        const userRes = await db.query(
            'SELECT id, email, phone FROM users WHERE LOWER(email) = $1 OR phone = $1',
            [cleanIdentifier]
        );

        const matchedUserId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

        console.log(`[DELETION REQUEST] Received web deletion request ${requestId} for "${cleanIdentifier}" (Matched User: ${matchedUserId || 'none'})`);

        // If matched user found, mark account as deletion_requested or soft-delete
        if (matchedUserId) {
            await db.query(
                `UPDATE users 
                 SET admin_notes = COALESCE(admin_notes, '') || E'\\n[WEB DELETION REQUEST: ' || NOW() || ' - ' || $1 || E']'
                 WHERE id = $2`,
                [reason || 'User requested via web form', matchedUserId]
            );
        }

        res.json({
            success: true,
            requestId: requestId,
            message: 'Hesap silme talebiniz başarıyla alındı.'
        });
    } catch (err) {
        console.error('[DELETION REQUEST ERROR]', err);
        res.status(500).json({ error: 'Sunucu hatası. Lütfen daha sonra tekrar deneyiniz.' });
    }
});

module.exports = router;
