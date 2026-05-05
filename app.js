const AUTH_URL = 'https://auth.analissamoreno.com';
const API_URL = 'https://api.analissamoreno.com';

let unit = 'F';
let stravaConnected = false;
let locationGranted = false;
let selectedActivity = null;
let activitiesPage = 1;
let allActivities = [];
let currentSubCat = null;
let authToken = null;
let editingLogId = null;

const checked = { tops: new Set(), bottoms: new Set(), accessories: new Set() };
const hiddenItems = { tops: new Set(), bottoms: new Set(), accessories: new Set() };
const clothing = {
  tops: ['Sports bra', 'Short sleeve', 'Long sleeve', 'Base layer', 'Jacket', 'Vest', 'Hoodie'],
  bottoms: ['Shorts', 'Tights', 'Capris', 'Wind pants'],
  accessories: ['Gloves', 'Hat', 'Beanie', 'Buff/gaiter', 'Sunglasses', 'Arm warmers']
};

let logs = [];
try { logs = JSON.parse(localStorage.getItem('rk_logs') || '[]'); } catch(e) {}

// Check if returning from Strava OAuth
function checkAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const auth = params.get('auth');
  const token = params.get('token');

  if (auth === 'success' && token) {
    authToken = token;
    localStorage.setItem('rk_token', token);
    stravaConnected = true;
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
    finishOnboard();
  } else if (auth === 'error') {
    window.history.replaceState({}, document.title, window.location.pathname);
    alert('Strava connection failed. Please try again.');
  }
}

// Load saved state
function loadSavedState() {
  const savedToken = localStorage.getItem('rk_token');
  if (savedToken) {
    authToken = savedToken;
    stravaConnected = true;
  }
  const savedUnit = localStorage.getItem('rk_unit');
  if (savedUnit) unit = savedUnit;
  const savedLocation = localStorage.getItem('rk_location');
  if (savedLocation) locationGranted = true;
}

function toC(f) { return Math.round((f - 32) * 5 / 9); }
function displayTemp(f) { return unit === 'F' ? f + '°' : toC(f) + '°'; }

function setUnit(u) {
  unit = u;
  localStorage.setItem('rk_unit', u);
  document.getElementById('unit-select').value = u;
  if (selectedActivity && selectedActivity.weather) updateWeatherDisplay(selectedActivity);
  renderHistory();
}

function showScreen(name) {
  ['onboard1', 'onboard2', 'activities', 'log', 'history', 'settings', 'clothing-sub'].forEach(s => {
    const el = document.getElementById('screen-' + s);
    if (el) el.style.display = 'none';
  });
  document.getElementById('screen-' + name).style.display = 'block';
}

function navTo(name) {
  showScreen(name);
  ['activities', 'history', 'settings'].forEach(n => {
    document.getElementById('nav-' + n).classList.toggle('active', n === name);
  });
  if (name === 'history') renderHistory();
  if (name === 'settings') renderSettings();
  if (name === 'activities') renderActivities();
}

function connectStrava() {
  window.location.href = `${AUTH_URL}/strava/connect`;
}

function doLaterStrava() { showScreen('onboard2'); }

function requestLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(() => {
      locationGranted = true;
      localStorage.setItem('rk_location', 'true');
      const btn = document.getElementById('location-allow-btn');
      if (btn) { btn.classList.add('success'); btn.innerHTML = '✓ Location allowed'; btn.onclick = null; }
      setTimeout(() => finishOnboard(), 800);
    }, () => {
      alert('Location access denied. You can enable it later in Settings.');
    });
  }
}

function doLaterLocation() {
  document.getElementById('modal-location').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-location').style.display = 'none';
}

function finishOnboard() {
  closeModal();
  document.getElementById('bottom-nav').style.display = 'flex';
  navTo('activities');
}

