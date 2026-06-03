const DB_NAME = "projectTimelineDb";
const STORE_NAME = "cards";
const META_STORE_NAME = "projectMeta";
const DB_VERSION = 2;
const MAX_TIMELINES = 6;
const DEFAULT_PROJECT_TITLE = "Schulentwicklungsprojekt";
const DEFAULT_PROJECT_DESCRIPTION = "Erläuterung";

const colors = [
  { name: "Himmel", value: "#dff0ff" },
  { name: "Mint", value: "#ddf7e8" },
  { name: "Zitrone", value: "#fff7c7" },
  { name: "Rose", value: "#ffe2e7" }
];

let db;
let cards = [];
let timelines = [];
let activeTimelineId = "";

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
const toggleEditorButton = document.querySelector("#toggleEditorButton");
const appShell = document.querySelector(".app-shell");
const activeTimelineLabel = document.querySelector("#activeTimelineLabel");
const projectTitleInput = document.querySelector("#projectTitleInput");
const projectDescriptionInput = document.querySelector("#projectDescriptionInput");
const formStatus = document.querySelector("#formStatus");
const saveButton = form.querySelector("button[type='submit']");
let isUnlocked = true;

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("date", "date", { unique: false });
      }

      if (!database.objectStoreNames.contains(META_STORE_NAME)) {
        database.createObjectStore(META_STORE_NAME, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode = "readonly") {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function metaTransaction(mode = "readonly") {
  return db.transaction(META_STORE_NAME, mode).objectStore(META_STORE_NAME);
}

function getAllCards() {
  return new Promise((resolve, reject) => {
    const request = transaction().getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveCard(card) {
  return new Promise((resolve, reject) => {
    const request = transaction("readwrite").put(card);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removeCard(id) {
  return new Promise((resolve, reject) => {
    const request = transaction("readwrite").delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function removeCards(ids) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    ids.forEach((id) => store.delete(id));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getProjectMeta() {
  return new Promise((resolve, reject) => {
    const request = metaTransaction().get("project");
    request.onsuccess = () => resolve(request.result?.value || {});
    request.onerror = () => reject(request.error);
  });
}

function saveProjectMeta(value) {
  return new Promise((resolve, reject) => {
    const request = metaTransaction("readwrite").put({ key: "project", value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function getTimelinesMeta() {
  return new Promise((resolve, reject) => {
    const request = metaTransaction().get("timelines");
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

function saveTimelinesMeta(value) {
  return new Promise((resolve, reject) => {
    const request = metaTransaction("readwrite").put({ key: "timelines", value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function createTimeline(name) {
  return {
    id: `timeline-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    createdAt: new Date().toISOString()
  };
}

async function loadTimelines() {
  const savedTimelines = await getTimelinesMeta();
  timelines = Array.isArray(savedTimelines) && savedTimelines.length > 0
    ? savedTimelines.slice(0, MAX_TIMELINES)
    : [createTimeline("Zeitstrahl 1")];
  activeTimelineId = timelines[0].id;

  if (!savedTimelines || savedTimelines.length === 0 || savedTimelines.length > MAX_TIMELINES) {
    await saveTimelinesMeta(timelines);
  }

  updateActiveTimelineLabel();
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
  return true;
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
  await saveTimelinesMeta(timelines);
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
  await saveTimelinesMeta(timelines);

  if (timelineCards.length > 0) {
    await removeCards(timelineCards.map((card) => card.id));
    cards = cards.filter((card) => cardTimelineId(card) !== timelineId);
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
  updateProjectDescriptionState();
  renderTimelines();
}

function hideEditor() {
  appShell.classList.add("editor-hidden");
  toggleEditorButton.textContent = "Edit";
  toggleEditorButton.setAttribute("aria-expanded", "false");
  addTimelineButton.hidden = true;
  updateProjectDescriptionState();
  renderTimelines();
}

function toggleEditor() {
  if (!requireUnlocked()) return;
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
              <button class="icon-button" type="button" data-action="pdf" data-id="${card.id}" title="Als PDF exportieren" aria-label="Karte als PDF exportieren">PDF</button>
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
  addTimelineButton.hidden = appShell.classList.contains("editor-hidden");
  const isViewMode = appShell.classList.contains("editor-hidden");

  timelineList.innerHTML = timelines.map((timelineItem) => {
    const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineItem.id);
    return `<section class="timeline-section" data-timeline-id="${timelineItem.id}">
      <div class="timeline-section-header">
        <div>
          <label class="sr-only" for="timelineName-${escapeHtml(timelineItem.id)}">Name des Zeitstrahls</label>
          <input class="timeline-title-input" id="timelineName-${escapeHtml(timelineItem.id)}" data-action="rename-timeline" data-timeline-id="${escapeHtml(timelineItem.id)}" maxlength="60" value="${escapeHtml(timelineItem.name)}" ${isViewMode ? "readonly" : ""}>
        </div>
        <div class="timeline-section-actions">
          <button class="secondary-button" type="button" data-action="export-timeline" data-timeline-id="${timelineItem.id}" ${timelineCards.length === 0 ? "disabled" : ""}>Alle als PDF</button>
          <button class="secondary-button timeline-card-add-action" type="button" data-action="add-card" data-timeline-id="${timelineItem.id}">+ Karte</button>
          <button class="secondary-button timeline-delete-action" type="button" data-action="delete-timeline" data-timeline-id="${timelineItem.id}" ${timelines.length <= 1 ? "disabled" : ""}>Zeitstrahl löschen</button>
        </div>
      </div>
      ${renderCardsForTimeline(timelineItem, timelineCards)}
    </section>`;
  }).join("");
}

async function refreshCards() {
  cards = await getAllCards();
  renderTimelines();
}

async function loadProjectMeta() {
  const meta = await getProjectMeta();
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
  document.body.classList.remove("locked");
  addTimelineButton.disabled = timelines.length >= MAX_TIMELINES;
  addTimelineButton.hidden = appShell.classList.contains("editor-hidden");
  toggleEditorButton.disabled = !isUnlocked;
  updateProjectDescriptionState();

  renderTimelines();
}

function updateProjectDescriptionState() {
  const isViewMode = appShell.classList.contains("editor-hidden");
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

function pdfText(value) {
  const bytes = [0xfe, 0xff];
  for (const char of value) {
    const code = char.charCodeAt(0);
    bytes.push((code >> 8) & 255, code & 255);
  }
  return `<${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}>`;
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

function cardContentStream(card) {
  const titleLines = wrapText(card.title, 36).slice(0, 2);
  const descriptionLines = wrapText(card.description, 82).slice(0, 24);
  const commands = [
    "q",
    "1 1 1 rg",
    "56 94 483 690 re f",
    "0 0 0 RG",
    "56 94 483 690 re S",
    "Q",
    "0 0 0 rg"
  ];

  let y = 742;
  titleLines.forEach((line) => {
    commands.push("BT /F2 22 Tf 70 " + y + " Td " + pdfText(line) + " Tj ET");
    y -= 28;
  });

  commands.push("BT /F2 13 Tf 70 " + (y - 8) + " Td " + pdfText(timelineLabel(card)) + " Tj ET");
  y -= 46;

  descriptionLines.forEach((line) => {
    commands.push("BT /F1 12 Tf 70 " + y + " Td " + pdfText(line) + " Tj ET");
    y -= 18;
  });

  return commands.join("\n");
}

function buildPdf(cardList) {
  const encoder = new TextEncoder();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];
  const pageObjectIds = [];

  cardList.forEach((card) => {
    const content = cardContentStream(card);
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}\nendstream`);

    const pageId = objects.length + 1;
    pageObjectIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const chunks = [encoder.encode("%PDF-1.4\n")];
  const offsets = [0];
  let position = chunks[0].length;

  objects.forEach((object, index) => {
    offsets[index + 1] = position;
    const chunk = encoder.encode(`${index + 1} 0 obj\n${object}\nendobj\n`);
    chunks.push(chunk);
    position += chunk.length;
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

function downloadPdf(cardList, fileName) {
  const url = URL.createObjectURL(buildPdf(cardList));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCard(card) {
  const prefix = card.date || safeFilePart(card.period || "zeitraum");
  downloadPdf([card], `${prefix}-${safeFilePart(card.title)}.pdf`);
}

function exportAllCards() {
  if (cards.length === 0) return;
  downloadPdf(cards, "projekt-zeitstrahl-alle-karten.pdf");
}

function exportTimeline(timelineId) {
  const timelineItem = timelines.find((item) => item.id === timelineId);
  if (!timelineItem) return;

  const timelineCards = cards.filter((card) => cardTimelineId(card) === timelineId);
  if (timelineCards.length === 0) return;

  downloadPdf(timelineCards, `${safeFilePart(timelineItem.name)}-alle-karten.pdf`);
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
    exportTimeline(button.dataset.timelineId);
    return;
  }

  if (button.dataset.action === "delete-timeline") {
    await deleteTimeline(button.dataset.timelineId);
    return;
  }

  const id = Number(button.dataset.id);
  const card = cards.find((item) => item.id === id);

  if (button.dataset.action === "edit") editCard(id);
  if (button.dataset.action === "delete") await deleteById(id);
  if (button.dataset.action === "pdf" && card) exportCard(card);
});

timelineList.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-action='rename-timeline']");
  if (!input) return;
  if (appShell.classList.contains("editor-hidden")) return;

  const timelineItem = timelines.find((item) => item.id === input.dataset.timelineId);
  if (!timelineItem) return;

  timelineItem.name = input.value.trim().slice(0, 60) || "Zeitstrahl";
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
toggleEditorButton.addEventListener("click", toggleEditor);
projectTitleInput.addEventListener("input", () => {
  resizeProjectTitle();
  persistProjectMeta();
});
projectDescriptionInput.addEventListener("input", persistProjectMeta);
deleteCurrentButton.addEventListener("click", async () => {
  if (!cardIdInput.value) return;
  await deleteById(Number(cardIdInput.value));
});
window.timelineProjectApp = {
  buildPdf,
  exportCard,
  exportAllCards,
  exportTimeline
};

document.addEventListener("DOMContentLoaded", async () => {
  renderColorOptions();
  updateCounters();
  deleteCurrentButton.disabled = true;

  try {
    db = await openDatabase();
    await loadProjectMeta();
    await loadTimelines();
    applyEditState();
    await refreshCards();
  } catch (error) {
    timelineList.innerHTML = `<p class="timeline-empty">Die lokale Datenbank konnte nicht geöffnet werden.</p>`;
    console.error(error);
  }
});
