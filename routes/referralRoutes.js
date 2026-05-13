const express = require('express');
const router = express.Router();
const db = require('../db');

// 1. CLICK ENDPOINT: This is the link the influencer shares
// Example: https://your-backend.com/api/r/ADMIN947
router.get('/r/:code', async (req, res) => {
    const { code } = req.params;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
        // Log the click
        await db.query(
            'INSERT INTO referral_clicks (code, ip, user_agent) VALUES ($1, $2, $3)',
            [code.toUpperCase(), ip, userAgent]
        );

        // Redirect to App Store / Play Store (Official Fiva URL)
        const androidUrl = 'https://play.google.com/store/apps/details?id=com.fivachat.app'; 
        const iosUrl = 'https://apps.apple.com/app/fiva-dating';
        
        const isIos = /iPhone|iPad|iPod/i.test(userAgent);
        res.redirect(isIos ? iosUrl : androidUrl);
    } catch (err) {
        console.error('Referral click error:', err);
        res.status(500).send('Internal Server Error');
    }
});

// 2. MATCH ENDPOINT: The app calls this on first launch to see if there's a match
router.post('/match', async (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    try {
        // Find a click from the same IP + User Agent in the last 2 hours
        const result = await db.query(
            `SELECT code FROM referral_clicks 
             WHERE ip = $1 AND user_agent = $2 AND created_at > NOW() - INTERVAL '2 hours'
             ORDER BY created_at DESC LIMIT 1`,
            [ip, userAgent]
        );

        if (result.rows.length > 0) {
            res.json({ match: true, code: result.rows[0].code });
        } else {
            res.json({ match: false });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
