const express = require('express');
const router = express.Router();
const recorderController = require('../controllers/recorder.controller');

// POST /api/recorder/login
router.post('/login', recorderController.login);

// GET /api/recorder/pending/:roundID
router.get('/pending/:roundID', recorderController.getPendingScores);

// GET /api/recorder/verify/:participationID/:roundID
router.get('/verify/:participationID/:roundID', recorderController.getVerificationData);

// PUT /api/recorder/arrowStaging/:arrowStagingID
router.put('/arrowStaging/:arrowStagingID', recorderController.updateArrowStaging);

// POST /api/recorder/confirm
router.post('/confirm', recorderController.confirmScores);

// DELETE /api/recorder/reject
router.delete('/reject', recorderController.rejectScores);

module.exports = router;