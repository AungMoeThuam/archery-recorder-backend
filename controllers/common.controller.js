const db = require('../config/database');

// Get all competitions
exports.getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        competitionID,
        title,
        location,
        startDate,
        endDate,
        championshipID
      FROM competition
      ORDER BY startDate DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
};

// Get competition by ID
exports.getCompetitionById = async (req, res) => {
  try {
    const { competitionID } = req.params;

    const [rows] = await db.query(
      `SELECT 
        competitionID,
        title,
        location,
        startDate,
        endDate,
        championshipID
      FROM competition
      WHERE competitionID = ?`,
      [competitionID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Competition not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get competition error:', error);
    res.status(500).json({ error: 'Failed to fetch competition' });
  }
};

// Get rounds for a competition
exports.getRoundsByCompetition = async (req, res) => {
  try {
    const { competitionID } = req.params;

    const [rows] = await db.query(
      `SELECT 
        roundID,
        competitionID,
        roundType,
        date
      FROM round
      WHERE competitionID = ?
      ORDER BY date`,
      [competitionID]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get rounds error:', error);
    res.status(500).json({ error: 'Failed to fetch rounds' });
  }
};

// Get round by ID
exports.getRoundById = async (req, res) => {
  try {
    const { roundID } = req.params;

    const [rows] = await db.query(
      `SELECT 
        r.roundID,
        r.competitionID,
        r.roundType,
        r.date,
        rng.distance,
        rng.targetSize
      FROM round r
      LEFT JOIN range rng ON r.roundType = rng.roundType
      WHERE r.roundID = ?
      LIMIT 1`,
      [roundID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get round error:', error);
    res.status(500).json({ error: 'Failed to fetch round' });
  }
};

// Create arrow staging entry
exports.createArrowStaging = async (req, res) => {
  try {
    const {
      roundID,
      participationID,
      recorderID,
      distance,
      endOrder,
      arrowScore,
      stagingStatus,
      isX
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO arrowStaging 
       (roundID, participationID, recorderID, distance, endOrder, arrowScore, stagingStatus, isX, date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [roundID, participationID, recorderID, distance, endOrder, arrowScore, stagingStatus, isX]
    );

    res.json({ success: true, arrowStagingID: result.insertId });
  } catch (error) {
    console.error('Create arrow staging error:', error);
    res.status(500).json({ error: 'Failed to create arrow staging' });
  }
};

// Get arrow staging entries
exports.getArrowStaging = async (req, res) => {
  try {
    const { participationID, roundID } = req.query;

    const [rows] = await db.query(
      `SELECT 
        arrowStagingID,
        roundID,
        participationID,
        recorderID,
        distance,
        endOrder,
        arrowScore,
        stagingStatus,
        isX,
        date
      FROM arrowStaging
      WHERE participationID = ? AND roundID = ?
      ORDER BY endOrder, arrowStagingID`,
      [participationID, roundID]
    );

    res.json(rows);
  } catch (error) {
    console.error('Get arrow staging error:', error);
    res.status(500).json({ error: 'Failed to fetch arrow staging' });
  }
};

// Create/Update round score
exports.saveRoundScore = async (req, res) => {
  try {
    const {
      participationID,
      roundID,
      totalScore,
      totalX,
      totalTen
    } = req.body;

    // Check if exists
    const [existing] = await db.query(
      'SELECT roundScoreID FROM roundScore WHERE participationID = ? AND roundID = ?',
      [participationID, roundID]
    );

    if (existing.length > 0) {
      // Update
      await db.query(
        `UPDATE roundScore 
         SET totalScore = ?, totalX = ?, totalTen = ?, dateRecorded = NOW()
         WHERE roundScoreID = ?`,
        [totalScore, totalX, totalTen, existing[0].roundScoreID]
      );
      res.json({ success: true, roundScoreID: existing[0].roundScoreID });
    } else {
      // Insert
      const [result] = await db.query(
        `INSERT INTO roundScore (participationID, roundID, totalScore, totalX, totalTen, dateRecorded)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [participationID, roundID, totalScore, totalX, totalTen]
      );
      res.json({ success: true, roundScoreID: result.insertId });
    }
  } catch (error) {
    console.error('Save round score error:', error);
    res.status(500).json({ error: 'Failed to save round score' });
  }
};