async function renderActivities() {
  const inner = document.getElementById('activities-inner');

  if (!stravaConnected) {
    inner.innerHTML = `<div class="empty-state">Connect Strava in <strong>Settings</strong> to load your activities.</div>`;
    return;
  }

  inner.innerHTML = `<div class="empty-state">Loading activities...</div>`;

  try {
    const response = await fetch(`${API_URL}/activities?page=${activitiesPage}&per_page=10`);
    const data = await response.json();
    if (activitiesPage === 1) {
      allActivities = data.activities;
    } else {
      allActivities = [...allActivities, ...data.activities];
    }

    const loggedIds = new Set(logs.map(l => l.activityId));
    let html = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
      <div class="strava-badge"><span>STRAVA</span></div>
      <span style="font-size:12px;color:var(--color-text-tertiary);font-family:var(--mono);">${allActivities.length} activities</span>
    </div>`;

    allActivities.forEach(act => {
      const logged = loggedIds.has(act.id);
      html += `<div class="activity-row" onclick="selectActivity(${act.id})">
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
  const map = { Run: '🏃', Walk: '🚶', Ride: '🚴', Swim: '🏊', Hike: '🥾' };
  return map[type] || '🏃';
}

function loadMore() {
  activitiesPage++;
  renderActivities();
}

async function selectActivity(id) {
  document.getElementById('save-btn').textContent = 'Save log';
  editingLogId = null;

  selectedActivity = allActivities.find(a => a.id === id);
  if (!selectedActivity) return;

  checked.tops.clear(); checked.bottoms.clear(); checked.accessories.clear();
  document.getElementById('worked-well').value = '';
  document.getElementById('would-change').value = '';
  document.getElementById('notes-input').value = '';

  document.getElementById('sel-card').innerHTML = `
    <div class="sel-icon">${getActivityEmoji(selectedActivity.type)}</div>
    <div>
      <div class="sel-name">${selectedActivity.name}</div>
      <div class="sel-meta">${selectedActivity.distance} · ${selectedActivity.duration} · ${selectedActivity.date}</div>
    </div>`;

  document.getElementById('log-temp').textContent = '--°';
  document.getElementById('log-feels').textContent = 'Fetching weather...';
  document.getElementById('log-cond').textContent = '';
  document.getElementById('log-ts').textContent = selectedActivity.date;

  renderClothing();
  showScreen('log');

  // Fetch real weather
  if (selectedActivity.start_latlng && selectedActivity.start_latlng.length === 2) {
    try {
      const [lat, lng] = selectedActivity.start_latlng;
      const res = await fetch(`${API_URL}/weather?lat=${lat}&lng=${lng}&date=${selectedActivity.start_date}`);
      const weather = await res.json();
      selectedActivity.weather = weather;
      updateWeatherDisplay(selectedActivity);
    } catch (err) {
      document.getElementById('log-feels').textContent = 'Weather unavailable';
      console.error(err);
    }
  }
}

function updateWeatherDisplay(act) {
  if (!act.weather) return;
  document.getElementById('log-temp').textContent = displayTemp(act.weather.temp_f);
  document.getElementById('log-feels').textContent = 'Feels like ' + displayTemp(act.weather.feels_like_f);
  document.getElementById('log-cond').textContent = act.weather.condition;
  document.getElementById('log-ts').textContent = act.date;
}

function renderClothing() {
  ['tops', 'bottoms', 'accessories'].forEach(cat => {
    const grid = document.getElementById(cat + '-grid');
    const vis = clothing[cat].filter(i => !hiddenItems[cat].has(i));
    grid.innerHTML = vis.map(item => `
      <div class="clothing-item ${checked[cat].has(item) ? 'checked' : ''}" onclick="toggleItem('${cat}','${encodeURIComponent(item)}')">
        <div class="c-check"><div class="c-dot"></div></div>
        <span class="clothing-label">${item}</span>
      </div>`).join('');
  });
}

function toggleItem(cat, enc) {
  const item = decodeURIComponent(enc);
  checked[cat].has(item) ? checked[cat].delete(item) : checked[cat].add(item);
  renderClothing();
}

function addItem() {
  const input = document.getElementById('new-item-input');
  const cat = document.getElementById('section-picker').value;
  const val = input.value.trim();
  if (!val) return;
  if (!clothing[cat].includes(val)) clothing[cat].push(val);
  input.value = '';
  renderClothing();
}

function saveLog() {
  const worn = [...checked.tops, ...checked.bottoms, ...checked.accessories];

  if (editingLogId) {
    // Edit existing log
    const index = logs.findIndex(l => l.id === editingLogId);
    if (index !== -1) {
      logs[index] = {
        ...logs[index],
        worn,
        workedWell: document.getElementById('worked-well').value.trim(),
        wouldChange: document.getElementById('would-change').value.trim(),
        notes: document.getElementById('notes-input').value.trim(),
      };
    }
    editingLogId = null;
  } else {
    // New log
    logs.unshift({
      id: Date.now(),
      activityId: selectedActivity.id,
      activityName: selectedActivity.name,
      activityMeta: selectedActivity.distance + ' · ' + selectedActivity.duration,
      tempF: selectedActivity.weather?.temp_f || null,
      feelsF: selectedActivity.weather?.feels_like_f || null,
      condition: selectedActivity.weather?.condition || null,
      worn,
      workedWell: document.getElementById('worked-well').value.trim(),
      wouldChange: document.getElementById('would-change').value.trim(),
      notes: document.getElementById('notes-input').value.trim(),
      date: selectedActivity.date
    });
  }

  try { localStorage.setItem('rk_logs', JSON.stringify(logs)); } catch(e) {}
  navTo('history');
}

function editLog(id) {
  const log = logs.find(l => l.id === id);
  if (!log) return;

  editingLogId = id;

  // Pre-fill clothing
  checked.tops.clear(); checked.bottoms.clear(); checked.accessories.clear();
  log.worn?.forEach(item => {
    if (clothing.tops.includes(item)) checked.tops.add(item);
    else if (clothing.bottoms.includes(item)) checked.bottoms.add(item);
    else checked.accessories.add(item);
  });

  // Pre-fill feedback and notes
  document.getElementById('worked-well').value = log.workedWell || '';
  document.getElementById('would-change').value = log.wouldChange || '';
  document.getElementById('notes-input').value = log.notes || '';

  // Set up the activity card
  document.getElementById('sel-card').innerHTML = `
    <div class="sel-icon">🏃‍♀️</div>
    <div>
      <div class="sel-name">${log.activityName}</div>
      <div class="sel-meta">${log.activityMeta || ''} · ${log.date}</div>
    </div>`;

  // Set up weather display
  document.getElementById('log-temp').textContent = log.tempF ? displayTemp(log.tempF) : '--°';
  document.getElementById('log-feels').textContent = log.feelsF ? 'Feels like ' + displayTemp(log.feelsF) : '--';
  document.getElementById('log-cond').textContent = log.condition || '--';
  document.getElementById('log-ts').textContent = log.date;

  // Update save button
  document.getElementById('save-btn').textContent = 'Update log';

  renderClothing();
  showScreen('log');
}

function deleteLog(id) {
  if (!confirm('Delete this log?')) return;
  logs = logs.filter(l => l.id !== id);
  try { localStorage.setItem('rk_logs', JSON.stringify(logs)); } catch(e) {}
  renderHistory();
}

function getTempRange(f) {
  if (!f) return 'unknown';
  if (f < 40) return 'cold'; if (f < 55) return 'cool';
  if (f < 65) return 'mild'; if (f < 75) return 'warm'; return 'hot';
}

function renderHistory() {
  const q = (document.getElementById('search-input') || {}).value?.toLowerCase() || '';
  const rf = (document.getElementById('range-filter') || {}).value || 'all';
  const list = document.getElementById('history-list');
  if (!list) return;

  const filtered = logs.filter(l => {
    const range = rf === 'all' || getTempRange(l.tempF) === rf;
    const text = [l.activityName, l.worn?.join(' '), l.workedWell, l.wouldChange, l.notes].join(' ').toLowerCase();
    return range && (!q || text.includes(q));
  });

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No logs yet.<br>Tap an activity to log your outfit.</div>';
    return;
  }

  list.innerHTML = filtered.map(l => `
    <div class="log-item">
      <div class="log-header">
        <div>
          <div class="log-temp">${l.tempF ? displayTemp(l.tempF) : '--°'}</div>
          <div class="log-act-name">${l.activityName}${l.activityMeta ? ' · ' + l.activityMeta : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <div class="log-date">${l.date}</div>
          <div style="display:flex;gap:8px;">
            <button class="log-action-btn" onclick="editLog(${l.id})">Edit</button>
            <button class="log-action-btn danger" onclick="deleteLog(${l.id})">Delete</button>
          </div>
        </div>
      </div>
      ${l.worn?.length ? `<div class="log-clothes">${l.worn.map(w => `<span class="clothes-tag">${w}</span>`).join('')}</div>` : ''}
      ${(l.workedWell || l.wouldChange) ? `<div class="log-feedback">
        ${l.workedWell ? `<span class="feedback-pill worked">+ ${l.workedWell.substring(0, 28)}${l.workedWell.length > 28 ? '…' : ''}</span>` : ''}
        ${l.wouldChange ? `<span class="feedback-pill change">~ ${l.wouldChange.substring(0, 28)}${l.wouldChange.length > 28 ? '…' : ''}</span>` : ''}
      </div>` : ''}
      ${l.notes ? `<div class="log-notes">${l.notes.substring(0, 90)}${l.notes.length > 90 ? '…' : ''}</div>` : ''}
    </div>`).join('');
}

