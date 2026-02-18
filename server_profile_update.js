// ... existing code ...

// UPDATE USER PROFILE (Generic)
app.put('/api/users/:id/profile', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { name, bio, job, relationship, zodiac, interests } = req.body;

    // Authorization check: User can update own profile, Admins can update any
    // Compare string IDs to be safe
    if (req.user.id.toString() !== id.toString() && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Yetkisiz işlem.' });
    }

    try {
        // Prepare interests string (assuming frontend sends array or string)
        let interestsStr = interests;
        if (Array.isArray(interests)) {
            interestsStr = JSON.stringify(interests);
        }

        const result = await db.query(
            `UPDATE users 
             SET display_name = COALESCE($1, display_name), 
                 bio = COALESCE($2, bio), 
                 job = COALESCE($3, job), 
                 relationship = COALESCE($4, relationship), 
                 zodiac = COALESCE($5, zodiac), 
                 interests = COALESCE($6, interests) 
             WHERE id = $7 
             RETURNING *`,
            [name, bio, job, relationship, zodiac, interestsStr, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        // Also update operators table bio if user is an operator
        if (req.user.role === 'operator') {
            await db.query('UPDATE operators SET bio = COALESCE($1, bio) WHERE user_id = $2', [bio, id]);
        }

        res.json({ success: true, user: sanitizeUser(result.rows[0], req) });
    } catch (err) {
        console.error('Update Profile Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ... existing code ...
