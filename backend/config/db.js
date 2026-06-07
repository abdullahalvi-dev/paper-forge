/*
 * Roman Urdu comments:
 * Ye file MongoDB connection handle karti hai.
 * MONGO_URI env se database connect hota hai aur missing URI par clear error throw hota hai.
 */
const mongoose = require('mongoose');

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

let connectionPromise;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is missing. Add it to backend/.env');
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 15000),
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10)
    })
    .then((connection) => {
      console.log('MongoDB connected');
      return connection.connection;
    })
    .catch((error) => {
      connectionPromise = undefined;
      throw error;
    });

  return connectionPromise;
};

module.exports = connectDB;
