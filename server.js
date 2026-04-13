const express = require("express");
const {
  getOlivettiData,
  getOlivettiDeclensionData,
  getNihilScioData,
} = require("./lib/scraper");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

app.get("/api/olivetti", async (req, res) => {
  try {
    const { status, payload } = await getOlivettiData(req.query);
    return res.status(status).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch Olivetti data.",
      details: error.message,
    });
  }
});

app.get("/api/olivetti/declension", async (req, res) => {
  try {
    const { status, payload } = await getOlivettiDeclensionData(req.query);
    return res.status(status).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch Olivetti declension data.",
      details: error.message,
    });
  }
});

app.get("/api/nihilscio", async (req, res) => {
  try {
    const { status, payload } = await getNihilScioData(req.query);
    return res.status(status).json(payload);
  } catch (error) {
    return res.status(502).json({
      error: "Failed to fetch NihilScio data.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`youlatin running on http://localhost:${PORT}`);
});
