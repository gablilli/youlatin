const cheerio = require("cheerio");

const OLI_URL = "https://www.dizionario-latino.com/dizionario-latino-italiano.php";
const OLI_FLESSIONE_URL = "https://www.dizionario-latino.com/dizionario-latino-flessione.php";
const NIHIL_URL = "https://www.nihilscio.it/Manuali/Lingua%20latina/Verbi/Coniugazione_latino.aspx";
const FETCH_TIMEOUT_MS = 15000;
const MAX_QUERY_LENGTH = 120;
const MAX_OLIVETTI_LINES = 120;
const MAX_NIHILSCIO_LINES = 140;
const MAX_PREVIEW_CHARS = 4500;
const MAX_FOCUSED_PREVIEW_CHARS = 1800;
const OLIVETTI_START_MARKERS = ["Dizionario Latino - Italiano", "Dizionario Latino Olivetti"];
const OLIVETTI_END_MARKERS = ["Sfoglia il dizionario", "Sfoglia il diz", "I nostri link Mappa del sito"];
const NIHILSCIO_START_MARKERS = ["Vocaboli trovati", "- Declinazione di:", "Declinazione di:"];
const NIHILSCIO_END_MARKERS = [
  "Continua la ricerca sul web con NihilScio",
  "NS-NihilScio©",
  "function PopupCentrata1(",
];

function normalizeText(raw) {
  return raw.replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

function compactUnique(values) {
  return [...new Set(values.map((v) => normalizeText(v)).filter(Boolean))];
}

function safeWord(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input.trim().slice(0, MAX_QUERY_LENGTH);
}

function toAbsolute(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return "";
  }
}

function cutAtFirst(text, markers) {
  let end = text.length;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx !== -1) {
      end = Math.min(end, idx);
    }
  }
  return text.slice(0, end);
}

function focusBodyText(bodyText, { startMarkers = [], endMarkers = [], maxChars = MAX_FOCUSED_PREVIEW_CHARS }) {
  let focused = bodyText;

  for (const marker of startMarkers) {
    const idx = focused.indexOf(marker);
    if (idx !== -1) {
      focused = focused.slice(idx);
      break;
    }
  }

  focused = cutAtFirst(focused, endMarkers);
  focused = normalizeText(focused).slice(0, maxChars);
  return focused || bodyText.slice(0, maxChars);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; YouLatinBot/1.0; +https://github.com/gablilli/youlatin)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function parseOlivetti(html, sourceUrl) {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const focusedPreview = focusBodyText(bodyText, {
    startMarkers: OLIVETTI_START_MARKERS,
    endMarkers: OLIVETTI_END_MARKERS,
  });

  const declensionLinks = compactUnique(
    $("a[href*='dizionario-latino-flessione.php?lemma=']")
      .map((_, el) => toAbsolute(sourceUrl, $(el).attr("href") || ""))
      .get()
  );

  const permalinkCandidates = compactUnique(
    $("a[href*='lemma='], a[href*='permalink']")
      .map((_, el) => toAbsolute(sourceUrl, $(el).attr("href") || ""))
      .get()
  );

  const resultLines = compactUnique(
    $("table td, p, li")
      .map((_, el) => $(el).text())
      .get()
      .filter((line) => normalizeText(line).length > 2)
  ).slice(0, MAX_OLIVETTI_LINES);

  return {
    title: normalizeText($("title").text()),
    declensionLinks,
    permalinkCandidates,
    resultLines,
    bodyPreview: focusedPreview.slice(0, MAX_PREVIEW_CHARS),
    readablePreview: focusedPreview,
  };
}

function parseNihilScio(html, sourceUrl) {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const focusedPreview = focusBodyText(bodyText, {
    startMarkers: NIHILSCIO_START_MARKERS,
    endMarkers: NIHILSCIO_END_MARKERS,
  });

  const details = compactUnique(
    $("table td, p, li")
      .map((_, el) => $(el).text())
      .get()
      .filter((line) => normalizeText(line).length > 2)
  ).slice(0, MAX_NIHILSCIO_LINES);

  const links = compactUnique(
    $("a[href]")
      .map((_, el) => toAbsolute(sourceUrl, $(el).attr("href") || ""))
      .get()
      .filter((link) => link.includes("nihilscio.it"))
  );

  return {
    title: normalizeText($("title").text()),
    details,
    links,
    bodyPreview: focusedPreview.slice(0, MAX_PREVIEW_CHARS),
    readablePreview: focusedPreview,
  };
}

async function getOlivettiData(query) {
  const parola = safeWord(query.word);
  const mode = safeWord(query.mode || "normal");

  if (!parola) {
    return { status: 400, payload: { error: "Missing 'word' parameter." } };
  }

  const params = new URLSearchParams({ parola });
  if (mode === "ft" || mode === "ff") {
    params.set("md", mode);
  }

  const sourceUrl = `${OLI_URL}?${params.toString()}`;
  const html = await fetchHtml(sourceUrl);
  const parsed = parseOlivetti(html, sourceUrl);

  return {
    status: 200,
    payload: {
      source: "olivetti",
      query: parola,
      mode,
      sourceUrl,
      ...parsed,
    },
  };
}

async function getOlivettiDeclensionData(query) {
  const lemma = safeWord(query.lemma);
  if (!lemma) {
    return { status: 400, payload: { error: "Missing 'lemma' parameter." } };
  }

  const params = new URLSearchParams({ lemma });
  const sourceUrl = `${OLI_FLESSIONE_URL}?${params.toString()}`;
  const html = await fetchHtml(sourceUrl);
  const parsed = parseOlivetti(html, sourceUrl);

  return {
    status: 200,
    payload: {
      source: "olivetti-declension",
      lemma,
      sourceUrl,
      ...parsed,
    },
  };
}

async function getNihilScioData(query) {
  const word = safeWord(query.word);
  const lang = query.lang === "LA_" ? "LA_" : "IT_";

  if (!word) {
    return { status: 400, payload: { error: "Missing 'word' parameter." } };
  }

  const params = new URLSearchParams({ verbo: word, lang });
  const sourceUrl = `${NIHIL_URL}?${params.toString()}`;
  const html = await fetchHtml(sourceUrl);
  const parsed = parseNihilScio(html, sourceUrl);

  return {
    status: 200,
    payload: {
      source: "nihilscio",
      query: word,
      lang,
      sourceUrl,
      ...parsed,
    },
  };
}

module.exports = {
  getOlivettiData,
  getOlivettiDeclensionData,
  getNihilScioData,
};
