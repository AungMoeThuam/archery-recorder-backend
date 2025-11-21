const express = require("express");
const router = express.Router();
const archerController = require("../controllers/archer.controller");

// POST /api/archer/login
router.post("/login", archerController.login);

// GET /api/archer/:archerID/competitions
router.get("/:archerID/competitions", archerController.getCompetitions);

// GET /api/archer/scores/:participationID
router.get("/scores/:participationID", archerController.getScoreDetails);

// GET /api/participation
router.get("/participation", archerController.getParticipation);

// GET /api/archer/round/eligibility
router.get("/round/eligibility", archerController.checkRoundEligibility);

// GET /api/archer/round/submitted-scores
router.get("/round/submitted-scores", archerController.getSubmittedScores);

// POST /api/archer/round/endscore-staging
router.post("/round/endscore-staging", archerController.recordEndArrows);

module.exports = router;
