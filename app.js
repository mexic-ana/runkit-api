const AUTH_URL = "https://auth.analissamoreno.com";
const API_URL = "https://api.analissamoreno.com";

let unit = "F";
let stravaConnected = false;
let locationGranted = false;
let selectedActivity = null;
let activitiesPage = 1;
let allActivities = [];
let currentSubCat = null;
let authToken = null;
let editingLogId = null;
let collapsedSections = {
  tops: false,
  bottoms: false,
  accessories: false,
  feedback: false,
  notes: false,
};

const checked = { tops: new Set(), bottoms: new Set(), accessories: new Set() };
const hiddenItems = {
  tops: new Set(),
  bottoms: new Set(),
  accessories: new Set(),
};
const clothing = {
  tops: [
    "Sports bra",
    "Short sleeve",
    "Long sleeve",
    "Base layer",
    "Jacket",
    "Vest",
    "Hoodie",
  ],
  bottoms: ["Shorts", "Tights", "Capris", "Wind pants"],
  accessories: [
    "Gloves",
    "Hat",
    "Beanie",
    "Buff/gaiter",
    "Sunglasses",
    "Arm warmers",
  ],
};

let logs = [];

async function loadLogs() {
  try {
    const response = await fetch(`${API_URL}/logs`);
    logs = await response.json();
    // Also keep localStorage in sync as backup
    try {
      localStorage.setItem("rk_logs", JSON.stringify(logs));
    } catch (e) {}
  } catch (err) {
    console.error("Load logs error:", err);
    // Fall back to localStorage if API fails
    try {
      logs = JSON.parse(localStorage.getItem("rk_logs") || "[]");
    } catch (e) {}
  }
}

// Check if returning from Strava OAuth
function checkAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get("auth");
  const token = params.get("token");

  if (auth === "success" && token) {
    authToken = token;
    localStorage.setItem("rk_token", token);
    stravaConnected = true;
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    finishOnboard();
  } else if (auth === "error") {
    window.history.replaceState({}, document.title, window.location.pathname);
    alert("Strava connection failed. Please try again.");
  }
}

// Load saved state
function loadSavedState() {
  const savedToken = localStorage.getItem("rk_token");
  if (savedToken) {
    authToken = savedToken;
    stravaConnected = true;
  }
  const savedUnit = localStorage.getItem("rk_unit");
  if (savedUnit) unit = savedUnit;
}

function toC(f) {
  return Math.round(((f - 32) * 5) / 9);
}
function displayTemp(f) {
  return unit === "F" ? f + "°" : toC(f) + "°";
}

function setUnit(u) {
  unit = u;
  localStorage.setItem("rk_unit", u);
  document.getElementById("unit-select").value = u;
  if (selectedActivity && selectedActivity.weather)
    updateWeatherDisplay(selectedActivity);
  renderHistory();
}

function showScreen(name) {
  [
    "onboard1",
    "onboard2",
    "activities",
    "log",
    "history",
    "settings",
    "clothing-sub",
  ].forEach((s) => {
    const el = document.getElementById("screen-" + s);
    if (el) el.style.display = "none";
  });
  document.getElementById("screen-" + name).style.display = "block";
}

function navTo(name) {
  showScreen(name);
  ["activities", "history", "settings"].forEach((n) => {
    document.getElementById("nav-" + n).classList.toggle("active", n === name);
  });
  if (name === "history") renderHistory();
  if (name === "settings") renderSettings();
  if (name === "activities") renderActivities();
}

function connectStrava() {
  window.location.href = `${AUTH_URL}/strava/connect`;
}

function doLaterStrava() {
  showScreen("onboard2");
}

function closeModal() {
  document.getElementById("modal-location").style.display = "none";
}

function finishOnboard() {
  closeModal();
  document.getElementById("bottom-nav").style.display = "flex";
  navTo("activities");
  setupPushNotifications();
}

