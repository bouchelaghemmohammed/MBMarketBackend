const mongoose = require('mongoose');

const ConnectDB = () => {
    mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB via config/db.js'))
    .catch((err) => console.error('MongoDB connection error:', err));
};

module.exports = ConnectDB;
