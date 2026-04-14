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

function setResult(data) {
  resultEl.textContent = data;
}

function formatUserResult(data) {
  if (!data || typeof data !== "object") {
    return "Nessun risultato disponibile.";
  }

  const chunks = [];
  const title = (data.title || "").trim();
  const preview = (data.readablePreview || data.bodyPreview || "").trim();

  if (title) {
    chunks.push(title);
  }

  if (preview) {
    chunks.push(preview);
  }

  if (!chunks.length && Array.isArray(data.resultLines) && data.resultLines.length) {
    chunks.push(data.resultLines.slice(0, 25).join("\n"));
  }

  if (!chunks.length && Array.isArray(data.details) && data.details.length) {
    chunks.push(data.details.slice(0, 25).join("\n"));
  }

  return chunks.length ? chunks.join("\n\n") : "Nessun risultato utile trovato.";
}

function formatErrorResult(data) {
  if (data && typeof data.error === "string" && data.error.trim()) {
    return data.error.trim();
  }
  return "Errore dalla fonte remota.";
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
  resultEl.textContent = "";

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      setStatus("Errore dalla fonte remota.");
      setResult(formatErrorResult(data));
      return;
    }

    setStatus("Risultati ricevuti.");
    setResult(formatUserResult(data));
  } catch (error) {
    setStatus("Errore di rete.");
    setResult(error.message || "Errore di rete.");
  }
}

function clearOutput() {
  resultEl.textContent = "";
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
