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
// Payload: roundID and participationID only
// Logic: Check if archer's participationCategory matches any roundCategory
exports.checkRoundEligibility = async (req, res) => {
  try {
    const { roundID, participationID } = req.query;

    if (!roundID || !participationID) {
      return res.status(400).json({
        error: "roundID and participationID are required",
      });
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

    // Get participation categories for this participation
    const [archerCategories] = await db.query(
      `SELECT DISTINCT categoryID FROM participationCategory WHERE participationID = ?`,
      [participationID]
    );

    if (archerCategories.length === 0) {
      return res.json({
        participationID: parseInt(participationID),
        roundID: parseInt(roundID),
        eligible: false,
        message: "Participation has no categories",
      });
    }

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

    // Get archer and round info for response
    const [roundInfo] = await db.query(
      `SELECT roundID, roundType FROM round WHERE roundID = ?`,
      [roundID]
    );

    res.json({
      participationID: parseInt(participationID),
      roundID: parseInt(roundID),
      roundType: roundInfo[0]?.roundType || "Unknown",
      eligible: hasMatch,
      message: hasMatch
        ? "Archer is eligible for this round"
        : "Archer is not eligible for this round (category mismatch)",
    });
  } catch (error) {
    console.error("Check round eligibility error:", error);
    res.status(500).json({ error: "Failed to check round eligibility" });
  }
};

// Record arrows to staging table
// Payload: { roundID, participationID, distance, target, endOrder, arrows: [] }
// Returns: Same payload with additional "recorded" boolean field
exports.recordEndArrows = async (req, res) => {
  try {
    const { roundID, participationID, distance, target, endOrder, arrows } =
      req.body;

    // Validate required fields
    if (
      !roundID ||
      !participationID ||
      !distance ||
      !target ||
      !endOrder ||
      !arrows ||
      !Array.isArray(arrows)
    ) {
      return res.status(400).json({
        error:
          "roundID, participationID, distance, target, endOrder, and arrows array are required",
      });
    }

    // Insert each arrow into arrowStaging table
    for (const arrow of arrows) {
      // Determine arrowScore and isX
      let arrowScore = 0;
      let isX = 0;

      if (arrow === "X") {
        arrowScore = 10;
        isX = 1;
      } else if (arrow === "M") {
        arrowScore = 0;
        isX = 0;
      } else {
        arrowScore = parseInt(arrow);
        isX = 0;
      }

      await db.query(
        `INSERT INTO arrowStaging (roundID, participationID, distance, endOrder, arrowScore, isX, stagingStatus, date)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW())`,
        [roundID, participationID, distance, endOrder, arrowScore, isX]
      );
    }

    // Return the same structure with recorded field
    res.json({
      roundID,
      participationID,
      distance,
      target,
      endOrder,
      arrows,
      recorded: true,
    });
  } catch (error) {
    console.error("Record arrows error:", error);
    res.status(500).json({
      roundID: req.body.roundID,
      participationID: req.body.participationID,
      distance: req.body.distance,
      target: req.body.target,
      endOrder: req.body.endOrder,
      arrows: req.body.arrows,
      recorded: false,
      error: "Failed to record arrows",
    });
  }
};

// Get submitted scores for an archer in a specific round
// Query params: participationID, roundID
// Returns: Array of submitted ends with arrows
exports.getSubmittedScores = async (req, res) => {
  try {
    const { participationID, roundID } = req.query;

    // Validate required fields
    if (!participationID || !roundID) {
      return res.status(400).json({
        error: "participationID and roundID are required",
      });
    }

    // Get all submitted arrows from arrowStaging
    const [arrows] = await db.query(
      `SELECT
        arrowStagingID,
        distance,
        endOrder,
        arrowScore,
        isX
      FROM arrowStaging
      WHERE participationID = ? AND roundID = ?
      ORDER BY distance, endOrder, arrowStagingID`,
      [participationID, roundID]
    );

    // Group arrows by distance and endOrder
    const groupedEnds = {};

    arrows.forEach((arrow) => {
      const key = `${arrow.distance}-${arrow.endOrder}`;

      if (!groupedEnds[key]) {
        groupedEnds[key] = {
          distance: arrow.distance,
          endOrder: arrow.endOrder,
          arrows: [],
          submitted: true,
        };
      }

      // Convert score: isX=1 -> "X", score=0 -> "M", otherwise numeric
      let displayScore;
      if (arrow.isX === 1) {
        displayScore = "X";
      } else if (arrow.arrowScore === 0) {
        displayScore = "M";
      } else {
        displayScore = arrow.arrowScore;
      }

      groupedEnds[key].arrows.push(displayScore);
    });

    // Convert grouped object to array
    const submittedEnds = Object.values(groupedEnds);

    res.json({
      submittedEnds,
    });
  } catch (error) {
    console.error("Get submitted scores error:", error);
    res.status(500).json({ error: "Failed to fetch submitted scores" });
  }
};