async function setupPushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        "BI0gLlY_ZUA9QO6jf-WpZbkeRxlimQ0Y0CbUxi_vbXwygTBcRhFhzdvgFoBy-VDxg-PHzLUqukaGagBk6Qxa6Ko",
    });

    await fetch(`${API_URL}/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription }),
    });

    console.log("Push notifications enabled!");
  } catch (err) {
    console.error("Push setup error:", err);
  }
}

function logGoBack() {
  if (editingLogId) {
    editingLogId = null;
    navTo("history");
  } else {
    showScreen("activities");
    renderActivities();
  }
}

async function renderActivities() {
  const inner = document.getElementById("activities-inner");

  if (!stravaConnected) {
    inner.innerHTML = `<div class="empty-state">Connect Strava in <strong>Settings</strong> to load your activities.</div>`;
    return;
  }

  inner.innerHTML = `<div class="empty-state">Loading activities...</div>`;

  try {
    const response = await fetch(
      `${API_URL}/activities?page=${activitiesPage}&per_page=10`,
    );
    const data = await response.json();
    if (activitiesPage === 1) {
      allActivities = data.activities;
    } else {
      allActivities = [...allActivities, ...data.activities];
    }

    const loggedIds = new Set(logs.map((l) => l.activityId));
    let html = "";

    const typeFilter = document.getElementById("type-filter")?.value || "all";
    const filtered =
      typeFilter === "all"
        ? allActivities
        : allActivities.filter((a) => a.type === typeFilter);

    filtered.forEach((act) => {
      const logged = loggedIds.has(act.id);
      html += `<div class="activity-row" onclick="selectActivity('${act.id}')">
        <div class="activity-icon">${getActivityEmoji(act.type)}</div>
        <div class="activity-info">
          <div class="activity-name">${act.name}</div>
          <div class="activity-meta">${act.distance} · ${act.duration} · ${act.date}</div>
        </div>
        ${logged ? '<div class="logged-dot"></div>' : '<div class="chevron">›</div>'}
      </div>`;
    });

    if (data.activities.length === 10) {
      html += `<button class="load-more-btn" onclick="loadMore()">Load more activities</button>`;
    }

    inner.innerHTML = html;
  } catch (err) {
    inner.innerHTML = `<div class="empty-state">Failed to load activities. Check your connection.</div>`;
    console.error(err);
  }
}

function getActivityEmoji(type) {
  const map = { Run: "🏃🏻‍♀️", Walk: "🚶🏻‍♀️", Ride: "🚴🏻‍♀️", Swim: "🏊🏻‍♀️", Hike: "🥾" };
  return map[type] || "🏃🏻‍♀️";
}

function loadMore() {
  const scrollY = window.scrollY;
  activitiesPage++;
  renderActivities().then(() => {
    window.scrollTo(0, scrollY);
  });
}

async function selectActivity(id) {
  // If already logged, open in edit mode instead
  const existingLog = logs.find((l) => String(l.activityId) === String(id));
  if (existingLog) {
    editLog(existingLog.id);
    return;
  }

  document.getElementById("save-btn").textContent = "Save log";
  editingLogId = null;
  document.getElementById("delete-btn").style.display = "none";

  selectedActivity = allActivities.find((a) => String(a.id) === String(id));
  if (!selectedActivity) return;

  checked.tops.clear();
  checked.bottoms.clear();
  checked.accessories.clear();
  document.getElementById("worked-well").value = "";
  document.getElementById("would-change").value = "";
  document.getElementById("notes-input").value = "";

  document.getElementById("sel-card").innerHTML = `
    <div class="sel-icon">${getActivityEmoji(selectedActivity.type)}</div>
    <div>
      <div class="sel-name">${selectedActivity.name}</div>
      <div class="sel-meta">${selectedActivity.distance} · ${selectedActivity.duration} · ${selectedActivity.date}</div>
    </div>`;

  document.getElementById("log-temp").textContent = "--°";
  document.getElementById("log-feels").textContent = "Fetching weather...";
  document.getElementById("log-cond").textContent = "";

  renderClothing();
  showScreen("log");

  // Fetch real weather
  if (
    selectedActivity.start_latlng &&
    selectedActivity.start_latlng.length === 2
  ) {
    try {
      const [lat, lng] = selectedActivity.start_latlng;
      const res = await fetch(
        `${API_URL}/weather?lat=${lat}&lng=${lng}&date=${selectedActivity.start_date}`,
      );
      const weather = await res.json();
      selectedActivity.weather = weather;
      updateWeatherDisplay(selectedActivity);
      showSuggestion(weather.temp_f);
    } catch (err) {
      console.error(err);
    }
  }
}

function updateWeatherDisplay(act) {
  if (!act.weather) return;
  document.getElementById("log-temp").textContent = displayTemp(
    act.weather.temp_f,
  );
  document.getElementById("log-feels").textContent =
    "Feels like " + displayTemp(act.weather.feels_like_f);
  document.getElementById("log-cond").textContent = [
    act.weather.condition,
    act.weather.humidity ? act.weather.humidity + "% humidity" : null,
    act.weather.dew_point_f
      ? "Dew point " + displayTemp(act.weather.dew_point_f)
      : null,
    act.weather.city || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function renderClothing() {
  ["tops", "bottoms", "accessories"].forEach((cat) => {
    const grid = document.getElementById(cat + "-grid");
    const header = document.getElementById(cat + "-header");
    const collapsed = collapsedSections[cat];
    const vis = clothing[cat].filter((i) => !hiddenItems[cat].has(i));

    if (header) {
      header.innerHTML = `
        <div class="section-header" onclick="toggleSection('${cat}')">
          <span class="section-title">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          <span class="section-chevron">${collapsed ? "›" : "⌄"}</span>
        </div>`;
    }

    grid.style.display = collapsed ? "none" : "grid";
    grid.innerHTML = vis
      .map(
        (item) => `
      <div class="clothing-item ${checked[cat].has(item) ? "checked" : ""}" onclick="toggleItem('${cat}','${encodeURIComponent(item)}')">
        <div class="c-check"><div class="c-dot"></div></div>
        <span class="clothing-label">${item}</span>
      </div>`,
      )
      .join("");
  });
}

function toggleSection(cat) {
  collapsedSections[cat] = !collapsedSections[cat];
  renderClothing();
}

function toggleItem(cat, enc) {
  const item = decodeURIComponent(enc);
  checked[cat].has(item) ? checked[cat].delete(item) : checked[cat].add(item);
  renderClothing();
}

function toggleCardSection(section) {
  collapsedSections[section] = !collapsedSections[section];
  const content = document.getElementById(section + "-content");
  const chevron = document.getElementById(section + "-chevron");
  if (content)
    content.style.display = collapsedSections[section] ? "none" : "block";
  if (chevron) chevron.textContent = collapsedSections[section] ? "›" : "⌄";
}

function addItem() {
  const input = document.getElementById("new-item-input");
  const cat = document.getElementById("section-picker").value;
  const val = input.value.trim();
  if (!val) return;
  if (!clothing[cat].includes(val)) clothing[cat].push(val);
  input.value = "";
  renderClothing();
}

async function saveLog() {
  const worn = [...checked.tops, ...checked.bottoms, ...checked.accessories];

  const logData = editingLogId
    ? {
        id: editingLogId,
        activityId: logs.find((l) => l.id === editingLogId)?.activityId,
        activityName: logs.find((l) => l.id === editingLogId)?.activityName,
        activityMeta: logs.find((l) => l.id === editingLogId)?.activityMeta,
        tempF: logs.find((l) => l.id === editingLogId)?.tempF,
        feelsF: logs.find((l) => l.id === editingLogId)?.feelsF,
        condition: logs.find((l) => l.id === editingLogId)?.condition,
        humidity: logs.find((l) => l.id === editingLogId)?.humidity,
        dewPointF: logs.find((l) => l.id === editingLogId)?.dew_point_f,
        city: logs.find((l) => l.id === editingLogId)?.city,
        date: logs.find((l) => l.id === editingLogId)?.date,
        worn,
        workedWell: document.getElementById("worked-well").value.trim(),
        wouldChange: document.getElementById("would-change").value.trim(),
        notes: document.getElementById("notes-input").value.trim(),
      }
    : {
        id: Date.now(),
        activityId: selectedActivity.id,
        activityName: selectedActivity.name,
        activityMeta:
          selectedActivity.distance + " · " + selectedActivity.duration,
        tempF: selectedActivity.weather?.temp_f || null,
        feelsF: selectedActivity.weather?.feels_like_f || null,
        condition: selectedActivity.weather?.condition || null,
        humidity: selectedActivity.weather?.humidity || null,
        dewPointF: selectedActivity.weather?.dew_point_f || null,
        city: selectedActivity.weather?.city || null,
        worn,
        workedWell: document.getElementById("worked-well").value.trim(),
        wouldChange: document.getElementById("would-change").value.trim(),
        notes: document.getElementById("notes-input").value.trim(),
        date: selectedActivity.date,
      };

  try {
    await fetch(`${API_URL}/logs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logData),
    });

    await loadLogs();
  } catch (err) {
    console.error("Save log error:", err);
  }

  editingLogId = null;
  navTo("history");
}

