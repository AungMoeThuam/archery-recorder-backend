const express = require('express');
const router = express.Router();
const archerController = require('../controllers/archer.controller');

// POST /api/archer/login
router.post('/login', archerController.login);

// GET /api/archer/:archerID/competitions
router.get('/:archerID/competitions', archerController.getCompetitions);

// GET /api/archer/scores/:participationID
router.get('/scores/:participationID', archerController.getScoreDetails);

// GET /api/participation
router.get('/participation', archerController.getParticipation);

module.exports = router;