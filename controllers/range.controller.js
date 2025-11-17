const db = require("../config/database");

// Get ranges for a specific round
// Frontend sends roundID, we fetch roundType from round table,
// then query range table for all ranges matching that roundType
exports.getRangesByRound = async (req, res) => {
  try {
    const { roundID } = req.params;

    // Step 1: Get roundType from round table
    const [roundData] = await db.query(
      "SELECT roundType FROM round WHERE roundID = ?",
      [roundID]
    );

    if (roundData.length === 0) {
      return res.status(404).json({ error: "Round not found" });
    }

    const roundType = roundData[0].roundType;

    // Step 2: Get all ranges for this roundType
    const [ranges] = await db.query(
      `SELECT 
        rangeID,
        roundType,
        rangeDistance,
        rangeTargetSize,
        rangeTotalEnds,
        rangeTotalArrowsPerEnd
      FROM \`range\`
      WHERE roundType = ?
      ORDER BY rangeDistance ASC`,
      [roundType]
    );

    res.json({
      roundID: parseInt(roundID),
      roundType: roundType,
      ranges: ranges,
    });
  } catch (error) {
    console.error("Get ranges by round error:", error);
    res.status(500).json({ error: "Failed to fetch ranges" });
  }
};
