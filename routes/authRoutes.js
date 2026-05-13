const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

router.post('/google', authController.googleAuth);
router.post('/register-email', authController.registerEmail);
router.post('/login-email', authController.loginEmail);
router.get('/me', authenticateToken, authController.getMe);

// Legacy Registration Proxy
router.post('/register', authController.registerEmail);

// Legacy Login Proxy
router.post('/login', authController.loginEmail);

module.exports = router;
