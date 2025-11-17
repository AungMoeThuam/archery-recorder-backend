const db = require("../config/database");

// Recorder Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT recorderID, recorderFirstName, recorderLastName, recorderEmail FROM recorder WHERE recorderEmail = ? AND recorderPassword = ?",
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Recorder login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
};

// Get pending scores for a round
exports.getPendingEndScores = async (req, res) => {
  // Assuming roundID is passed as a URL parameter, as in the previous context
  try {
    // const { roundID } = req.params;

    // if (!roundID) {
    //   return res.status(400).json({ error: "Missing roundID parameter." });
    // }

    const query = `
      SELECT
        roundID,
        endOrder,
        distance,
        participationID,
        -- Group all arrowScores for a single end into a comma-separated string, ordered by their recording time or arrow ID
        GROUP_CONCAT(arrowScore ORDER BY arrowStagingID ASC) AS arrows_string
      FROM arrowStaging
      WHERE 
      stagingStatus = 'pending' -- Only fetch scores waiting for approval
      GROUP BY 
        roundID, 
        endOrder, 
        distance, 
        participationID
      ORDER BY 
        participationID, 
        endOrder;
    `;

    // Execute the query
    const [rows] = await db.query(query);

    // Post-process the result to convert the comma-separated string into the desired array format
    const formattedScores = rows.map((row) => {
      // Split the string into an array and process each score element
      const arrowsArray = row.arrows_string
        ? row.arrows_string.split(",").map((score) => {
            const trimmedScore = score.trim();
            const numericScore = parseInt(trimmedScore, 10);

            // If the score is a valid number (e.g., '10', '5'), return it as a Number.
            // Otherwise, return it as a String (e.g., 'X', 'M').
            return isNaN(numericScore) ? trimmedScore : numericScore;
          })
        : [];

      return {
        roundID: row.roundID,
        endOrder: row.endOrder,
        distance: row.distance,
        participationID: row.participationID,
        arrows: arrowsArray,
        stagingStatus: "pending",
      };
    });

    res.json(formattedScores);
  } catch (error) {
    console.error("Get pending scores error:", error);
    res.status(500).json({ error: "Failed to fetch pending scores" });
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
      return res.status(404).json({ error: "Archer not found" });
    }

    // Get round details
    const [roundData] = await db.query(
      `SELECT 
        r.roundID,
        r.roundType,
        r.roundDate,
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
      return res.status(404).json({ error: "Round not found" });
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
      arrows: arrows,
    });
  } catch (error) {
    console.error("Get verification data error:", error);
    res.status(500).json({ error: "Failed to fetch verification data" });
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
    console.error("Update arrow staging error:", error);
    res.status(500).json({ error: "Failed to update arrow staging" });
  }
};

// Confirm all scores
exports.confirmEndScores = async (req, res) => {
  try {
    const {
      participationID,
      roundID,
      totalScore,
      totalX,
      totalTen,
      recorderID,
    } = req.body;

    // Update all arrow staging records to confirmed
    await db.query(
      `UPDATE arrowStaging 
       SET stagingStatus = 'confirmed', recorderID = ?
       WHERE participationID = ? AND roundID = ?`,
      [recorderID, participationID, roundID]
    );

    // Check if roundScore already exists
    const [existing] = await db.query(
      "SELECT roundScoreID FROM roundScore WHERE participationID = ? AND roundID = ?",
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
    console.error("Confirm scores error:", error);
    res.status(500).json({ error: "Failed to confirm scores" });
  }
};

// Reject scores
exports.rejectScores = async (req, res) => {
  try {
    const { participationID, roundID } = req.body;

    await db.query(
      "DELETE FROM arrowStaging WHERE participationID = ? AND roundID = ?",
      [participationID, roundID]
    );

    res.json({ success: true });
  } catch (error) {
    console.error("Reject scores error:", error);
    res.status(500).json({ error: "Failed to reject scores" });
  }
};
