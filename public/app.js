const sourceEl = document.querySelector("#source");
const queryEl = document.querySelector("#query");
const olivettiModeEl = document.querySelector("#olivettiMode");
const nihilLangEl = document.querySelector("#nihilLang");
const searchBtn = document.querySelector("#searchBtn");
const clearBtn = document.querySelector("#clearBtn");
const statusEl = document.querySelector("#status");
const resultEl = document.querySelector("#result");
const themeToggle = document.querySelector("#themeToggle");
const olivettiModeRow = document.querySelector("#olivettiModeRow");
const nihilLangRow = document.querySelector("#nihilLangRow");
const UI_MAX_DEFINITIONS_DISPLAY = 25;
const UI_MAX_USAGES_DISPLAY = 40;
const UI_MAX_DETAILS_DISPLAY = 40;
const UI_MAX_NIHIL_SUMMARY_LINES = 12;
const UI_MAX_NIHIL_GRAMMAR_LINES = 12;
const UI_MAX_NIHIL_TABLES = 8;
const UI_MAX_NIHIL_TABLE_ROWS = 120;
const NIHIL_LATIN_PERSON_MARKERS = ["ego", "tu", "ille", "nos", "vos", "illi"];
const NIHIL_ITALIAN_PERSON_MARKERS = ["Io", "Tu", "Egli/Ella/Esso", "Noi", "Voi", "Essi/Esse/Loro"];

function setStatus(text) {
  statusEl.textContent = text;
}

function resetResult() {
  resultEl.innerHTML = "";
}

function appendTextBlock(text, className = "result-text") {
  const block = document.createElement("div");
  block.className = className;
  block.textContent = text;
  resultEl.appendChild(block);
}

function appendListSection(title, items) {
  if (!Array.isArray(items) || !items.length) {
    return;
  }

  const section = document.createElement("section");
  section.className = "result-section";

  const heading = document.createElement("h3");
  heading.className = "section-title";
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("ol");
  list.className = "section-list";
  items.forEach((item) => {
    if (!item || !item.trim()) {
      return;
    }
    const li = document.createElement("li");
    li.textContent = item.trim();
    list.appendChild(li);
  });

  if (list.children.length > 0) {
    section.appendChild(list);
    resultEl.appendChild(section);
  }
}

function appendKeyValueSection(title, pairs) {
  const rows = Array.isArray(pairs) ? pairs.filter((pair) => pair && pair.label && pair.value) : [];
  if (!rows.length) {
    return;
  }

  const section = document.createElement("section");
  section.className = "result-section";

  const heading = document.createElement("h3");
  heading.className = "section-title";
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement("dl");
  list.className = "keyvalue-list";
  rows.forEach((pair) => {
    const dt = document.createElement("dt");
    dt.textContent = pair.label;
    const dd = document.createElement("dd");
    dd.textContent = pair.value;
    list.appendChild(dt);
    list.appendChild(dd);
  });

  section.appendChild(list);
  resultEl.appendChild(section);
}

function splitByMarkers(text, markers) {
  if (!text) {
    return [];
  }
  const escaped = markers.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "g");
  const prepared = text.replace(/\s+/g, " ").trim();
  const matches = [...prepared.matchAll(regex)];
  if (!matches.length) {
    return [prepared];
  }

  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : prepared.length;
    return prepared.slice(start, end).trim();
  });
}

