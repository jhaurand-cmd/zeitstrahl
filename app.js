const DATA_FILE = "data.json";
const MAX_TIMELINES = 6;
const EDIT_PASSWORD = "GSL!";
const DEFAULT_PROJECT_TITLE = "Schulentwicklungsboard";
const DEFAULT_PROJECT_DESCRIPTION = "Erläuterung";

const colors = [
  { name: "Himmel", value: "#dff0ff" },
  { name: "Mint", value: "#ddf7e8" },
  { name: "Zitrone", value: "#fff7c7" },
  { name: "Rose", value: "#ffe2e7" }
];

let cards = [];
let timelines = [];
let activeTimelineId = "";
let projectMeta = {
  title: DEFAULT_PROJECT_TITLE,
  description: DEFAULT_PROJECT_DESCRIPTION
};
let dataLoadedAt = "";
let hasUnsavedExport = false;

const form = document.querySelector("#cardForm");
const cardIdInput = document.querySelector("#cardId");
const cardTimelineIdInput = document.querySelector("#cardTimelineId");
const titleInput = document.querySelector("#titleInput");
const dateInput = document.querySelector("#dateInput");
const nativeDateInput = document.querySelector("#nativeDateInput");
const datePickerButton = document.querySelector("#datePickerButton");
const periodInput = document.querySelector("#periodInput");
const sortDateInput = document.querySelector("#sortDateInput");
const nativeSortDateInput = document.querySelector("#nativeSortDateInput");
const sortDatePickerButton = document.querySelector("#sortDatePickerButton");
const descriptionInput = document.querySelector("#descriptionInput");
const titleCount = document.querySelector("#titleCount");
const periodCount = document.querySelector("#periodCount");
const descriptionCount = document.querySelector("#descriptionCount");
const colorGrid = document.querySelector("#colorGrid");
const timelineList = document.querySelector("#timelineList");
const deleteCurrentButton = document.querySelector("#deleteCurrentButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const addTimelineButton = document.querySelector("#addTimelineButton");
const exportAllPdfButton = document.querySelector("#exportAllPdfButton");
const importDataButton = document.querySelector("#importDataButton");
const importDataInput = document.querySelector("#importDataInput");
const exportDataButton = document.querySelector("#exportDataButton");
const toggleEditorButton = document.querySelector("#toggleEditorButton");
const appShell = document.querySelector(".app-shell");
const activeTimelineLabel = document.querySelector("#activeTimelineLabel");
const projectTitleInput = document.querySelector("#projectTitleInput");
const projectDescriptionInput = document.querySelector("#projectDescriptionInput");
const formStatus = document.querySelector("#formStatus");
const dataStatus = document.querySelector("#dataStatus");
const saveButton = form.querySelector("button[type='submit']");
let isUnlocked = false;

function createTimeline(name) {
  return {
    id: `timeline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    createdAt: new Date().toISOString()
  };
}

function normalizeProjectMeta(value = {}) {
  return {
    title: String(value.title || DEFAULT_PROJECT_TITLE).slice(0, 80),
    description: String(value.description ?? DEFAULT_PROJECT_DESCRIPTION).slice(0, 400)
  };
}

function normalizeTimelines(value) {
  const cleanTimelines = Array.isArray(value)
    ? value
        .filter((item) => item && item.id)
        .slice(0, MAX_TIMELINES)
        .map((item, index) => ({
          id: String(item.id),
          name: String(item.name || `Zeitstrahl ${index + 1}`).slice(0, 100),
          createdAt: item.createdAt || new Date().toISOString()
        }))
    : [];

  return cleanTimelines.length > 0 ? cleanTimelines : [createTimeline("Zeitstrahl 1")];
}

function normalizeCards(value, validTimelineIds) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((card) => card && Number.isFinite(Number(card.id)))
    .map((card) => ({
      id: Number(card.id),
      title: String(card.title || "").slice(0, 60),
      date: String(card.date || ""),
      period: String(card.period || "").slice(0, 40),
      sortDate: String(card.sortDate || ""),
      description: String(card.description || "").slice(0, 500),
      color: availableCardColor(card.color),
      timelineId: validTimelineIds.has(card.timelineId) ? card.timelineId : timelines[0]?.id,
      updatedAt: card.updatedAt || ""
    }))
    .filter((card) => card.title && (card.date || card.period) && card.description);
}

function currentDataSnapshot() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    project: projectMeta,
    timelines,
    cards: sortCards(cards)
  };
}

function formatLoadedAt(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function updateDataStatus(message, isError = false) {
  const status = message || `Stand: ${formatLoadedAt(dataLoadedAt)}`;
  dataStatus.textContent = hasUnsavedExport && !isError
    ? `${status} - Änderungen noch als data.json exportieren.`
    : status;
  dataStatus.classList.toggle("error", isError);
}

function markDataChanged() {
  hasUnsavedExport = true;
  updateDataStatus();
}

function latestCardUpdatedAt(cardList = cards) {
  return cardList.reduce((latest, card) => {
    if (!card.updatedAt) return latest;
    const timestamp = new Date(card.updatedAt).getTime();
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest;
  }, 0);
}

function updateDataLoadedAtFromCards(cardList = cards, fallback = "") {
  const latest = latestCardUpdatedAt(cardList);
  dataLoadedAt = latest ? new Date(latest).toISOString() : fallback;
}

async function loadSharedData() {
  const response = await fetch(`${DATA_FILE}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${DATA_FILE} konnte nicht geladen werden (${response.status}).`);
  }

  applySharedData(await response.json());
}

function nextCardId() {
  return cards.reduce((maxId, card) => Math.max(maxId, Number(card.id) || 0), 0) + 1;
}

async function saveCard(card) {
  if (!card.id) {
    card.id = nextCardId();
  }

  const existingIndex = cards.findIndex((item) => item.id === card.id);
  if (existingIndex >= 0) {
    cards[existingIndex] = card;
  } else {
    cards.push(card);
  }
  dataLoadedAt = card.updatedAt || new Date().toISOString();
  markDataChanged();
  return card.id;
}

async function removeCard(id) {
  cards = cards.filter((card) => card.id !== id);
  dataLoadedAt = new Date().toISOString();
  markDataChanged();
}

async function removeCards(ids) {
  const idsToRemove = new Set(ids);
  cards = cards.filter((card) => !idsToRemove.has(card.id));
  dataLoadedAt = new Date().toISOString();
  markDataChanged();
}

async function saveProjectMeta(value) {
  const nextMeta = normalizeProjectMeta(value);
  if (JSON.stringify(projectMeta) !== JSON.stringify(nextMeta)) {
    projectMeta = nextMeta;
    markDataChanged();
  }
}

async function saveTimelinesMeta(value) {
  const nextTimelines = normalizeTimelines(value);
  if (JSON.stringify(timelines) !== JSON.stringify(nextTimelines)) {
    timelines = nextTimelines;
    markDataChanged();
  }
}

function downloadJson(data, fileName) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function syncVisibleDataBeforeExport() {
  projectMeta = normalizeProjectMeta({
    title: projectTitleInput.value.trim() || DEFAULT_PROJECT_TITLE,
    description: projectDescriptionInput.value.trim()
  });

  timelineList.querySelectorAll("input[data-action='rename-timeline']").forEach((input) => {
    const timelineItem = timelines.find((item) => item.id === input.dataset.timelineId);
    if (timelineItem) {
      timelineItem.name = input.value.trim().slice(0, 100) || "Zeitstrahl";
    }
  });
  updateActiveTimelineLabel();
}

function exportSharedData() {
  syncVisibleDataBeforeExport();
  downloadJson(currentDataSnapshot(), DATA_FILE);
  hasUnsavedExport = false;
  updateDataStatus("Neue data.json wurde heruntergeladen.");
}

function applySharedData(data, { markChanged = false } = {}) {
  projectMeta = normalizeProjectMeta(data.project);
  timelines = normalizeTimelines(data.timelines);
  const validTimelineIds = new Set(timelines.map((item) => item.id));
  cards = normalizeCards(data.cards, validTimelineIds);
  activeTimelineId = timelines[0].id;
  updateDataLoadedAtFromCards(cards, data.exportedAt || new Date().toISOString());
  hasUnsavedExport = markChanged;
  loadProjectMeta();
  activateTimeline(activeTimelineId);
  if (isUnlocked) {
    resetForm();
  }
  renderTimelines();
  updateDataStatus(markChanged ? "data.json importiert." : "");
}

async function importSharedData(file) {
  if (!requireUnlocked()) return;
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    applySharedData(data, { markChanged: true });
  } catch (error) {
    console.error(error);
    updateDataStatus(`data.json konnte nicht importiert werden: ${error?.message || error}`, true);
  }
}

function sortCards(list) {
  return [...list].sort((a, b) => {
    const aDate = a.sortDate || a.date || "";
    const bDate = b.sortDate || b.date || "";
    if (!aDate && !bDate) return a.id - b.id;
    if (!aDate) return 1;
    if (!bDate) return -1;
    if (aDate === bDate) return a.id - b.id;
    return aDate.localeCompare(bDate);
  });
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function timelineLabel(card) {
  return card.period?.trim() || formatDate(card.date);
}

function parseDateInput(value) {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const germanMatch = trimmed.match(/^(\d{1,2})\s*\.\s*(\d{1,2})\s*\.\s*(\d{4})$/);

  const parts = isoMatch
    ? { year: Number(isoMatch[1]), month: Number(isoMatch[2]), day: Number(isoMatch[3]) }
    : germanMatch
      ? { year: Number(germanMatch[3]), month: Number(germanMatch[2]), day: Number(germanMatch[1]) }
      : null;

  if (!parts) return "";

  const date = new Date(parts.year, parts.month - 1, parts.day);
  const isValidDate = date.getFullYear() === parts.year
    && date.getMonth() === parts.month - 1
    && date.getDate() === parts.day;

  if (!isValidDate) return "";

  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0")
  ].join("-");
}

function syncNativeDateInput() {
  nativeDateInput.value = parseDateInput(dateInput.value);
}

function syncNativeSortDateInput() {
  nativeSortDateInput.value = parseDateInput(sortDateInput.value);
}

function renderColorOptions() {
  colorGrid.innerHTML = colors.map((color, index) => `
    <label class="color-option" style="background:${color.value}" title="${color.name}">
      <input type="radio" name="color" value="${color.value}" ${index === 0 ? "checked" : ""}>
      <span class="sr-only">${color.name}</span>
    </label>
  `).join("");
}

function updateCounters() {
  titleCount.textContent = titleInput.value.length;
  periodCount.textContent = periodInput.value.length;
  descriptionCount.textContent = descriptionInput.value.length;
}

function resizeProjectTitle() {
  const widthInChars = Math.max(projectTitleInput.value.length + 8, 16);
  projectTitleInput.style.width = `${widthInChars}ch`;
  projectTitleInput.style.height = "auto";
  projectTitleInput.style.height = `${projectTitleInput.scrollHeight}px`;
}

function setFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", isError);
}

function selectedColor() {
  return form.elements.color.value || colors[0].value;
}

function availableCardColor(value) {
  return colors.some((color) => color.value === value) ? value : colors[0].value;
}

function requireUnlocked() {
  if (isUnlocked) return true;
  setFormStatus("Bitte zuerst den Edit-Modus mit Kennwort freischalten.", true);
  return false;
}

function activeTimeline() {
  return timelines.find((timelineItem) => timelineItem.id === activeTimelineId) || timelines[0];
}

function updateActiveTimelineLabel() {
  const current = activeTimeline();
  activeTimelineLabel.textContent = current ? `Karte für ${current.name}` : "";
}

function activateTimeline(timelineId) {
  if (timelines.some((timelineItem) => timelineItem.id === timelineId)) {
    activeTimelineId = timelineId;
  }
  cardTimelineIdInput.value = activeTimelineId;
  updateActiveTimelineLabel();
}

function startNewCard(timelineId = activeTimelineId) {
  if (!requireUnlocked()) return;
  activateTimeline(timelineId);
  form.reset();
  cardIdInput.value = "";
  cardTimelineIdInput.value = activeTimelineId;
  nativeDateInput.value = "";
  nativeSortDateInput.value = "";
  form.elements.color.value = colors[0].value;
  deleteCurrentButton.disabled = true;
  updateCounters();
  setFormStatus("");
  showEditor();
  titleInput.focus();
}

function resetForm() {
  startNewCard(activeTimelineId);
}

function editCard(id) {
  if (!requireUnlocked()) return;
  const card = cards.find((item) => item.id === id);
  if (!card) return;

  cardIdInput.value = card.id;
  activateTimeline(card.timelineId || timelines[0].id);
  cardTimelineIdInput.value = activeTimelineId;
  titleInput.value = card.title;
  dateInput.value = formatDate(card.date);
  nativeDateInput.value = card.date || "";
  periodInput.value = card.period || "";
  sortDateInput.value = formatDate(card.sortDate);
  nativeSortDateInput.value = card.sortDate || "";
  descriptionInput.value = card.description;
  form.elements.color.value = availableCardColor(card.color);
  deleteCurrentButton.disabled = false;
  updateCounters();
  showEditor();
  titleInput.focus();
}

async function addTimeline() {
  if (!requireUnlocked()) return;
  if (timelines.length >= MAX_TIMELINES) {
    setFormStatus("Es sind maximal 6 Zeitstrahlen möglich.", true);
    return;
  }

  const timelineItem = createTimeline(`Zeitstrahl ${timelines.length + 1}`);
  timelines.push(timelineItem);
  markDataChanged();
  activateTimeline(timelineItem.id);
  renderTimelines();
  startNewCard(timelineItem.id);
}

async function deleteTimeline(timelineId) {
  if (!requireUnlocked()) return;
  if (appShell.classList.contains("editor-hidden")) return;

  const timelineItem = timelines.find((item) => item.id === timelineId);
  if (!timelineItem) return;

  if (timelines.length <= 1) {
    setFormStatus("Der letzte Zeitstrahl kann nicht gelöscht werden.", true);
    return;
  }

  const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineId);
  const cardHint = timelineCards.length === 1
    ? "Eine Karte wird dabei ebenfalls gelöscht."
    : `${timelineCards.length} Karten werden dabei ebenfalls gelöscht.`;
  const message = timelineCards.length > 0
    ? `Zeitstrahl "${timelineItem.name}" wirklich löschen?\n\n${cardHint}`
    : `Zeitstrahl "${timelineItem.name}" wirklich löschen?`;

  if (!confirm(message)) return;

  timelines = timelines.filter((item) => item.id !== timelineId);
  markDataChanged();

  if (timelineCards.length > 0) {
    await removeCards(timelineCards.map((card) => card.id));
  }

  activateTimeline(activeTimelineId === timelineId ? timelines[0].id : activeTimelineId);
  resetForm();
  renderTimelines();
  setFormStatus("Zeitstrahl gelöscht.");
}

function showEditor() {
  if (!isUnlocked) return;
  appShell.classList.remove("editor-hidden");
  toggleEditorButton.textContent = "Edit";
  toggleEditorButton.setAttribute("aria-expanded", "true");
  addTimelineButton.hidden = false;
  importDataButton.hidden = false;
  exportDataButton.hidden = false;
  updateProjectDescriptionState();
  renderTimelines();
}

function hideEditor() {
  appShell.classList.add("editor-hidden");
  toggleEditorButton.textContent = "Edit";
  toggleEditorButton.setAttribute("aria-expanded", "false");
  addTimelineButton.hidden = true;
  importDataButton.hidden = true;
  exportDataButton.hidden = true;
  updateProjectDescriptionState();
  renderTimelines();
}

function unlockEditor() {
  const password = prompt("Kennwort für den Edit-Modus:");
  if (password !== EDIT_PASSWORD) {
    setFormStatus("Kennwort nicht korrekt.", true);
    return false;
  }

  isUnlocked = true;
  document.body.classList.remove("locked");
  setFormStatus("");
  showEditor();
  return true;
}

function toggleEditor() {
  if (!isUnlocked) {
    unlockEditor();
    return;
  }
  if (appShell.classList.contains("editor-hidden")) {
    showEditor();
  } else {
    hideEditor();
  }
}

function cardTimelineId(card) {
  return card.timelineId || timelines[0]?.id || "";
}

function renderCardsForTimeline(timelineItem, timelineCards) {
  if (timelineCards.length === 0) {
    return `<div class="timeline empty" style="--timeline-line-width:100%">
      <p class="timeline-empty">Noch keine Karten in diesem Zeitstrahl.</p>
    </div>`;
  }

  const lineWidth = `${timelineCards.length * 410}px`;
  return `<div class="timeline" style="--timeline-line-width:${lineWidth}">
    ${timelineCards.map((card) => `
      <article class="timeline-item">
        <span class="timeline-date">${escapeHtml(timelineLabel(card))}</span>
        <div class="timeline-card" style="background:${card.color}">
          <div class="card-top">
            <h3 class="card-title">${escapeHtml(card.title)}</h3>
            <div class="icon-actions">
              <button class="icon-button card-edit-action" type="button" data-action="edit" data-id="${card.id}" title="Bearbeiten" aria-label="Karte bearbeiten">&#9998;</button>
              <button class="icon-button card-delete-action" type="button" data-action="delete" data-id="${card.id}" title="Löschen" aria-label="Karte löschen">&times;</button>
            </div>
          </div>
          <p class="card-text">${escapeHtml(card.description)}</p>
        </div>
      </article>
    `).join("")}
  </div>`;
}

function renderTimelines() {
  cards = sortCards(cards);
  addTimelineButton.disabled = timelines.length >= MAX_TIMELINES;
  exportAllPdfButton.disabled = cards.length === 0;
  addTimelineButton.hidden = appShell.classList.contains("editor-hidden");
  const isViewMode = appShell.classList.contains("editor-hidden");

  timelineList.innerHTML = timelines.map((timelineItem) => {
    const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineItem.id);
    return `<section class="timeline-section" data-timeline-id="${timelineItem.id}">
      <div class="timeline-section-header">
        <div>
          <label class="sr-only" for="timelineName-${escapeHtml(timelineItem.id)}">Name des Zeitstrahls</label>
          <input class="timeline-title-input" id="timelineName-${escapeHtml(timelineItem.id)}" data-action="rename-timeline" data-timeline-id="${escapeHtml(timelineItem.id)}" maxlength="100" value="${escapeHtml(timelineItem.name)}" ${isViewMode ? "readonly" : ""}>
        </div>
        <div class="timeline-section-actions">
          <button class="secondary-button" type="button" data-action="export-timeline" data-timeline-id="${timelineItem.id}" ${timelineCards.length === 0 ? "disabled" : ""}>PDF</button>
          <button class="secondary-button timeline-card-add-action" type="button" data-action="add-card" data-timeline-id="${timelineItem.id}">+ Karte</button>
          <button class="secondary-button timeline-delete-action" type="button" data-action="delete-timeline" data-timeline-id="${timelineItem.id}" ${timelines.length <= 1 ? "disabled" : ""}>Zeitstrahl löschen</button>
        </div>
      </div>
      ${renderCardsForTimeline(timelineItem, timelineCards)}
    </section>`;
  }).join("");
}

async function refreshCards() {
  renderTimelines();
}

async function loadProjectMeta() {
  const meta = projectMeta;
  const title = meta.title && meta.title !== "Projekt-Zeitstrahl"
    ? meta.title
    : DEFAULT_PROJECT_TITLE;
  const hasDescription = Object.prototype.hasOwnProperty.call(meta, "description");
  const description = hasDescription ? meta.description : DEFAULT_PROJECT_DESCRIPTION;
  projectTitleInput.value = title;
  projectDescriptionInput.value = description;
  document.title = title;
  resizeProjectTitle();

  if (title !== meta.title || description !== meta.description) {
    await saveProjectMeta({ title, description });
  }
}

function applyEditState() {
  document.body.classList.toggle("locked", !isUnlocked);
  if (!isUnlocked) {
    appShell.classList.add("editor-hidden");
  }
  addTimelineButton.disabled = timelines.length >= MAX_TIMELINES;
  exportAllPdfButton.disabled = cards.length === 0;
  addTimelineButton.hidden = appShell.classList.contains("editor-hidden");
  importDataButton.hidden = appShell.classList.contains("editor-hidden");
  exportDataButton.hidden = appShell.classList.contains("editor-hidden");
  toggleEditorButton.disabled = false;
  updateProjectDescriptionState();

  renderTimelines();
}

function updateProjectDescriptionState() {
  const isViewMode = !isUnlocked || appShell.classList.contains("editor-hidden");
  projectTitleInput.readOnly = isViewMode;
  projectDescriptionInput.readOnly = isViewMode;
}

function debounce(callback, wait = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), wait);
  };
}

const persistProjectMeta = debounce(async () => {
  if (!isUnlocked) return;
  const title = projectTitleInput.value.trim() || DEFAULT_PROJECT_TITLE;
  const description = projectDescriptionInput.value.trim();
  document.title = title;
  await saveProjectMeta({ title, description });
});

const persistTimelinesMeta = debounce(async () => {
  await saveTimelinesMeta(timelines);
  updateActiveTimelineLabel();
});

function safeFilePart(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "karte";
}

function fileTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    date.getFullYear()
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function wrapText(value, maxChars) {
  const lines = [];
  const paragraphs = value.split(/\r?\n/);

  paragraphs.forEach((paragraph) => {
    let line = "";
    paragraph.split(/\s+/).forEach((word) => {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    lines.push(line);
  });

  return lines.filter(Boolean);
}

function pdfString(value) {
  return `(${String(value)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")})`;
}

function pdfTextLine(commands, text, x, y, font = "F1", size = 11) {
  commands.push(`BT /${font} ${size} Tf ${x} ${y} Td ${pdfString(text)} Tj ET`);
}

function pdfPlainText(value) {
  return String(value)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/Ä/g, "Ae")
    .replace(/Ö/g, "Oe")
    .replace(/Ü/g, "Ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "");
}

function pdfCenteredTextLine(commands, text, centerX, y, font = "F1", size = 11) {
  const width = pdfPlainText(text).length * size * (font === "F2" ? 0.58 : 0.52);
  pdfTextLine(commands, text, centerX - (width / 2), y, font, size);
}

function getJpegSize(bytes) {
  let index = 2;
  while (index < bytes.length) {
    if (bytes[index] !== 0xff) break;
    const marker = bytes[index + 1];
    const length = (bytes[index + 2] << 8) + bytes[index + 3];
    if (marker >= 0xc0 && marker <= 0xc3) {
      return {
        height: (bytes[index + 5] << 8) + bytes[index + 6],
        width: (bytes[index + 7] << 8) + bytes[index + 8]
      };
    }
    index += 2 + length;
  }
  return { width: 260, height: 120 };
}

async function loadPdfLogo() {
  const response = await fetch(`logo-gsl.jpg?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, ...getJpegSize(bytes) };
}

function pdfHeaderCommands({ headerTitle, dataStatusText, pageNumber, pageCount, logo }) {
  const commands = [
    "1 1 1 rg",
    "0 0 595.28 841.89 re f",
    "0 0 0 rg"
  ];

  if (logo) {
    const imageWidth = 96;
    const imageHeight = imageWidth * (logo.height / logo.width);
    commands.push("q");
    commands.push(`${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} 52 ${(798 - imageHeight).toFixed(2)} cm`);
    commands.push("/ImLogo Do");
    commands.push("Q");
  }

  pdfTextLine(commands, headerTitle, 166, 792, "F2", 18);
  pdfTextLine(commands, dataStatusText, 166, 770, "F1", 9);
  commands.push("0.72 0.76 0.80 RG");
  commands.push("0.8 w");
  commands.push("52 742 m 543 742 l S");
  commands.push("0 0 0 rg");
  pdfTextLine(commands, `Seite ${pageNumber} / ${pageCount}`, 482, 28, "F1", 9);

  return commands;
}

function cardContentCommands(card, indexOnPage, topY) {
  const marginX = 64;
  const bottomY = 62;
  const sectionHeight = (topY - bottomY) / 3;
  const sectionTop = topY - (indexOnPage * sectionHeight) - 18;
  const commands = [
    "0 0 0 rg"
  ];
  const label = timelineLabel(card);
  const titleLines = wrapText(card.title, 44).slice(0, 2);
  const descriptionLines = wrapText(card.description, 86).slice(0, 6);

  let y = sectionTop;
  titleLines.forEach((line) => {
    pdfTextLine(commands, line, marginX, y, "F2", 17);
    y -= 22;
  });

  y -= 4;
  if (label) {
    pdfTextLine(commands, label, marginX, y, "F2", 10);
    y -= 28;
  } else {
    y -= 12;
  }

  descriptionLines.forEach((line) => {
    pdfTextLine(commands, line, marginX, y, "F1", 10.5);
    y -= 15;
  });

  if (indexOnPage < 2) {
    const lineWidth = 595.28 * 0.66;
    const lineX = (595.28 - lineWidth) / 2;
    const lineY = topY - ((indexOnPage + 1) * sectionHeight);
    commands.push("0.72 0.76 0.80 RG");
    commands.push("0.8 w");
    commands.push(`${lineX.toFixed(2)} ${lineY.toFixed(2)} m ${(lineX + lineWidth).toFixed(2)} ${lineY.toFixed(2)} l S`);
    commands.push("0 0 0 rg");
  }

  return commands;
}

function pageContentStream(page) {
  const commands = pdfHeaderCommands(page);
  const cardTopY = 672;

  pdfCenteredTextLine(commands, page.timelineTitle, 297.64, 700, "F2", 18);

  page.cards.forEach((card, index) => {
    commands.push(...cardContentCommands(card, index, cardTopY));
  });

  return commands.join("\n");
}

async function buildPdf(pages) {
  const encoder = new TextEncoder();
  const logo = await loadPdfLogo();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  let logoObjectId = null;
  if (logo) {
    logoObjectId = objects.length + 1;
    objects.push([
      encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.bytes.length} >>\nstream\n`),
      logo.bytes,
      encoder.encode("\nendstream")
    ]);
  }
  const pageObjectIds = [];
  const pageCount = pages.length;

  pages.forEach((page, index) => {
    const content = pageContentStream({
      ...page,
      logo,
      pageNumber: index + 1,
      pageCount
    });
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);

    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    const xObjects = logoObjectId ? `/XObject << /ImLogo ${logoObjectId} 0 R >>` : "";
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> ${xObjects} >> /Contents ${contentId} 0 R >>`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const chunks = [encoder.encode("%PDF-1.4\n")];
  const offsets = [0];
  let position = chunks[0].length;

  objects.forEach((object, index) => {
    offsets[index + 1] = position;
    const objectHeader = encoder.encode(`${index + 1} 0 obj\n`);
    const objectBody = Array.isArray(object) ? object : [encoder.encode(object)];
    const objectFooter = encoder.encode("\nendobj\n");
    const objectLength = objectHeader.length
      + objectBody.reduce((sum, part) => sum + part.length, 0)
      + objectFooter.length;
    chunks.push(objectHeader, ...objectBody, objectFooter);
    position += objectLength;
  });

  const xrefStart = position;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefStart),
    "%%EOF"
  ].join("\n");
  chunks.push(encoder.encode(xref));

  return new Blob(chunks, { type: "application/pdf" });
}

function chunkCards(cardList) {
  const chunks = [];
  for (let index = 0; index < cardList.length; index += 3) {
    chunks.push(cardList.slice(index, index + 3));
  }
  return chunks;
}

function buildAllPdfPages() {
  const headerTitle = projectMeta.title || DEFAULT_PROJECT_TITLE;
  const dataStatusText = `Stand: ${formatLoadedAt(dataLoadedAt)}`;
  return timelines.flatMap((timelineItem) => {
    const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineItem.id);
    return chunkCards(timelineCards).map((pageCards) => ({
      headerTitle,
      dataStatusText,
      timelineTitle: timelineItem.name,
      cards: pageCards
    }));
  });
}

function buildTimelinePdfPages(timelineItem, timelineCards) {
  const dataStatusText = `Stand: ${formatLoadedAt(dataLoadedAt)}`;
  const headerTitle = projectMeta.title || DEFAULT_PROJECT_TITLE;
  return chunkCards(timelineCards).map((pageCards) => ({
    headerTitle,
    dataStatusText,
    timelineTitle: timelineItem.name,
    cards: pageCards
  }));
}

async function downloadPdf(pages, fileName) {
  const url = URL.createObjectURL(await buildPdf(pages));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function exportAllCards() {
  if (cards.length === 0) return;
  syncVisibleDataBeforeExport();
  await downloadPdf(
    buildAllPdfPages(),
    `${safeFilePart(projectMeta.title || DEFAULT_PROJECT_TITLE)}_${fileTimestamp()}.pdf`
  );
}

async function exportTimeline(timelineId) {
  syncVisibleDataBeforeExport();
  const timelineItem = timelines.find((item) => item.id === timelineId);
  if (!timelineItem) return;

  const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineId);
  if (timelineCards.length === 0) return;

  await downloadPdf(
    buildTimelinePdfPages(timelineItem, timelineCards),
    `${safeFilePart(timelineItem.name)}_${fileTimestamp()}.pdf`
  );
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireUnlocked()) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    setFormStatus("Bitte Überschrift und Text ausfüllen.", true);
    return;
  }

  const dateValue = dateInput.value.trim();
  const periodValue = periodInput.value.trim().slice(0, 40);
  const parsedDate = dateValue ? parseDateInput(dateValue) || nativeDateInput.value : "";
  const sortDateValue = sortDateInput.value.trim();
  const parsedSortDate = sortDateValue ? parseDateInput(sortDateValue) || nativeSortDateInput.value : "";
  if (dateValue && !parsedDate) {
    setFormStatus("Bitte das Datum als TT.MM.JJJJ eingeben.", true);
    dateInput.focus();
    return;
  }

  if (sortDateValue && !parsedSortDate) {
    setFormStatus("Bitte das Sortierdatum als TT.MM.JJJJ eingeben.", true);
    sortDateInput.focus();
    return;
  }

  if (!parsedDate && !periodValue) {
    setFormStatus("Bitte Datum oder Zeitraum ausfüllen.", true);
    dateInput.focus();
    return;
  }

  const idValue = cardIdInput.value;
  const existingCard = idValue ? cards.find((cardItem) => cardItem.id === Number(idValue)) : null;
  const card = {
    title: titleInput.value.trim().slice(0, 60),
    date: parsedDate,
    period: periodValue,
    sortDate: parsedSortDate,
    description: descriptionInput.value.trim().slice(0, 500),
    color: selectedColor(),
    timelineId: existingCard?.timelineId || cardTimelineIdInput.value || activeTimelineId || timelines[0].id,
    updatedAt: new Date().toISOString()
  };

  if (idValue) card.id = Number(idValue);
  if (!card.title || (!card.date && !card.period) || !card.description) {
    setFormStatus("Bitte Überschrift, Datum oder Zeitraum und Text ausfüllen.", true);
    return;
  }

  saveButton.disabled = true;
  setFormStatus("Speichere...");

  try {
    await saveCard(card);
    await refreshCards();
    resetForm();
    setFormStatus("Karte gespeichert.");
  } catch (error) {
    console.error(error);
    setFormStatus(`Die Karte konnte nicht gespeichert werden: ${error?.message || error}`, true);
  } finally {
    saveButton.disabled = false;
  }
}

async function deleteById(id) {
  if (!requireUnlocked()) return;
  const card = cards.find((item) => item.id === id);
  if (!card) return;
  if (!confirm(`Karte "${card.title}" wirklich löschen?`)) return;

  await removeCard(id);
  await refreshCards();
  if (Number(cardIdInput.value) === id) resetForm();
}

timelineList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  if (button.dataset.action === "add-card") {
    startNewCard(button.dataset.timelineId);
    return;
  }

  if (button.dataset.action === "export-timeline") {
    await exportTimeline(button.dataset.timelineId);
    return;
  }

  if (button.dataset.action === "delete-timeline") {
    await deleteTimeline(button.dataset.timelineId);
    return;
  }

  const id = Number(button.dataset.id);

  if (button.dataset.action === "edit") editCard(id);
  if (button.dataset.action === "delete") await deleteById(id);
});

timelineList.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-action='rename-timeline']");
  if (!input) return;
  if (appShell.classList.contains("editor-hidden")) return;

  const timelineItem = timelines.find((item) => item.id === input.dataset.timelineId);
  if (!timelineItem) return;

  timelineItem.name = input.value.trim().slice(0, 100) || "Zeitstrahl";
  persistTimelinesMeta();
});

timelineList.addEventListener("blur", (event) => {
  const input = event.target.closest("input[data-action='rename-timeline']");
  if (!input) return;
  if (appShell.classList.contains("editor-hidden")) return;

  input.value = input.value.trim() || "Zeitstrahl";
  const timelineItem = timelines.find((item) => item.id === input.dataset.timelineId);
  if (!timelineItem) return;

  timelineItem.name = input.value;
  saveTimelinesMeta(timelines);
  updateActiveTimelineLabel();
}, true);

form.addEventListener("submit", handleSubmit);
form.addEventListener("invalid", () => {
  setFormStatus("Bitte Überschrift und Text ausfüllen.", true);
}, true);
saveButton.addEventListener("click", () => {
  if (!form.checkValidity()) {
    setFormStatus("Bitte Überschrift und Text ausfüllen.", true);
  } else if (dateInput.value.trim() && !parseDateInput(dateInput.value)) {
    setFormStatus("Bitte das Datum als TT.MM.JJJJ eingeben.", true);
  } else if (sortDateInput.value.trim() && !parseDateInput(sortDateInput.value)) {
    setFormStatus("Bitte das Sortierdatum als TT.MM.JJJJ eingeben.", true);
  } else if (!dateInput.value.trim() && !periodInput.value.trim()) {
    setFormStatus("Bitte Datum oder Zeitraum ausfüllen.", true);
  }
});
titleInput.addEventListener("input", updateCounters);
periodInput.addEventListener("input", updateCounters);
dateInput.addEventListener("input", syncNativeDateInput);
dateInput.addEventListener("blur", () => {
  const parsedDate = parseDateInput(dateInput.value);
  if (parsedDate) {
    dateInput.value = formatDate(parsedDate);
    nativeDateInput.value = parsedDate;
  }
});
nativeDateInput.addEventListener("change", () => {
  if (nativeDateInput.value) {
    dateInput.value = formatDate(nativeDateInput.value);
    setFormStatus("");
  }
});
datePickerButton.addEventListener("click", () => {
  syncNativeDateInput();
  if (typeof nativeDateInput.showPicker === "function") {
    nativeDateInput.showPicker();
  } else {
    nativeDateInput.click();
  }
});
sortDateInput.addEventListener("input", syncNativeSortDateInput);
sortDateInput.addEventListener("blur", () => {
  const parsedDate = parseDateInput(sortDateInput.value);
  if (parsedDate) {
    sortDateInput.value = formatDate(parsedDate);
    nativeSortDateInput.value = parsedDate;
  }
});
nativeSortDateInput.addEventListener("change", () => {
  if (nativeSortDateInput.value) {
    sortDateInput.value = formatDate(nativeSortDateInput.value);
    setFormStatus("");
  }
});
sortDatePickerButton.addEventListener("click", () => {
  syncNativeSortDateInput();
  if (typeof nativeSortDateInput.showPicker === "function") {
    nativeSortDateInput.showPicker();
  } else {
    nativeSortDateInput.click();
  }
});
descriptionInput.addEventListener("input", updateCounters);
cancelEditButton.addEventListener("click", resetForm);
addTimelineButton.addEventListener("click", addTimeline);
exportAllPdfButton.addEventListener("click", exportAllCards);
toggleEditorButton.addEventListener("click", toggleEditor);
projectTitleInput.addEventListener("input", () => {
  resizeProjectTitle();
  persistProjectMeta();
});
projectDescriptionInput.addEventListener("input", persistProjectMeta);
importDataButton.addEventListener("click", () => {
  if (!requireUnlocked()) return;
  importDataInput.click();
});
importDataInput.addEventListener("change", async () => {
  await importSharedData(importDataInput.files?.[0]);
  importDataInput.value = "";
});
exportDataButton.addEventListener("click", exportSharedData);
deleteCurrentButton.addEventListener("click", async () => {
  if (!cardIdInput.value) return;
  await deleteById(Number(cardIdInput.value));
});
window.timelineProjectApp = {
  buildPdf,
  exportAllCards,
  exportTimeline,
  exportSharedData
};

document.addEventListener("DOMContentLoaded", async () => {
  renderColorOptions();
  updateCounters();
  deleteCurrentButton.disabled = true;

  try {
    await loadSharedData();
    await loadProjectMeta();
    applyEditState();
    await refreshCards();
  } catch (error) {
    timelineList.innerHTML = `<p class="timeline-empty">Die zentrale Datendatei konnte nicht geöffnet werden.</p>`;
    updateDataStatus(`data.json konnte nicht geladen werden: ${error?.message || error}`, true);
    console.error(error);
  }
});