function editLog(id) {
  const log = logs.find((l) => String(l.id) === String(id));
  if (!log) return;

  editingLogId = id;

  // Pre-fill clothing
  checked.tops.clear();
  checked.bottoms.clear();
  checked.accessories.clear();
  log.worn?.forEach((item) => {
    if (clothing.tops.includes(item)) checked.tops.add(item);
    else if (clothing.bottoms.includes(item)) checked.bottoms.add(item);
    else checked.accessories.add(item);
  });

  // Pre-fill feedback and notes
  document.getElementById("worked-well").value = log.workedWell || "";
  document.getElementById("would-change").value = log.wouldChange || "";
  document.getElementById("notes-input").value = log.notes || "";

  // Set up the activity card
  document.getElementById("sel-card").innerHTML = `
    <div class="sel-icon">🏃‍♀️</div>
    <div>
      <div class="sel-name">${log.activityName}</div>
      <div class="sel-meta">${log.activityMeta || ""} · ${log.date}</div>
    </div>`;

  // Set up weather display
  document.getElementById("log-temp").textContent = log.tempF
    ? displayTemp(log.tempF)
    : "--°";
  document.getElementById("log-feels").textContent = log.feelsF
    ? "Feels like " + displayTemp(log.feelsF)
    : "--";
  document.getElementById("log-cond").textContent = log.condition || "--";

  // Update save button
  document.getElementById("save-btn").textContent = "Update log";
  document.getElementById("delete-btn").style.display = "block";

  renderClothing();
  showScreen("log");
}