function parseNihilSummary(line) {
  if (!line || !line.trim()) {
    return [];
  }

  const cleaned = line.replace(/\s+/g, " ").trim();
  const entryMatch = cleaned.match(/^([^=]+)=\s*(.+?)\.\.\.\s*(.*)$/);
  if (!entryMatch) {
    return [{ label: "Dettaglio", value: cleaned }];
  }

  const term = entryMatch[1].trim();
  const translation = entryMatch[2].trim();
  const remainder = entryMatch[3].trim();
  const grammarMatch = remainder.match(
    /(INDICATIVO|CONGIUNTIVO|IMPERATIVO|INFINITO|PARTICIPIO|GERUNDIO|SUPINO|Sostantivo|Aggettivo|Pronome).*$/
  );
  let functionText = grammarMatch
    ? remainder.slice(0, Math.max(0, grammarMatch.index)).replace(/[,\s]+$/g, "")
    : remainder;
  if (functionText.toLowerCase().startsWith(`${term.toLowerCase()} -`)) {
    functionText = functionText.slice(term.length + 2).trim();
  }
  functionText = functionText.replace(/[-,\s]+$/g, "");
  const grammarText = grammarMatch ? grammarMatch[0].trim() : "";

  const pairs = [
    { label: "Termine", value: term },
    { label: "Traduzione", value: translation },
  ];
  if (functionText) {
    pairs.push({ label: "Funzione / significati", value: functionText });
  }
  if (grammarText) {
    pairs.push({ label: "Modo, tempo, persona o casi", value: grammarText });
  }
  return pairs;
}

