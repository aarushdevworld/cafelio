import mongoose from "mongoose";

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.log("MongoDB skipped: MONGO_URI is not set.");
    return false;
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected.");
    return true;
  } catch (error) {
    console.warn(`MongoDB unavailable: ${error.message}`);
    return false;
  }
};

export const isMongoReady = () => mongoose.connection.readyState === 1;
