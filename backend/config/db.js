/*
 * Roman Urdu comments:
 * Ye file MongoDB connection handle karti hai.
 * MONGO_URI env se database connect hota hai aur missing URI par clear error throw hota hai.
 */
const mongoose = require('mongoose');

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to backend/.env');
  }

  mongoose.set('strictQuery', true);
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

module.exports = connectDB;
