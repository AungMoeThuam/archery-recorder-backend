const db = require('../config/database');

// Recorder Login
exports.login = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const [rows] = await db.query(
      'SELECT recorderID, firstName, lastName, email FROM recorder WHERE firstName = ? AND lastName = ? AND email = ? AND password = ?',
      [firstName, lastName, email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Recorder login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get pending scores for a round
exports.getPendingScores = async (req, res) => {
  try {
    const { roundID } = req.params;

    const query = `
      SELECT 
        p.participationID,
        a.archerID,
        a.archerFirstName,
        a.archerLastName,
        a.archerGender,
        a.archerNationality,
        COUNT(DISTINCT ast.endOrder) as endsCompleted,
        12 as totalEnds,
        CASE 
          WHEN COUNT(DISTINCT ast.endOrder) = 12 THEN 'complete'
          ELSE 'in_progress'
        END as status,
        GROUP_CONCAT(DISTINCT cat.equipment ORDER BY cat.equipment) as category
      FROM participation p
      JOIN archer a ON p.archerID = a.archerID
      LEFT JOIN arrowStaging ast ON p.participationID = ast.participationID AND ast.roundID = ? AND ast.stagingStatus = 'pending'
      LEFT JOIN participationCategory pc ON p.participationID = pc.participationID
      LEFT JOIN category cat ON pc.categoryID = cat.categoryID
      WHERE p.competitionID = (SELECT competitionID FROM round WHERE roundID = ?)
      GROUP BY p.participationID
      HAVING endsCompleted > 0
      ORDER BY status DESC, a.archerLastName
    `;

    const [rows] = await db.query(query, [roundID, roundID]);
    res.json(rows);
  } catch (error) {
    console.error('Get pending scores error:', error);
    res.status(500).json({ error: 'Failed to fetch pending scores' });
  }
};

// Get score verification data
exports.getVerificationData = async (req, res) => {
  try {
    const { participationID, roundID } = req.params;

    // Get archer details
    const [archerData] = await db.query(
      `SELECT 
        a.archerID,
        a.archerFirstName,
        a.archerLastName,
        a.archerGender,
        a.archerDateOfBirth,
        a.archerEmail,
        a.archerNationality
      FROM participation p
      JOIN archer a ON p.archerID = a.archerID
      WHERE p.participationID = ?`,
      [participationID]
    );

    if (archerData.length === 0) {
      return res.status(404).json({ error: 'Archer not found' });
    }

    // Get round details
    const [roundData] = await db.query(
      `SELECT 
        r.roundID,
        r.roundType,
        r.date,
        r.competitionID,
        rng.distance,
        rng.targetSize
      FROM round r
      LEFT JOIN range rng ON r.roundType = rng.roundType
      WHERE r.roundID = ?
      LIMIT 1`,
      [roundID]
    );

    if (roundData.length === 0) {
      return res.status(404).json({ error: 'Round not found' });
    }

    // Get all arrows for this participation and round
    const [arrows] = await db.query(
      `SELECT 
        arrowStagingID,
        roundID,
        participationID,
        distance,
        endOrder,
        arrowScore,
        stagingStatus,
        isX
      FROM arrowStaging
      WHERE participationID = ? AND roundID = ?
      ORDER BY endOrder, arrowStagingID`,
      [participationID, roundID]
    );

    res.json({
      archer: archerData[0],
      round: roundData[0],
      arrows: arrows
    });
  } catch (error) {
    console.error('Get verification data error:', error);
    res.status(500).json({ error: 'Failed to fetch verification data' });
  }
};

// Update arrow staging
exports.updateArrowStaging = async (req, res) => {
  try {
    const { arrowStagingID } = req.params;
    const { stagingStatus, recorderID, arrowScore } = req.body;

    await db.query(
      `UPDATE arrowStaging 
       SET stagingStatus = ?, recorderID = ?, arrowScore = ?
       WHERE arrowStagingID = ?`,
      [stagingStatus, recorderID, arrowScore, arrowStagingID]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Update arrow staging error:', error);
    res.status(500).json({ error: 'Failed to update arrow staging' });
  }
};

// Confirm all scores
exports.confirmScores = async (req, res) => {
  try {
    const { participationID, roundID, totalScore, totalX, totalTen, recorderID } = req.body;

    // Update all arrow staging records to confirmed
    await db.query(
      `UPDATE arrowStaging 
       SET stagingStatus = 'confirmed', recorderID = ?
       WHERE participationID = ? AND roundID = ?`,
      [recorderID, participationID, roundID]
    );

    // Check if roundScore already exists
    const [existing] = await db.query(
      'SELECT roundScoreID FROM roundScore WHERE participationID = ? AND roundID = ?',
      [participationID, roundID]
    );

    if (existing.length > 0) {
      // Update existing
      await db.query(
        `UPDATE roundScore 
         SET totalScore = ?, totalX = ?, totalTen = ?, dateRecorded = NOW()
         WHERE roundScoreID = ?`,
        [totalScore, totalX, totalTen, existing[0].roundScoreID]
      );
      res.json({ success: true, roundScoreID: existing[0].roundScoreID });
    } else {
      // Insert new
      const [result] = await db.query(
        `INSERT INTO roundScore (participationID, roundID, totalScore, totalX, totalTen, dateRecorded)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [participationID, roundID, totalScore, totalX, totalTen]
      );
      res.json({ success: true, roundScoreID: result.insertId });
    }
  } catch (error) {
    console.error('Confirm scores error:', error);
    res.status(500).json({ error: 'Failed to confirm scores' });
  }
};

// Reject scores
exports.rejectScores = async (req, res) => {
  try {
    const { participationID, roundID } = req.body;

    await db.query(
      'DELETE FROM arrowStaging WHERE participationID = ? AND roundID = ?',
      [participationID, roundID]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Reject scores error:', error);
    res.status(500).json({ error: 'Failed to reject scores' });
  }
};