function renderSettings() {
  document.getElementById('strava-settings-block').innerHTML = `<div class="srow">
    ${stravaConnected
      ? `<div style="display:flex;align-items:center;"><span class="strava-dot"></span><span class="srow-label">Connected</span></div>
         <button class="text-btn danger" onclick="disconnectStrava()">Disconnect</button>`
      : `<span class="srow-label">Not connected</span>
         <button class="text-btn orange" onclick="connectStrava()">Connect</button>`}
  </div>`;

  document.getElementById('location-settings-block').innerHTML = `<div class="srow">
    <div>
      <div class="srow-label">Location access</div>
      <div class="srow-sub">Required for hyperlocal weather at activity time</div>
    </div>
    ${locationGranted
      ? `<span style="font-size:13px;color:#3B6D11;font-weight:500;">Allowed</span>`
      : `<button class="text-btn orange" onclick="requestLocation()">Allow</button>`}
  </div>`;

  ['tops', 'bottoms', 'accessories'].forEach(cat => {
    const total = clothing[cat].length;
    const hidden = hiddenItems[cat].size;
    const el = document.getElementById('count-' + cat);
    if (el) el.textContent = hidden > 0 ? `${total - hidden} of ${total}` : `${total}`;
  });
}

function disconnectStrava() {
  authToken = null;
  stravaConnected = false;
  localStorage.removeItem('rk_token');
  fetch(`${AUTH_URL}/strava/disconnect`);
  renderSettings();
  renderActivities();
}

