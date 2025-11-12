const express = require('express');
const router = express.Router();
const commonController = require('../controllers/common.controller');

// GET /api/competitions
router.get('/competitions', commonController.getCompetitions);

// GET /api/competition/:competitionID
router.get('/competition/:competitionID', commonController.getCompetitionById);

// GET /api/competition/:competitionID/rounds
router.get('/competition/:competitionID/rounds', commonController.getRoundsByCompetition);

// GET /api/round/:roundID
router.get('/round/:roundID', commonController.getRoundById);

// POST /api/arrowStaging
router.post('/arrowStaging', commonController.createArrowStaging);

// GET /api/arrowStaging
router.get('/arrowStaging', commonController.getArrowStaging);

// POST /api/roundScore
router.post('/roundScore', commonController.saveRoundScore);

module.exports = router;