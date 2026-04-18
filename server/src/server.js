import "dotenv/config";
import cors from "cors";
import express from "express";
import morgan from "morgan";
import { connectDB, isMongoReady } from "./config/db.js";
import authRoutes from "./routes/auth.js";
import cafeRoutes from "./routes/cafes.js";
import placeRoutes from "./routes/places.js";

const app = express();
const port = process.env.PORT || 5000;
const configuredOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim())
  : [];

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  ...configuredOrigins
]);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    console.error("❌ CORS blocked:", origin);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    mongo: isMongoReady() ? "connected" : "offline",
    name: "Cafelio API"
  });
});
app.use("/api/auth", authRoutes);
app.use("/api/cafes", cafeRoutes);
app.use("/api/places", placeRoutes);
app.use((req, res) => {
  res.status(404).json({
    message: `No route for ${req.method} ${req.originalUrl}`
  });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;

  console.error("🔥 Server Error:", error.message);

  res.status(status).json({
    message: status === 500 ? "Something went wrong." : error.message
  });
});

const startServer = async () => {
  try {
    await connectDB();
    console.log("✅ MongoDB connected");

    app.listen(port, () => {
      console.log(`🚀 Cafelio API running on port ${port}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
