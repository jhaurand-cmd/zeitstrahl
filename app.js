const DB_NAME = "projectTimelineDb";
const STORE_NAME = "cards";
const META_STORE_NAME = "projectMeta";
const DB_VERSION = 2;

const colors = [
  { name: "Himmel", value: "#dff0ff" },
  { name: "Mint", value: "#ddf7e8" },
  { name: "Zitrone", value: "#fff7c7" },
  { name: "Rose", value: "#ffe2e7" },
  { name: "Flieder", value: "#efe5ff" },
  { name: "Aprikose", value: "#ffe8d1" },
  { name: "Salbei", value: "#e7f0dc" },
  { name: "Nebel", value: "#edf1f5" }
];

let db;
let cards = [];

const form = document.querySelector("#cardForm");
const cardIdInput = document.querySelector("#cardId");
const titleInput = document.querySelector("#titleInput");
const dateInput = document.querySelector("#dateInput");
const nativeDateInput = document.querySelector("#nativeDateInput");
const datePickerButton = document.querySelector("#datePickerButton");
const descriptionInput = document.querySelector("#descriptionInput");
const titleCount = document.querySelector("#titleCount");
const descriptionCount = document.querySelector("#descriptionCount");
const colorGrid = document.querySelector("#colorGrid");
const timeline = document.querySelector("#timeline");
const cardSummary = document.querySelector("#cardSummary");
const exportAllButton = document.querySelector("#exportAllButton");
const deleteCurrentButton = document.querySelector("#deleteCurrentButton");
const cancelEditButton = document.querySelector("#cancelEditButton");
const newCardButton = document.querySelector("#newCardButton");
const toggleEditorButton = document.querySelector("#toggleEditorButton");
const appShell = document.querySelector(".app-shell");
const projectTitleInput = document.querySelector("#projectTitleInput");
const projectDescriptionInput = document.querySelector("#projectDescriptionInput");
const formStatus = document.querySelector("#formStatus");
const saveButton = form.querySelector("button[type='submit']");
const lockButton = document.querySelector("#lockButton");
const passwordDialog = document.querySelector("#passwordDialog");
const passwordForm = document.querySelector("#passwordForm");
const passwordTitle = document.querySelector("#passwordTitle");
const passwordHelp = document.querySelector("#passwordHelp");
const passwordInput = document.querySelector("#passwordInput");
const passwordConfirmInput = document.querySelector("#passwordConfirmInput");
const passwordStatus = document.querySelector("#passwordStatus");
const cancelPasswordButton = document.querySelector("#cancelPasswordButton");
let isUnlocked = false;
let hasPassword = false;

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

