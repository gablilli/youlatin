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
const OLIVETTI_SECTION_SELECTOR = "#myth";
const OLIVETTI_LEMMA_SELECTOR = "span.lemma";
const OLIVETTI_PARADIGM_SELECTOR = "span.paradigma";
const OLIVETTI_GRAMMAR_SELECTOR = "span.grammatica";
const OLIVETTI_DEFINITION_SELECTOR = "span.italiano";
const OLIVETTI_LOCUTION_LATIN_SELECTOR = "span.cita_1";
const OLIVETTI_LOCUTION_ITALIAN_SELECTOR = "span.cita_2";
const OLIVETTI_LOCUTIONS_HEADING = "locuzioni, modi di dire, esempi";
const OLIVETTI_START_MARKERS = ["Dizionario Latino - Italiano", "Dizionario Latino Olivetti"];
const OLIVETTI_END_MARKERS = ["Sfoglia il dizionario", "Sfoglia il diz", "I nostri link Mappa del sito"];
const NIHILSCIO_START_MARKERS = ["Vocaboli trovati", "- Declinazione di:", "Declinazione di:"];
const NIHILSCIO_END_MARKERS = [
  "Continua la ricerca sul web con NihilScio",
  "NS-NihilScio©",
  "function PopupCentrata1(",
];
const NIHILSCIO_SUMMARY_TABLE_SELECTOR = "table.style124";
const NIHILSCIO_TABLE_BLOCK_SELECTOR = "table.style123, table.style119";
const NIHILSCIO_DETAIL_PATTERN = /^(?:- )?(?:Coniugazione completa di|Coniugazione di:|Declinazione di:|- Declinazione di:)/i;
const NIHILSCIO_IGNORE_LINES = /^(?:Vocaboli trovati|\(Di seguito i dettagli\))$/i;

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

function trimBodyTextToSection(bodyText, { startMarkers = [], endMarkers = [], maxChars = MAX_FOCUSED_PREVIEW_CHARS }) {
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
  const focusedPreview = trimBodyTextToSection(bodyText, {
    startMarkers: OLIVETTI_START_MARKERS,
    endMarkers: OLIVETTI_END_MARKERS,
  });
  const entryBlock = $(OLIVETTI_SECTION_SELECTOR)
    .filter((_, el) => $(el).find(OLIVETTI_LEMMA_SELECTOR).length > 0)
    .first();
  const locutionsBlock = $(OLIVETTI_SECTION_SELECTOR)
    .filter(
      (_, el) => normalizeText($(el).find("h3").first().text()).toLowerCase() === OLIVETTI_LOCUTIONS_HEADING
    )
    .first();

  const lemma = normalizeText(entryBlock.find(OLIVETTI_LEMMA_SELECTOR).first().text());
  const paradigm = normalizeText(entryBlock.find(OLIVETTI_PARADIGM_SELECTOR).first().text());
  const grammar = normalizeText(entryBlock.find(OLIVETTI_GRAMMAR_SELECTOR).first().text());
  const definitions = compactUnique(entryBlock.find(OLIVETTI_DEFINITION_SELECTOR).map((_, el) => $(el).text()).get());

  const locutionsLatin = locutionsBlock
    .find(OLIVETTI_LOCUTION_LATIN_SELECTOR)
    .map((_, el) => normalizeText($(el).text()))
    .get();
  const locutionsItalian = locutionsBlock
    .find(OLIVETTI_LOCUTION_ITALIAN_SELECTOR)
    .map((_, el) => normalizeText($(el).text()))
    .get();

  const usages = compactUnique(
    locutionsLatin
      .map((left, idx) => {
        const right = locutionsItalian[idx] || "";
        if (!left) {
          return "";
        }
        return right ? `${left} = ${right}` : left;
      })
      .filter(Boolean)
  );

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

  const readableChunks = [];
  if (lemma) {
    readableChunks.push([lemma, paradigm, grammar].filter(Boolean).join(" "));
  }
  if (definitions.length) {
    readableChunks.push(definitions.map((line, idx) => `${idx + 1}. ${line}`).join(" "));
  }
  if (usages.length) {
    readableChunks.push(`Locuzioni: ${usages.join(" || ")}`);
  }

  const readablePreview = normalizeText(readableChunks.join(" ").trim()) || focusedPreview;

  return {
    title: normalizeText($("title").text()),
    lemma,
    paradigm,
    grammar,
    definitions,
    usages,
    declensionLinks,
    permalinkCandidates,
    resultLines,
    bodyPreview: readablePreview.slice(0, MAX_PREVIEW_CHARS),
    readablePreview: readablePreview.slice(0, MAX_PREVIEW_CHARS),
  };
}

function parseNihilScio(html, sourceUrl) {
  const $ = cheerio.load(html);
  const bodyText = normalizeText($("body").text());
  const focusedPreview = trimBodyTextToSection(bodyText, {
    startMarkers: NIHILSCIO_START_MARKERS,
    endMarkers: NIHILSCIO_END_MARKERS,
  });

  const summaryTable = $(NIHILSCIO_SUMMARY_TABLE_SELECTOR)
    .filter((_, table) => normalizeText($(table).text()).includes("Vocaboli trovati"))
    .first();
  const summaryLines = compactUnique(
    summaryTable
      .find("tr")
      .map((_, row) => normalizeText($(row).text()))
      .get()
      .filter((line) => line && !NIHILSCIO_IGNORE_LINES.test(line))
  );

  const grammarDetails = compactUnique(
    $("td, th")
      .map((_, cell) => normalizeText($(cell).text()))
      .get()
      .filter((line) => NIHILSCIO_DETAIL_PATTERN.test(line))
  );

  const tableBlocks = $(NIHILSCIO_TABLE_BLOCK_SELECTOR)
    .toArray()
    .map((table) => {
      const rows = [];
      $(table)
        .find("tr")
        .each((__, row) => {
          const cells = [];
          $(row)
            .find("th, td")
            .each((___, cell) => {
              const text = normalizeText($(cell).text());
              if (text) {
                cells.push(text);
              }
            });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });

      if (!rows.length) {
        return null;
      }

      const title = rows[0].join(" · ");
      return {
        title,
        rows,
      };
    })
    .filter(Boolean);

  const structuredPreview = normalizeText(
    [summaryLines[0], ...grammarDetails.slice(0, 2)]
      .filter(Boolean)
      .join(" ")
  );

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
    summaryLines,
    grammarDetails,
    tableBlocks,
    details,
    links,
    bodyPreview: focusedPreview.slice(0, MAX_PREVIEW_CHARS),
    readablePreview: (structuredPreview || focusedPreview).slice(0, MAX_PREVIEW_CHARS),
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
