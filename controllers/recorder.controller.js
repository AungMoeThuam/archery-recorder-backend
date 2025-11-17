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
  try {
    const query = `
      SELECT
        arrowStagingID,
        roundID,
        endOrder,
        distance,
        participationID,
        arrowScore,
        isX
      FROM arrowStaging
      WHERE
        stagingStatus = 'pending'
      ORDER BY
        participationID,
        endOrder,
        arrowStagingID;
    `;

    // Execute the query
    const [rows] = await db.query(query);

    // Group arrows by roundID, participationID, endOrder, distance
    const groupedScores = {};

    rows.forEach((row) => {
      const key = `${row.roundID}-${row.participationID}-${row.endOrder}-${row.distance}`;

      if (!groupedScores[key]) {
        groupedScores[key] = {
          roundID: row.roundID,
          endOrder: row.endOrder,
          distance: row.distance,
          participationID: row.participationID,
          arrows: [],
          stagingStatus: "pending",
        };
      }

      // Convert score: isX=1 -> "X", score=0 -> "M", otherwise numeric
      let displayScore;
      if (row.isX === 1) {
        displayScore = "X";
      } else if (row.arrowScore === 0) {
        displayScore = "M";
      } else {
        displayScore = row.arrowScore;
      }

      groupedScores[key].arrows.push({
        arrowStagingID: row.arrowStagingID,
        arrowScore: displayScore,
      });
    });

    // Convert grouped object to array
    const formattedScores = Object.values(groupedScores);

    res.json(formattedScores);
  } catch (error) {
    console.error("Get pending scores error:", error);
    res.status(500).json({ error: "Failed to fetch pending scores" });
  }
};

// Update arrow staging and roundScore
exports.updateRoundScore = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      roundID,
      participationID,
      distance,
      endOrder,
      arrows,
      stagingStatus,
    } = req.body;

    // Validate required fields
    if (
      !roundID ||
      !participationID ||
      !distance ||
      !endOrder ||
      !stagingStatus ||
      !Array.isArray(arrows)
    ) {
      return res.status(400).json({
        error:
          "roundID, participationID, distance, endOrder, arrows, and stagingStatus are required",
      });
    }

    // Start transaction
    await connection.beginTransaction();

    // Step 1: Update each arrow individually
    for (const arrow of arrows) {
      if (!arrow.arrowStagingID) {
        await connection.rollback();
        return res.status(400).json({
          error: "Each arrow must have an arrowStagingID",
        });
      }

      // Convert arrow score to database format
      let arrowScore;
      let isX;

      if (arrow.arrowScore === "X") {
        arrowScore = 10;
        isX = 1;
      } else if (arrow.arrowScore === "M") {
        arrowScore = 0;
        isX = 0;
      } else {
        arrowScore = parseInt(arrow.arrowScore);
        isX = 0;
      }

      // Update the arrow
      await connection.query(
        `UPDATE arrowStaging
         SET arrowScore = ?, isX = ?, stagingStatus = ?
         WHERE arrowStagingID = ?`,
        [arrowScore, isX, stagingStatus, arrow.arrowStagingID]
      );
    }

    // Step 2: Calculate totals from ALL confirmed arrows for this roundID + participationID
    const [totals] = await connection.query(
      `SELECT
        COALESCE(SUM(arrowScore), 0) as totalScore,
        COALESCE(SUM(CASE WHEN isX = 1 THEN 1 ELSE 0 END), 0) as totalX,
        COALESCE(SUM(CASE WHEN arrowScore = 10 THEN 1 ELSE 0 END), 0) as totalTen
       FROM arrowStaging
       WHERE roundID = ? AND participationID = ? AND stagingStatus = 'confirmed'`,
      [roundID, participationID]
    );

    const { totalScore, totalX, totalTen } = totals[0];

    // Step 3: Check if roundScore exists
    const [existing] = await connection.query(
      `SELECT roundScoreID FROM roundScore WHERE participationID = ? AND roundID = ?`,
      [participationID, roundID]
    );

    let roundScoreID;
    if (existing.length > 0) {
      // Update existing roundScore
      await connection.query(
        `UPDATE roundScore
         SET totalScore = ?, totalX = ?, totalTen = ?, dateRecorded = NOW()
         WHERE roundScoreID = ?`,
        [totalScore, totalX, totalTen, existing[0].roundScoreID]
      );
      roundScoreID = existing[0].roundScoreID;
    } else {
      // Insert new roundScore
      const [result] = await connection.query(
        `INSERT INTO roundScore (participationID, roundID, totalScore, totalX, totalTen, dateRecorded)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [participationID, roundID, totalScore, totalX, totalTen]
      );
      roundScoreID = result.insertId;
    }

    // Commit transaction
    await connection.commit();

    res.json({
      success: true,
      roundScoreID,
      totalScore,
      totalX,
      totalTen,
    });
  } catch (error) {
    // Rollback transaction on error
    await connection.rollback();
    console.error("Update round score error:", error);
    res.status(500).json({ error: "Failed to update round score" });
  } finally {
    connection.release();
  }
};

// Legacy update arrow staging (keeping for backwards compatibility if needed)
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
