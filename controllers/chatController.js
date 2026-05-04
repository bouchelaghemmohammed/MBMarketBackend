const Message = require('../models/Message');
const User = require('../models/User');

exports.getMessages = async (req, res) => {
  try {
    const userId1 = req.user.id;
    const userId2 = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: userId1, receiverId: userId2 },
        { senderId: userId2, receiverId: userId1 }
      ]
    }).sort({ createdAt: 1 }).populate('senderId', 'username').populate('receiverId', 'username');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getContacts = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    
    // Find all messages involving the current user
    const messages = await Message.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }]
    });

    // Extract unique user IDs
    const contactIds = new Set();
    messages.forEach(msg => {
      if (msg.senderId.toString() !== currentUserId) contactIds.add(msg.senderId.toString());
      if (msg.receiverId.toString() !== currentUserId) contactIds.add(msg.receiverId.toString());
    });

    // Only return users that have actively exchanged messages
    const users = await User.find({ _id: { $in: Array.from(contactIds) } }).select('-password');
    res.json(users);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const senderId = req.user.id;
    const { receiverId, content } = req.body;

    const message = new Message({
      senderId,
      receiverId,
      content
    });

    const savedMessage = await message.save();
    await savedMessage.populate('senderId', 'username');

    // Emit real-time event targeted at the receiver
    req.io.emit(`chat:message:${receiverId}`, savedMessage);

    // Notify the receiver's navbar badge instantly
    req.io.emit(`notification:${receiverId}`, {
      type: 'chat',
      message: `New message from ${savedMessage.senderId.username}`
    });
    
    // Also emit to sender so their own UI can update instantly if they have multiple windows
    req.io.emit(`chat:message:${senderId}`, savedMessage);

    res.status(201).json(savedMessage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
