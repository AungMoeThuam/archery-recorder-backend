const db = require("../config/database");

// Get all competitions
exports.getCompetitions = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT 
        competitionID,
        competitionTitle,
        competitionStartDate,
        competitionEndDate,
        competitionVenue,
        competitionCity,
        competitionCountry,
        competitionStatus,
        championshipID
      FROM competition
      ORDER BY competitionStartDate DESC`
    );

    res.json(rows);
  } catch (error) {
    console.error("Get competitions error:", error);
    res.status(500).json({ error: "Failed to fetch competitions" });
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
      return res.status(404).json({ error: "Competition not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get competition error:", error);
    res.status(500).json({ error: "Failed to fetch competition" });
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
        roundDate
      FROM round
      WHERE competitionID = ?
      ORDER BY roundDate`,
      [competitionID]
    );

    res.json(rows);
  } catch (error) {
    console.error("Get rounds error:", error);
    res.status(500).json({ error: "Failed to fetch rounds" });
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
      return res.status(404).json({ error: "Round not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get round error:", error);
    res.status(500).json({ error: "Failed to fetch round" });
  }
};
