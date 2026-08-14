import dns from "node:dns";
import mongoose from "mongoose";

// Windows often refuses Atlas SRV lookups on the default DNS
dns.setServers(["8.8.8.8", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI is missing in server/.env");
    }

    mongoose.connection.on("connected", () => {
      console.log("Database connected");
    });

    await mongoose.connect(uri, { family: 4 });
  } catch (error) {
    console.error("Database connection failed:", error.message);
  }
};

export default connectDB;
