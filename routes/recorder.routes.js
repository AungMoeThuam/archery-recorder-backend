const express = require("express");
const router = express.Router();
const recorderController = require("../controllers/recorder.controller");

// POST /api/recorder/login
router.post("/login", recorderController.login);

// GET /api/recorder/ends/pending
router.get("/ends/pending", recorderController.getPendingEndScores);

// PUT /api/round/update
router.put("/round/update", recorderController.updateRoundScore);

module.exports = router;
