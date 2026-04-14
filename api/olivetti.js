const { getOlivettiData } = require("../lib/scraper");

module.exports = async function handler(req, res) {
  try {
    const { status, payload } = await getOlivettiData(req.query || {});
    res.status(status).json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Failed to fetch Olivetti data.",
      details: error.message,
    });
  }
};
