const db = require("../config/database");

// Archer Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await db.query(
      "SELECT archerID, archerFirstName, archerLastName, archerEmail FROM archer WHERE archerEmail = ? AND archerPassword = ?",
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Login failed" });
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
        c.competitionTitle,
        c.competitionStartDate,
        c.competitionEndDate,
        c.competitionVenue,
        c.competitionCity,
        c.competitionCountry,
        c.competitionStatus
      FROM participation p
      JOIN competition c ON p.competitionID = c.competitionID
      WHERE p.archerID = ?
      ORDER BY c.competitionStartDate DESC
    `;

    const [competitions] = await db.query(query, [archerID]);

    // Get rounds for each competition
    for (let comp of competitions) {
      const [rounds] = await db.query(
        `SELECT 
          r.roundID,
          r.roundType,
          r.roundDate,
          rs.totalScore,
          rs.totalX,
          rs.totalTen
        FROM round r
        LEFT JOIN roundScore rs ON r.roundID = rs.roundID AND rs.participationID = ?
        WHERE r.competitionID = ?
        ORDER BY r.roundDate`,
        [comp.participationID, comp.competitionID]
      );
      comp.rounds = rounds;
    }

    res.json(competitions);
  } catch (error) {
    console.error("Get competitions error:", error);
    res.status(500).json({ error: "Failed to fetch competitions" });
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
        c.competitionTitle,
        c.competitionVenue,
        c.competitionStartDate,
        c.competitionEndDate
      FROM participation p
      JOIN competition c ON p.competitionID = c.competitionID
      WHERE p.participationID = ?`,
      [participationID]
    );

    if (compData.length === 0) {
      return res.status(404).json({ error: "Participation not found" });
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
        r.roundDate,
        ast.stagingStatus,
        rec.recorderFirstName as recorderName
      FROM roundScore rs
      JOIN round r ON rs.roundID = r.roundID
      LEFT JOIN arrowStaging ast ON rs.roundID = ast.roundID AND rs.participationID = ast.participationID
      LEFT JOIN recorder rec ON ast.recorderID = rec.recorderID
      WHERE rs.participationID = ?
      GROUP BY rs.roundScoreID
      ORDER BY r.roundDate`,
      [participationID]
    );

    res.json({
      competition: compData[0],
      roundScores: roundScores,
    });
  } catch (error) {
    console.error("Get score details error:", error);
    res.status(500).json({ error: "Failed to fetch score details" });
  }
};

// Get participation ID
exports.getParticipation = async (req, res) => {
  try {
    const { archerID, competitionID } = req.query;

    const [rows] = await db.query(
      "SELECT participationID FROM participation WHERE archerID = ? AND competitionID = ?",
      [archerID, competitionID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Participation not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get participation error:", error);
    res.status(500).json({ error: "Failed to fetch participation" });
  }
};

// Check if archer is eligible for a round (category matching)
// Payload: roundID and archerID
// Logic: Check if archer's participationCategory matches any roundCategory
exports.checkRoundEligibility = async (req, res) => {
  try {
    const { roundID, archerID } = req.query;

    if (!roundID || !archerID) {
      return res
        .status(400)
        .json({ error: "roundID and archerID are required" });
    }

    // Get all round categories
    const [roundCategories] = await db.query(
      `SELECT categoryID FROM roundCategory WHERE roundID = ?`,
      [roundID]
    );

    if (roundCategories.length === 0) {
      return res
        .status(404)
        .json({ error: "Round not found or has no categories" });
    }

    // Get all participation records for this archer
    const [participations] = await db.query(
      `SELECT participationID FROM participation WHERE archerID = ?`,
      [archerID]
    );

    if (participations.length === 0) {
      return res.json({
        eligible: false,
        message: "Archer has no participation records",
      });
    }

    // Get all participation categories for this archer
    const participationIDs = participations.map((p) => p.participationID);
    const placeholders = participationIDs.map(() => "?").join(",");
    const [archerCategories] = await db.query(
      `SELECT DISTINCT categoryID FROM participationCategory WHERE participationID IN (${placeholders})`,
      participationIDs
    );

    // Check if any archer category matches any round category
    const archerCategoryIDs = new Set(
      archerCategories.map((ac) => ac.categoryID)
    );
    const roundCategoryIDs = new Set(
      roundCategories.map((rc) => rc.categoryID)
    );

    const hasMatch = Array.from(archerCategoryIDs).some((id) =>
      roundCategoryIDs.has(id)
    );

    // Get detailed info for the response
    const [archerInfo] = await db.query(
      `SELECT archerFirstName, archerLastName FROM archer WHERE archerID = ?`,
      [archerID]
    );

    const [roundInfo] = await db.query(
      `SELECT roundID, roundType FROM round WHERE roundID = ?`,
      [roundID]
    );

    res.json({
      archerID: parseInt(archerID),
      archerName: archerInfo[0]
        ? `${archerInfo[0].archerFirstName} ${archerInfo[0].archerLastName}`
        : "Unknown",
      roundID: parseInt(roundID),
      roundType: roundInfo[0]?.roundType || "Unknown",
      eligible: hasMatch,
      archerCategories: Array.from(archerCategoryIDs),
      roundCategories: Array.from(roundCategoryIDs),
      message: hasMatch
        ? "Archer is eligible for this round"
        : "Archer is not eligible for this round (category mismatch)",
    });
  } catch (error) {
    console.error("Check round eligibility error:", error);
    res.status(500).json({ error: "Failed to check round eligibility" });
  }
};
