const express = require("express");
const router = express.Router();
const commonController = require("../controllers/common.controller");
const rankingController = require("../controllers/ranking.controller");
const rangeController = require("../controllers/range.controller");

// GET /api/competitions
router.get("/competitions", commonController.getCompetitions);

// GET /api/competition/:competitionID
router.get("/competition/:competitionID", commonController.getCompetitionById);

// GET /api/competition/:competitionID/rounds
router.get(
  "/competition/:competitionID/rounds",
  commonController.getRoundsByCompetition
);

// GET /api/competition/:competitionID/round/:roundID/ranking
router.get(
  "/competition/:competitionID/round/:roundID/ranking",
  rankingController.getRoundRanking
);

// GET /api/round/:roundID
router.get("/round/:roundID", commonController.getRoundById);

// GET /api/round/:roundID/ranges
router.get("/round/:roundID/ranges", rangeController.getRangesByRound);

module.exports = router;