async function deleteLog(id) {
  try {
    await fetch(`${API_URL}/logs/${id}`, { method: "DELETE" });
    await loadLogs();
  } catch (err) {
    console.error("Delete log error:", err);
  }
  renderHistory();
}

function confirmDelete() {
  if (!confirm("Delete this log?")) return;
  deleteLog(editingLogId);
  navTo("history");
}

function getTempRange(f) {
  if (!f) return "unknown";
  if (f < 40) return "cold";
  if (f < 55) return "cool";
  if (f < 65) return "mild";
  if (f < 75) return "warm";
  return "hot";
}

function renderHistory() {
  const q =
    (document.getElementById("search-input") || {}).value?.toLowerCase() || "";
  const rf = (document.getElementById("range-filter") || {}).value || "all";
  const list = document.getElementById("history-list");
  if (!list) return;

  const filtered = logs.filter((l) => {
    const range = rf === "all" || getTempRange(l.tempF) === rf;
    const text = [
      l.activityName,
      l.worn?.join(" "),
      l.workedWell,
      l.wouldChange,
      l.notes,
    ]
      .join(" ")
      .toLowerCase();
    return range && (!q || text.includes(q));
  });

  if (!filtered.length) {
    list.innerHTML =
      '<div class="empty-state">No logs yet.<br>Tap an activity to log your outfit.</div>';
    return;
  }

  list.innerHTML = filtered
    .map(
      (l) => `
    <div class="log-item" onclick="editLog('${l.id}')">
      <div class="log-header">
        <div>
          <div class="log-temp">${l.tempF ? displayTemp(l.tempF) : "--°"}</div>
          <div class="log-act-name">${l.activityName}${l.activityMeta ? " · " + l.activityMeta : ""}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <div class="log-date">${l.date}</div>
          <div class="log-edit-hint">Tap to edit ›</div>
        </div>
      </div>
      ${l.worn?.length ? `<div class="log-clothes">${l.worn.map((w) => `<span class="clothes-tag">${w}</span>`).join("")}</div>` : ""}
      ${
        l.workedWell || l.wouldChange
          ? `<div class="log-feedback">
        ${l.workedWell ? `<span class="feedback-pill worked">+ ${l.workedWell.substring(0, 28)}${l.workedWell.length > 28 ? "…" : ""}</span>` : ""}
        ${l.wouldChange ? `<span class="feedback-pill change">~ ${l.wouldChange.substring(0, 28)}${l.wouldChange.length > 28 ? "…" : ""}</span>` : ""}
      </div>`
          : ""
      }
      ${l.notes ? `<div class="log-notes">${l.notes.substring(0, 90)}${l.notes.length > 90 ? "…" : ""}</div>` : ""}
    </div>`,
    )
    .join("");
}

