const db = require("../config/database");

// Get ranking of archers for a specific round in a competition
// Rankings are partitioned by gender (separate rankings for male/female)
exports.getRoundRanking = async (req, res) => {
  try {
    const { competitionID, roundID } = req.params;

    // Use ROW_NUMBER() with PARTITION BY gender to create separate rankings per gender
    const query = `
      SELECT
        ROW_NUMBER() OVER (
          PARTITION BY c.gender
          ORDER BY rs.totalScore DESC, rs.totalX DESC, rs.totalTen DESC
        ) AS ranking,
        c.gender,
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
      JOIN participationCategory pc ON p.participationID = pc.participationID
      JOIN category c ON pc.categoryID = c.categoryID
      WHERE rs.roundID = ? AND p.competitionID = ?
      ORDER BY c.gender, rs.totalScore DESC, rs.totalX DESC, rs.totalTen DESC;
    `;

    const [rows] = await db.query(query, [roundID, competitionID]);
    res.json(rows);
  } catch (error) {
    console.error("Get round ranking error:", error);
    res.status(500).json({ error: "Failed to fetch round ranking" });
  }
};