function expandVerbPersons(row) {
  if (!Array.isArray(row) || row.length !== 2) {
    return null;
  }
  const latin = row[0];
  const italian = row[1]
    .replace(/(Io|Tu|Egli\/Ella\/Esso|Noi|Voi|Essi\/Esse\/Loro)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
  if (!/\bego\b/i.test(latin) || !/\bIo\b/.test(italian)) {
    return null;
  }

  const latinParts = splitByMarkers(latin, NIHIL_LATIN_PERSON_MARKERS);
  const italianParts = splitByMarkers(italian, NIHIL_ITALIAN_PERSON_MARKERS);
  const rows = [];
  const labels = [
    "1ª singolare",
    "2ª singolare",
    "3ª singolare",
    "1ª plurale",
    "2ª plurale",
    "3ª plurale",
  ];

  for (let i = 0; i < Math.min(latinParts.length, italianParts.length, labels.length); i += 1) {
    rows.push([labels[i], latinParts[i], italianParts[i]]);
  }

  return rows.length ? rows : null;
}

function expandNounCases(row) {
  if (!Array.isArray(row) || row.length < 2) {
    return null;
  }

  const singularLines = row[0].split("\n").map((line) => line.trim()).filter(Boolean);
  const pluralLines = row[1].split("\n").map((line) => line.trim()).filter(Boolean);
  const meaningLines = (row[2] || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const singularCases = singularLines
    .map((line) => {
      const match = line.match(/^(Nom\.|Gen\.|Dat\.|Acc\.|Voc\.|Abl\.)\s*(.+)$/);
      if (!match) {
        return null;
      }
      return { label: match[1], form: match[2] };
    })
    .filter(Boolean);

  if (!singularCases.length || pluralLines.length < singularCases.length) {
    return null;
  }

  return singularCases.map((item, index) => [
    item.label,
    item.form,
    pluralLines[index] || "",
    meaningLines[index] || "",
  ]);
}

function expandNihilTableRows(rows) {
  const expanded = [];
  rows.forEach((row, idx) => {
    if (!Array.isArray(row) || !row.length) {
      return;
    }

    if (idx > 0) {
      const verbRows = expandVerbPersons(row);
      if (verbRows) {
        if (!expanded.some((item) => Array.isArray(item) && item[0] === "Persona")) {
          expanded.push(["Persona", "Forma latina", "Traduzione"]);
        }
        expanded.push(...verbRows);
        return;
      }

      const nounRows = expandNounCases(row);
      if (nounRows) {
        if (!expanded.some((item) => Array.isArray(item) && item[0] === "Caso")) {
          expanded.push(["Caso", "Singolare", "Plurale", "Uso/valore"]);
        }
        expanded.push(...nounRows);
        return;
      }
    }

    if (row.length === 1) {
      row[0]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => expanded.push([line]));
      return;
    }

    expanded.push(
      row.map((cell) =>
        cell
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .join(" · ")
      )
    );
  });
  return expanded;
}

function renderOlivettiResult(data) {
  const lemma = (data.lemma || "").trim();
  const paradigm = (data.paradigm || "").trim();
  const grammar = (data.grammar || "").trim();
  const definitions = Array.isArray(data.definitions)
    ? data.definitions.slice(0, UI_MAX_DEFINITIONS_DISPLAY)
    : [];
  const usages = Array.isArray(data.usages) ? data.usages.slice(0, UI_MAX_USAGES_DISPLAY) : [];

  const header = document.createElement("header");
  header.className = "result-header";

  const lemmaTitle = document.createElement("h2");
  lemmaTitle.className = "lemma-title";
  lemmaTitle.textContent = lemma || data.query || "Risultato";
  header.appendChild(lemmaTitle);

  const meta = [paradigm, grammar].filter(Boolean).join(" · ");
  if (meta) {
    const subtitle = document.createElement("p");
    subtitle.className = "lemma-meta";
    subtitle.textContent = meta;
    header.appendChild(subtitle);
  }

  resultEl.appendChild(header);
  appendListSection("Spiegazioni", definitions);
  appendListSection("Usi, contesti e locuzioni", usages);

  if (!definitions.length && !usages.length) {
    appendTextBlock(
      (data.readablePreview || data.bodyPreview || "Nessun risultato utile trovato.").trim(),
      "result-text"
    );
  }
}

function appendNihilTableBlock(block, index) {
  if (!block || !Array.isArray(block.rows) || !block.rows.length) {
    return;
  }

  const section = document.createElement("section");
  section.className = "result-section";

  const heading = document.createElement("h3");
  heading.className = "section-title";
  heading.textContent = block.title || `Tabella ${index + 1}`;
  section.appendChild(heading);

  const tableWrap = document.createElement("div");
  tableWrap.className = "nihil-table-wrap";
  const table = document.createElement("table");
  table.className = "nihil-table";

  const rows = expandNihilTableRows(block.rows).slice(0, UI_MAX_NIHIL_TABLE_ROWS);
  const maxColumns = Math.max(1, ...rows.map((row) => row.length));

  rows.forEach((row) => {
    const tr = document.createElement("tr");
    if (row.length === 1 && maxColumns > 1) {
      const td = document.createElement("td");
      td.colSpan = maxColumns;
      td.className = "nihil-table-heading-row";
      td.textContent = row[0];
      tr.appendChild(td);
    } else {
      const isSchemaHeader = row[0] === "Persona" || row[0] === "Caso";
      row.forEach((cellText) => {
        const td = document.createElement("td");
        if (isSchemaHeader) {
          td.className = "nihil-table-col-heading";
        }
        td.textContent = cellText;
        tr.appendChild(td);
      });
      for (let i = row.length; i < maxColumns; i += 1) {
        const td = document.createElement("td");
        td.textContent = "";
        tr.appendChild(td);
      }
    }
    table.appendChild(tr);
  });

  tableWrap.appendChild(table);
  section.appendChild(tableWrap);
  resultEl.appendChild(section);
}

function renderNihilScioResult(data) {
  const summaryLines = Array.isArray(data.summaryLines) ? data.summaryLines.slice(0, UI_MAX_NIHIL_SUMMARY_LINES) : [];
  const grammarDetails = Array.isArray(data.grammarDetails)
    ? data.grammarDetails.slice(0, UI_MAX_NIHIL_GRAMMAR_LINES)
    : [];
  const tableBlocks = Array.isArray(data.tableBlocks) ? data.tableBlocks.slice(0, UI_MAX_NIHIL_TABLES) : [];

  const header = document.createElement("header");
  header.className = "result-header";

  const lemmaTitle = document.createElement("h2");
  lemmaTitle.className = "lemma-title";
  lemmaTitle.textContent = (data.query || "NihilScio").trim();
  header.appendChild(lemmaTitle);

  const subtitle = document.createElement("p");
  subtitle.className = "lemma-meta";
  subtitle.textContent = "NihilScio: traduzione, analisi e tabelle";
  header.appendChild(subtitle);

  resultEl.appendChild(header);
  const summaryPairs = parseNihilSummary(summaryLines[0] || "");
  appendKeyValueSection("Risultato trovato", summaryPairs);
  appendListSection("Altri risultati trovati", summaryLines.slice(1));
  appendListSection("Dettagli grammaticali", grammarDetails);
  tableBlocks.forEach((block, index) => appendNihilTableBlock(block, index));

  if (!summaryLines.length && !grammarDetails.length && !tableBlocks.length) {
    renderGenericResult(data);
  }
}

function renderGenericResult(data) {
  const preview = (data.readablePreview || data.bodyPreview || "").trim();
  if (preview) {
    appendTextBlock(preview, "result-text");
    return;
  }

  if (Array.isArray(data.details) && data.details.length) {
    appendTextBlock(data.details.slice(0, UI_MAX_DETAILS_DISPLAY).join("\n"), "result-text");
    return;
  }

  appendTextBlock("Nessun risultato utile trovato.", "result-text");
}

function renderErrorResult(data, fallbackMessage) {
  const message =
    data && typeof data.error === "string" && data.error.trim() ? data.error.trim() : fallbackMessage;
  appendTextBlock(message, "result-error");
}

function renderResult(data) {
  resetResult();

  if (!data || typeof data !== "object") {
    appendTextBlock("Nessun risultato disponibile.", "result-text");
    return;
  }

  if (data.source === "olivetti" || data.source === "olivetti-declension") {
    renderOlivettiResult(data);
    return;
  }

  if (data.source === "nihilscio") {
    renderNihilScioResult(data);
    return;
  }

  renderGenericResult(data);
}

function syncSourceUi() {
  const isOlivetti = sourceEl.value === "olivetti";
  olivettiModeRow.classList.toggle("hidden", !isOlivetti);
  nihilLangRow.classList.toggle("hidden", isOlivetti);
}

async function runSearch() {
  const query = queryEl.value.trim();
  if (!query) {
    setStatus("Inserisci una parola.");
    return;
  }

  const source = sourceEl.value;
  let url = "";

  if (source === "olivetti") {
    const mode = olivettiModeEl.value;
    const params = new URLSearchParams({ word: query });
    if (mode !== "normal") {
      params.set("mode", mode);
    }
    url = `/api/olivetti?${params.toString()}`;
  } else {
    const lang = nihilLangEl.value;
    const params = new URLSearchParams({ word: query, lang });
    url = `/api/nihilscio?${params.toString()}`;
  }

  setStatus("Ricerca in corso…");
  resetResult();

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      setStatus("Errore dalla fonte remota.");
      renderErrorResult(data, "Errore dalla fonte remota.");
      return;
    }

    setStatus("Risultati ricevuti.");
    renderResult(data);
  } catch (error) {
    setStatus("Errore di rete.");
    renderErrorResult({ error: error.message }, "Errore di rete.");
  }
}

function clearOutput() {
  resetResult();
  setStatus("Pronto.");
}

function applySavedTheme() {
  const saved = localStorage.getItem("youlatin-theme");
  const theme = saved === "light" || saved === "dark" ? saved : "dark";
  document.body.dataset.theme = theme;
}

themeToggle.addEventListener("click", () => {
  const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
  document.body.dataset.theme = nextTheme;
  localStorage.setItem("youlatin-theme", nextTheme);
});

sourceEl.addEventListener("change", syncSourceUi);
searchBtn.addEventListener("click", runSearch);
clearBtn.addEventListener("click", clearOutput);
queryEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    runSearch();
  }
});

applySavedTheme();
syncSourceUi();
