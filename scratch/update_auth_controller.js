const fs = require('fs');
let code = fs.readFileSync('backend/controllers/authController.js', 'utf8');

if (!code.includes('validateAge')) {
    code = "const { validateAge } = require('../utils/validation');\n" + code;
    code = code.replace(
        "let { email, phone, password, username, displayName, display_name, gender, country, avatarUrl, avatar_url, bio, deviceId } = req.body;",
        `let { email, phone, password, username, displayName, display_name, gender, country, avatarUrl, avatar_url, bio, deviceId, age } = req.body;

    if (age !== undefined && age !== null && age !== '') {
        const ageCheck = validateAge(age);
        if (!ageCheck.valid) return res.status(400).json({ error: ageCheck.error });
    }`
    );
    fs.writeFileSync('backend/controllers/authController.js', code, 'utf8');
    console.log('Successfully added validateAge to authController.js');
} else {
    console.log('validateAge already in authController.js');
}