function openClothingSub(cat) {
  currentSubCat = cat;
  const labels = { tops: 'Tops', bottoms: 'Bottoms', accessories: 'Accessories' };
  document.getElementById('sub-title').textContent = labels[cat];
  document.getElementById('sub-add-input').value = '';
  renderSubItems();
  showScreen('clothing-sub');
}

function renderSubItems() {
  const list = document.getElementById('sub-items-list');
  list.innerHTML = clothing[currentSubCat].map(item => {
    const hidden = hiddenItems[currentSubCat].has(item);
    return `<div class="preset-row">
      <span class="preset-name${hidden ? ' hidden-item' : ''}">${item}</span>
      <button class="preset-toggle" onclick="toggleHide('${currentSubCat}','${encodeURIComponent(item)}')">${hidden ? 'Show' : 'Hide'}</button>
      <button class="preset-remove" onclick="removePreset('${currentSubCat}','${encodeURIComponent(item)}')">×</button>
    </div>`;
  }).join('');
}

function toggleHide(cat, enc) {
  const item = decodeURIComponent(enc);
  hiddenItems[cat].has(item) ? hiddenItems[cat].delete(item) : hiddenItems[cat].add(item);
  renderSubItems();
}

function removePreset(cat, enc) {
  const item = decodeURIComponent(enc);
  clothing[cat] = clothing[cat].filter(i => i !== item);
  hiddenItems[cat].delete(item);
  renderSubItems();
}

function addFromSub() {
  const input = document.getElementById('sub-add-input');
  const val = input.value.trim();
  if (!val || !currentSubCat) return;
  if (!clothing[currentSubCat].includes(val)) clothing[currentSubCat].push(val);
  input.value = '';
  renderSubItems();
}

// Init
loadSavedState();
checkAuthCallback();

if (stravaConnected) {
  finishOnboard();
} else {
  showScreen('onboard1');
}