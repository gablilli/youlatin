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

function renderOlivettiResult(data) {
  const lemma = (data.lemma || "").trim();
  const paradigm = (data.paradigm || "").trim();
  const grammar = (data.grammar || "").trim();
  const definitions = Array.isArray(data.definitions) ? data.definitions.slice(0, 25) : [];
  const usages = Array.isArray(data.usages) ? data.usages.slice(0, 40) : [];

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

function renderGenericResult(data) {
  const preview = (data.readablePreview || data.bodyPreview || "").trim();
  if (preview) {
    appendTextBlock(preview, "result-text");
    return;
  }

  if (Array.isArray(data.details) && data.details.length) {
    appendTextBlock(data.details.slice(0, 40).join("\n"), "result-text");
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