function renderSettings() {
  document.getElementById("strava-settings-block").innerHTML =
    `<div class="srow">
    ${
      stravaConnected
        ? `<div style="display:flex;align-items:center;"><span class="strava-dot"></span><span class="srow-label">Connected</span></div>
         <button class="text-btn danger" onclick="disconnectStrava()">Disconnect</button>`
        : `<span class="srow-label">Not connected</span>
         <button class="text-btn orange" onclick="connectStrava()">Connect</button>`
    }
  </div>`;

  ["tops", "bottoms", "accessories"].forEach((cat) => {
    const total = clothing[cat].length;
    const hidden = hiddenItems[cat].size;
    const el = document.getElementById("count-" + cat);
    if (el)
      el.textContent =
        hidden > 0 ? `${total - hidden} of ${total}` : `${total}`;
  });
}

function disconnectStrava() {
  authToken = null;
  stravaConnected = false;
  localStorage.removeItem("rk_token");
  fetch(`${AUTH_URL}/strava/disconnect`);
  renderSettings();
  renderActivities();
}

function openClothingSub(cat) {
  currentSubCat = cat;
  const labels = {
    tops: "Tops",
    bottoms: "Bottoms",
    accessories: "Accessories",
  };
  document.getElementById("sub-title").textContent = labels[cat];
  document.getElementById("sub-add-input").value = "";
  renderSubItems();
  showScreen("clothing-sub");
}

function renderSubItems() {
  const list = document.getElementById("sub-items-list");
  list.innerHTML = clothing[currentSubCat]
    .map((item) => {
      const hidden = hiddenItems[currentSubCat].has(item);
      return `<div class="preset-row">
      <span class="preset-name${hidden ? " hidden-item" : ""}">${item}</span>
      <button class="preset-toggle" onclick="toggleHide('${currentSubCat}','${encodeURIComponent(item)}')">${hidden ? "Show" : "Hide"}</button>
      <button class="preset-remove" onclick="removePreset('${currentSubCat}','${encodeURIComponent(item)}')">×</button>
    </div>`;
    })
    .join("");
}

function toggleHide(cat, enc) {
  const item = decodeURIComponent(enc);
  hiddenItems[cat].has(item)
    ? hiddenItems[cat].delete(item)
    : hiddenItems[cat].add(item);
  renderSubItems();
}

function removePreset(cat, enc) {
  const item = decodeURIComponent(enc);
  clothing[cat] = clothing[cat].filter((i) => i !== item);
  hiddenItems[cat].delete(item);
  renderSubItems();
}

function addFromSub() {
  const input = document.getElementById("sub-add-input");
  const val = input.value.trim();
  if (!val || !currentSubCat) return;
  if (!clothing[currentSubCat].includes(val)) clothing[currentSubCat].push(val);
  input.value = "";
  renderSubItems();
}

function getSuggestion(tempF) {
  if (!tempF || logs.length === 0) return null;

  const similar = logs.filter((l) => l.tempF && Math.abs(l.tempF - tempF) <= 5);
  if (similar.length === 0) return null;

  // Count item frequency across similar logs
  const counts = {};
  similar.forEach((l) => {
    l.worn?.forEach((item) => {
      counts[item] = (counts[item] || 0) + 1;
    });
  });

  // Get items worn in majority of similar logs
  const threshold = Math.ceil(similar.length / 2);
  const suggested = Object.entries(counts)
    .filter(([_, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([item]) => item);

  if (suggested.length === 0) return null;
  return { items: suggested, count: similar.length, temp: tempF };
}

function showSuggestion(tempF) {
  const suggestion = getSuggestion(tempF);
  const existing = document.getElementById("suggestion-card");
  if (existing) existing.remove();
  if (!suggestion) return;

  const card = document.createElement("div");
  card.id = "suggestion-card";
  card.className = "card";
  card.style.borderColor = "#0F1F3D";
  card.innerHTML = `
    <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:0.6px;color:var(--color-text-tertiary);margin-bottom:8px;">Based on ${suggestion.count} similar run${suggestion.count > 1 ? "s" : ""}</div>
    <div style="font-size:14px;color:var(--color-text-primary);margin-bottom:8px;">At similar temps you usually wore:</div>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${suggestion.items.map((item) => `<span class="clothes-tag" style="border-color:#0F1F3D;">${item}</span>`).join("")}
    </div>
  `;

  // Insert before the What I wore card
  const woreCard = document.getElementById("tops-header").closest(".card");
  woreCard.parentNode.insertBefore(card, woreCard);
}

// Init
loadSavedState();
checkAuthCallback();

if (stravaConnected) {
  loadLogs().then(() => {
    finishOnboard();
    setupPushNotifications();
  });
} else {
  showScreen("onboard1");
}
