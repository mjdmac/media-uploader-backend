import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;

// --- Cloudinary Config ---
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

// --- CORS configuration  ---
const allowedOrigins = [
  "https://jmandmj.vercel.app",
  "https://media-uploader-backend.vercel.app",
  "http://localhost:3001",
  "http://localhost:5173", // Vite dev port
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}`);
        return callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    optionsSuccessStatus: 200, // Support legacy browsers
  })
);

// --- Other Middleware ---
app.use(express.json());
const storage = multer.memoryStorage();
const upload = multer({ storage });

// --- Health check endpoint ---
app.get("/", (req, res) => {
  res.json({ message: "Media uploader backend is running!" });
});

// --- Routes ---

// Upload endpoint with Cloudinary integration
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: "auto", // Automatically detect file type (image/video)
      folder: "wedding-memories", // Organize files in a folder
      use_filename: true,
      unique_filename: false,
      public_id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    });

    res.json({
      message: "Upload successful",
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete file endpoint with Cloudinary integration
app.delete("/files/:cloudinaryId(*)", async (req, res) => {
  try {
    const cloudinaryId = req.params.cloudinaryId;

    // Get resource info to determine resource_type
    const resource = await cloudinary.api.resource(cloudinaryId);
    const resourceType = resource.resource_type; // "image", "video", etc.

    // Delete from Cloudinary with correct resource_type
    await cloudinary.uploader.destroy(cloudinaryId, { resource_type: resourceType });

    res.json({ message: "File deleted successfully from Cloudinary" });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      error: "Failed to delete file from Cloudinary",
      details: error.message,
    });
  }
});

// List files from Cloudinary
app.get("/files", async (req, res) => {
  try {
    const { max_results = 10 } = req.query;

    // Get images
    const images = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image",
      prefix: "wedding-memories/",
      max_results,
    });

    // Get videos
    const videos = await cloudinary.api.resources({
      type: "upload",
      resource_type: "video",
      prefix: "wedding-memories/",
      max_results,
    });

    const resources = [...images.resources, ...videos.resources];

    const files = resources.map(file => ({
      url: file.secure_url,
      public_id: file.public_id,
      format: file.format,
      resource_type: file.resource_type, // "image" or "video"
      size: file.bytes,
      mimetype: file.mimetype,
      width: file.width,
      height: file.height,
      originalName: file.display_name,
      created_at: file.created_at,
    }));

    const totalFiles = files.length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);

    res.json({
      files,
      totalFiles,
      totalSize,
    });
  } catch (err) {
    console.error("List Error:", err);
    res.status(500).json({ error: err.message });
  }
});


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
