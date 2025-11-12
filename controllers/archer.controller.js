const db = require('../config/database');

// Archer Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      'SELECT archerID, archerFirstName, archerLastName, archerEmail FROM archer WHERE archerEmail = ? AND archerPassword = ?',
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get Archer's Competitions
exports.getCompetitions = async (req, res) => {
  try {
    const { archerID } = req.params;

    const query = `
      SELECT 
        p.participationID,
        p.archerID,
        p.competitionID,
        c.title as competitionTitle,
        c.location as competitionLocation,
        c.startDate as competitionStartDate,
        c.endDate as competitionEndDate,
        CASE
          WHEN COUNT(DISTINCT ast.endOrder) > 0 AND ast.stagingStatus = 'confirmed' THEN 'confirmed'
          WHEN COUNT(DISTINCT ast.endOrder) > 0 AND ast.stagingStatus = 'pending' THEN 'pending'
          ELSE 'not_started'
        END as status
      FROM participation p
      JOIN competition c ON p.competitionID = c.competitionID
      LEFT JOIN arrowStaging ast ON p.participationID = ast.participationID
      WHERE p.archerID = ?
      GROUP BY p.participationID, c.competitionID
      ORDER BY c.startDate DESC
    `;

    const [competitions] = await db.query(query, [archerID]);

    // Get rounds for each competition
    for (let comp of competitions) {
      const [rounds] = await db.query(
        `SELECT 
          r.roundID,
          r.roundType,
          r.date,
          rs.totalScore,
          rs.totalX,
          rs.totalTen
        FROM round r
        LEFT JOIN roundScore rs ON r.roundID = rs.roundID AND rs.participationID = ?
        WHERE r.competitionID = ?
        ORDER BY r.date`,
        [comp.participationID, comp.competitionID]
      );
      comp.rounds = rounds;
    }

    res.json(competitions);
  } catch (error) {
    console.error('Get competitions error:', error);
    res.status(500).json({ error: 'Failed to fetch competitions' });
  }
};

// Get Archer's Score Details
exports.getScoreDetails = async (req, res) => {
  try {
    const { participationID } = req.params;

    // Get competition details
    const [compData] = await db.query(
      `SELECT 
        c.competitionID,
        c.title,
        c.location,
        c.startDate,
        c.endDate
      FROM participation p
      JOIN competition c ON p.competitionID = c.competitionID
      WHERE p.participationID = ?`,
      [participationID]
    );

    if (compData.length === 0) {
      return res.status(404).json({ error: 'Participation not found' });
    }

    // Get round scores
    const [roundScores] = await db.query(
      `SELECT 
        rs.roundScoreID,
        rs.roundID,
        rs.totalScore,
        rs.totalX,
        rs.totalTen,
        rs.dateRecorded,
        r.roundType,
        r.date,
        ast.stagingStatus,
        rec.firstName as recorderName
      FROM roundScore rs
      JOIN round r ON rs.roundID = r.roundID
      LEFT JOIN arrowStaging ast ON rs.roundID = ast.roundID AND rs.participationID = ast.participationID
      LEFT JOIN recorder rec ON ast.recorderID = rec.recorderID
      WHERE rs.participationID = ?
      GROUP BY rs.roundScoreID
      ORDER BY r.date`,
      [participationID]
    );

    res.json({
      competition: compData[0],
      roundScores: roundScores
    });
  } catch (error) {
    console.error('Get score details error:', error);
    res.status(500).json({ error: 'Failed to fetch score details' });
  }
};

// Get participation ID
exports.getParticipation = async (req, res) => {
  try {
    const { archerID, competitionID } = req.query;

    const [rows] = await db.query(
      'SELECT participationID FROM participation WHERE archerID = ? AND competitionID = ?',
      [archerID, competitionID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Participation not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get participation error:', error);
    res.status(500).json({ error: 'Failed to fetch participation' });
  }
};