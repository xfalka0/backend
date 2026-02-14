const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { authenticateToken } = require('../middleware/auth');

// Public/Shared Social Routes
router.get('/social/explore', socialController.getExplore);
router.post('/social/post/:id/like', authenticateToken, socialController.toggleLike);
router.post('/social/story/like/:id', authenticateToken, socialController.toggleStoryLike);
router.get('/social/post/:id/comments', socialController.getPostComments); // Public Read
router.post('/social/post/:id/comments', authenticateToken, socialController.addPostComment);

// User Protected Routes
router.post('/social/post', authenticateToken, socialController.userCreatePost);
router.post('/social/story', authenticateToken, socialController.userCreateStory);

// Admin Routes
const { authorizeRole } = require('../middleware/auth');
router.post('/admin/social/post', authenticateToken, authorizeRole('admin', 'super_admin'), socialController.adminCreatePost);
router.post('/admin/social/story', authenticateToken, authorizeRole('admin', 'super_admin'), socialController.adminCreateStory);
router.delete('/admin/social/:type/:id', authenticateToken, authorizeRole('admin', 'super_admin'), socialController.deleteSocialContent);

module.exports = router;
