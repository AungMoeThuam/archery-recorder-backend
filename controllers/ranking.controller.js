const db = require("../config/database");

// Get ranking of archers for a specific round in a competition
exports.getRoundRanking = async (req, res) => {
  try {
    const { competitionID, roundID } = req.params;

    // Use ROW_NUMBER() window function (MySQL 8+) for reliable ranking
    // Parameterized query: placeholders (?) are bound to [roundID, competitionID]
    const query = `
      SELECT
        ROW_NUMBER() OVER (
          ORDER BY rs.totalScore DESC, rs.totalX DESC, rs.totalTen DESC
        ) AS ranking,
        rs.roundID,
        r.roundType,
        p.participationID,
        a.archerID,
        a.archerFirstName,
        a.archerLastName,
        rs.totalScore,
        rs.totalX,
        rs.totalTen
      FROM roundScore rs
      JOIN participation p ON rs.participationID = p.participationID
      JOIN archer a ON p.archerID = a.archerID
      JOIN round r ON rs.roundID = r.roundID
      WHERE rs.roundID = ? AND p.competitionID = ?
      ORDER BY rs.totalScore DESC, rs.totalX DESC, rs.totalTen DESC;
    `;

    const [rows] = await db.query(query, [roundID, competitionID]);
    res.json(rows);
  } catch (error) {
    console.error("Get round ranking error:", error);
    res.status(500).json({ error: "Failed to fetch round ranking" });
  }
};
