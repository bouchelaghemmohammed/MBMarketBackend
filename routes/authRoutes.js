const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, getUserById } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/user/:id', protect, getUserById);

module.exports = router;
