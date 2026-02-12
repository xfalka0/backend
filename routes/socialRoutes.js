const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { authenticateToken } = require('../middleware/auth');

// Public/Shared Social Routes
router.get('/social/explore', socialController.getExplore);
router.post('/social/post/:id/like', socialController.toggleLike);
router.post('/social/story/like/:id', socialController.toggleStoryLike);
router.get('/social/post/:id/comments', socialController.getPostComments);
router.post('/social/post/:id/comments', socialController.addPostComment);

// User Protected Routes
router.post('/social/post', authenticateToken, socialController.userCreatePost);
router.post('/social/story', authenticateToken, socialController.userCreateStory);

// Admin Routes
router.post('/admin/social/post', socialController.adminCreatePost);
router.post('/admin/social/story', socialController.adminCreateStory);
router.delete('/admin/social/:type/:id', socialController.deleteSocialContent);

module.exports = router;
