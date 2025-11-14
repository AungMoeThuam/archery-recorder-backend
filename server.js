const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

// Import routes
const archerRoutes = require("./routes/archer.routes");
const recorderRoutes = require("./routes/recorder.routes");
const commonRoutes = require("./routes/common.routes");

const app = express();
const PORT = process.env.PORT || 4000;

console.log("env port - " + process.env.PORT);

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.use("/api/archer", archerRoutes);
app.use("/api/recorder", recorderRoutes);
app.use("/api", commonRoutes);

// Health check
app.get("/", (req, res) => {
  console.log(req.url);
  res.json({
    message: "🏹 Archery Scoring System API",
    status: "Running",
    version: "1.0.0",
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Something went wrong!",
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});