function getSecurityMeta() {
  return new Promise((resolve, reject) => {
    const request = metaTransaction().get("security");
    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

function saveSecurityMeta(value) {
  return new Promise((resolve, reject) => {
    const request = metaTransaction("readwrite").put({ key: "security", value });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function sortCards(list) {
  return [...list].sort((a, b) => {
    if (a.date === b.date) return a.id - b.id;
    return a.date.localeCompare(b.date);
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
  descriptionCount.textContent = descriptionInput.value.length;
}

function setFormStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.classList.toggle("error", isError);
}

function selectedColor() {
  return form.elements.color.value || colors[0].value;
}

function requireUnlocked() {
  if (isUnlocked) return true;
  openPasswordDialog();
  return false;
}

function resetForm() {
  if (!requireUnlocked()) return;
  form.reset();
  cardIdInput.value = "";
  nativeDateInput.value = "";
  form.elements.color.value = colors[0].value;
  deleteCurrentButton.disabled = true;
  updateCounters();
  setFormStatus("");
  showEditor();
  titleInput.focus();
}

function editCard(id) {
  if (!requireUnlocked()) return;
  const card = cards.find((item) => item.id === id);
  if (!card) return;

  cardIdInput.value = card.id;
  titleInput.value = card.title;
  dateInput.value = formatDate(card.date);
  nativeDateInput.value = card.date;
  descriptionInput.value = card.description;
  form.elements.color.value = card.color;
  deleteCurrentButton.disabled = false;
  updateCounters();
  showEditor();
  titleInput.focus();
}

function showEditor() {
  if (!isUnlocked) return;
  appShell.classList.remove("editor-hidden");
  toggleEditorButton.textContent = "Editor ausblenden";
  toggleEditorButton.setAttribute("aria-expanded", "true");
}

function hideEditor() {
  appShell.classList.add("editor-hidden");
  toggleEditorButton.textContent = "Editor einblenden";
  toggleEditorButton.setAttribute("aria-expanded", "false");
}

function toggleEditor() {
  if (!requireUnlocked()) return;
  if (appShell.classList.contains("editor-hidden")) {
    showEditor();
  } else {
    hideEditor();
  }
}

function renderTimeline() {
  cards = sortCards(cards);
  exportAllButton.disabled = cards.length === 0;
  cardSummary.textContent = cards.length === 0
    ? "Noch keine Karten gespeichert."
    : `${cards.length} ${cards.length === 1 ? "Karte" : "Karten"} gespeichert.`;

  if (cards.length === 0) {
    timeline.style.setProperty("--timeline-line-width", "100%");
    timeline.innerHTML = `<p class="timeline-empty">Erstelle links die erste Karte fuer deinen Projekt-Zeitstrahl.</p>`;
    return;
  }

  timeline.style.setProperty("--timeline-line-width", `${cards.length * 410}px`);

  timeline.innerHTML = cards.map((card) => `
    <article class="timeline-item">
      <div class="timeline-card" style="background:${card.color}">
        <div class="card-top">
          <h3 class="card-title">${escapeHtml(card.title)}</h3>
          <div class="icon-actions">
            <button class="icon-button card-edit-action" type="button" data-action="edit" data-id="${card.id}" title="Bearbeiten" aria-label="Karte bearbeiten">&#9998;</button>
            <button class="icon-button" type="button" data-action="pdf" data-id="${card.id}" title="Als PDF exportieren" aria-label="Karte als PDF exportieren">PDF</button>
            <button class="icon-button card-delete-action" type="button" data-action="delete" data-id="${card.id}" title="Loeschen" aria-label="Karte loeschen">&times;</button>
          </div>
        </div>
        <time class="card-date" datetime="${card.date}">${formatDate(card.date)}</time>
        <p class="card-text">${escapeHtml(card.description)}</p>
      </div>
    </article>
  `).join("");
}

async function refreshCards() {
  cards = await getAllCards();
  renderTimeline();
}

async function loadProjectMeta() {
  const meta = await getProjectMeta();
  projectTitleInput.value = meta.title || "Projekt-Zeitstrahl";
  projectDescriptionInput.value = meta.description || "";
  document.title = projectTitleInput.value || "Projekt-Zeitstrahl";
}

async function loadSecurityMeta() {
  const security = await getSecurityMeta();
  hasPassword = Boolean(security?.passwordHash && security?.salt);
  isUnlocked = false;
  applyLockState();
}

function applyLockState() {
  document.body.classList.toggle("locked", !isUnlocked);
  projectTitleInput.readOnly = !isUnlocked;
  projectDescriptionInput.readOnly = !isUnlocked;
  newCardButton.disabled = !isUnlocked;
  toggleEditorButton.disabled = !isUnlocked;
  lockButton.textContent = isUnlocked ? "Bearbeitung sperren" : "Bearbeiten entsperren";
  lockButton.classList.toggle("primary-button", !isUnlocked);
  lockButton.classList.toggle("secondary-button", isUnlocked);

  if (!isUnlocked) {
    appShell.classList.add("editor-hidden");
    toggleEditorButton.textContent = "Editor einblenden";
    toggleEditorButton.setAttribute("aria-expanded", "false");
  }

  renderTimeline();
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

async function hashPassword(password, salt) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return bytesToHex(new Uint8Array(digest));
}

function openPasswordDialog() {
  if (passwordDialog.open) return;
  passwordForm.reset();
  passwordStatus.textContent = "";
  passwordStatus.classList.remove("error");
  passwordDialog.classList.toggle("setup", !hasPassword);
  passwordTitle.textContent = hasPassword ? "Bearbeitung entsperren" : "Kennwort festlegen";
  passwordHelp.textContent = hasPassword
    ? "Gib das Kennwort ein, um das Board zu bearbeiten."
    : "Lege ein Kennwort fest. Danach kann das Board nur damit bearbeitet werden.";
  passwordConfirmInput.required = !hasPassword;
  passwordDialog.showModal();
  passwordInput.focus();
}

function closePasswordDialog() {
  passwordDialog.close();
}

function lockBoard() {
  isUnlocked = false;
  applyLockState();
}

async function unlockOrSetPassword(event) {
  event.preventDefault();
  const password = passwordInput.value;

  if (!password) return;

  if (!hasPassword) {
    if (password.length < 4) {
      passwordStatus.textContent = "Das Kennwort muss mindestens 4 Zeichen haben.";
      passwordStatus.classList.add("error");
      return;
    }

    if (password !== passwordConfirmInput.value) {
      passwordStatus.textContent = "Die Kennwoerter stimmen nicht ueberein.";
      passwordStatus.classList.add("error");
      return;
    }

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);
    await saveSecurityMeta({ salt, passwordHash });
    hasPassword = true;
    isUnlocked = true;
    closePasswordDialog();
    applyLockState();
    showEditor();
    return;
  }

  const security = await getSecurityMeta();
  const passwordHash = await hashPassword(password, security.salt);

  if (passwordHash !== security.passwordHash) {
    passwordStatus.textContent = "Das Kennwort ist falsch.";
    passwordStatus.classList.add("error");
    return;
  }

  isUnlocked = true;
  closePasswordDialog();
  applyLockState();
  showEditor();
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
  const title = projectTitleInput.value.trim() || "Projekt-Zeitstrahl";
  const description = projectDescriptionInput.value.trim();
  document.title = title;
  await saveProjectMeta({ title, description });
});

function safeFilePart(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "karte";
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255
  ];
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
  const [r, g, b] = hexToRgb(card.color);
  const titleLines = wrapText(card.title, 36).slice(0, 2);
  const descriptionLines = wrapText(card.description, 82).slice(0, 24);
  const commands = [
    "q",
    `${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg`,
    "56 94 483 690 re f",
    "0.70 0.70 0.70 RG",
    "56 94 483 690 re S",
    "Q",
    "0 0 0 rg"
  ];

  let y = 742;
  titleLines.forEach((line) => {
    commands.push("BT /F2 22 Tf 70 " + y + " Td " + pdfText(line) + " Tj ET");
    y -= 28;
  });

  commands.push("BT /F2 13 Tf 70 " + (y - 8) + " Td " + pdfText(formatDate(card.date)) + " Tj ET");
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
  downloadPdf([card], `${card.date}-${safeFilePart(card.title)}.pdf`);
}

function exportAllCards() {
  if (cards.length === 0) return;
  downloadPdf(cards, "projekt-zeitstrahl-alle-karten.pdf");
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!requireUnlocked()) return;

  if (!form.checkValidity()) {
    form.reportValidity();
    setFormStatus("Bitte Ueberschrift, Datum und Text ausfuellen.", true);
    return;
  }

  const parsedDate = parseDateInput(dateInput.value) || nativeDateInput.value;
  if (!parsedDate) {
    setFormStatus("Bitte das Datum als TT.MM.JJJJ eingeben.", true);
    dateInput.focus();
    return;
  }

  const idValue = cardIdInput.value;
  const card = {
    title: titleInput.value.trim().slice(0, 60),
    date: parsedDate,
    description: descriptionInput.value.trim().slice(0, 500),
    color: selectedColor(),
    updatedAt: new Date().toISOString()
  };

  if (idValue) card.id = Number(idValue);
  if (!card.title || !card.date || !card.description) {
    setFormStatus("Bitte Ueberschrift, Datum und Text ausfuellen.", true);
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
  if (!confirm(`Karte "${card.title}" wirklich loeschen?`)) return;

  await removeCard(id);
  await refreshCards();
  if (Number(cardIdInput.value) === id) resetForm();
}

timeline.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const id = Number(button.dataset.id);
  const card = cards.find((item) => item.id === id);

  if (button.dataset.action === "edit") editCard(id);
  if (button.dataset.action === "delete") await deleteById(id);
  if (button.dataset.action === "pdf" && card) exportCard(card);
});

form.addEventListener("submit", handleSubmit);
form.addEventListener("invalid", () => {
  setFormStatus("Bitte Ueberschrift, Datum und Text ausfuellen.", true);
}, true);
saveButton.addEventListener("click", () => {
  if (!form.checkValidity()) {
    setFormStatus("Bitte Ueberschrift, Datum und Text ausfuellen.", true);
  } else if (!parseDateInput(dateInput.value)) {
    setFormStatus("Bitte das Datum als TT.MM.JJJJ eingeben.", true);
  }
});
titleInput.addEventListener("input", updateCounters);
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
descriptionInput.addEventListener("input", updateCounters);
cancelEditButton.addEventListener("click", resetForm);
newCardButton.addEventListener("click", resetForm);
toggleEditorButton.addEventListener("click", toggleEditor);
lockButton.addEventListener("click", () => {
  if (isUnlocked && hasPassword) {
    lockBoard();
  } else {
    openPasswordDialog();
  }
});
passwordForm.addEventListener("submit", unlockOrSetPassword);
cancelPasswordButton.addEventListener("click", closePasswordDialog);
projectTitleInput.addEventListener("input", persistProjectMeta);
projectDescriptionInput.addEventListener("input", persistProjectMeta);
deleteCurrentButton.addEventListener("click", async () => {
  if (!cardIdInput.value) return;
  await deleteById(Number(cardIdInput.value));
});
exportAllButton.addEventListener("click", exportAllCards);

window.timelineProjectApp = {
  buildPdf,
  exportCard,
  exportAllCards
};

document.addEventListener("DOMContentLoaded", async () => {
  renderColorOptions();
  updateCounters();
  deleteCurrentButton.disabled = true;

  try {
    db = await openDatabase();
    await loadProjectMeta();
    await loadSecurityMeta();
    await refreshCards();
  } catch (error) {
    timeline.innerHTML = `<p class="timeline-empty">Die lokale Datenbank konnte nicht geoeffnet werden.</p>`;
    console.error(error);
  }
});
