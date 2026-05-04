const express = require('express');
const router = express.Router();
const { getMessages, getContacts, sendMessage } = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

router.get('/contacts', protect, getContacts);
router.get('/:userId', protect, getMessages);
router.post('/', protect, sendMessage);

module.exports = router;
