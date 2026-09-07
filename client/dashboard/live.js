// ─── Socket.io Live Updates & Dashboard Logic ───

const API_BASE = window.location.origin;
let socket;

// ─── Tab Navigation ───
function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');

    const btn = document.querySelector(`.nav-btn[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');

    // Load tab-specific data
    if (tabName === 'predictions') loadPredictions();
    if (tabName === 'alerts') loadAlerts();

    // Fix Leaflet map rendering on tab switch
    if (tabName === 'live' && typeof map !== 'undefined' && map) {
        setTimeout(() => map.invalidateSize(), 100);
    }
}

// ─── Socket.io Connection ───
function initSocket() {
    socket = io(API_BASE);

    socket.on('connect', () => {
        console.log('🔌 Connected to server');
        updateConnectionStatus(true);
        socket.emit('request-update');
    });

    socket.on('disconnect', () => {
        console.log('⚡ Disconnected');
        updateConnectionStatus(false);
    });

    socket.on('connect_error', () => {
        updateConnectionStatus(false);
    });

    socket.on('zone-update', (data) => {
        console.log('📊 Zone update received', data.timestamp);
        handleZoneUpdate(data.zones);
    });

    socket.on('overcrowd-alert', (alert) => {
        console.log('🚨 Alert:', alert);
        showAlertBanner(alert);
        addAlertToLog(alert);
    });
}

function updateConnectionStatus(connected) {
    const dot = document.getElementById('connDot');
    const text = document.getElementById('connText');
    if (dot) dot.className = 'conn-dot ' + (connected ? 'connected' : 'error');
    if (text) text.textContent = connected ? 'Connected' : 'Disconnected';
}

// ─── Handle Zone Update ───
function handleZoneUpdate(zones) {
    if (!zones || zones.length === 0) return;

    // Store zone names for chart labels
    zones.forEach(z => { zoneNames[z.zoneId] = z.name; });

    // Update sidebar stats
    const totalCount = zones.reduce((sum, z) => sum + z.currentCount, 0);
    const alertCount = zones.filter(z => z.status === 'red').length;
    setText('totalOnCampus', totalCount.toLocaleString());
    setText('zonesMonitored', zones.length);
    setText('activeAlerts', alertCount);
    setText('lastUpdated', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    // Update map
    if (typeof updateMapZones === 'function') {
        updateMapZones(zones);
    }

    // Update zone grid cards
    updateZoneGrid(zones);

    // Update zone table
    updateZoneTable(zones);

    // Update charts
    populateChartSelect(zones);
    updateCrowdChart(zones);
}

// ─── Zone Grid Cards ───
function updateZoneGrid(zones) {
    const grid = document.getElementById('zoneGrid');
    if (!grid) return;

    grid.innerHTML = zones.map(zone => {
        const percent = zone.maxCapacity > 0 ? Math.round((zone.currentCount / zone.maxCapacity) * 100) : 0;
        const clampedPercent = Math.min(percent, 100);
        return `
      <div class="zone-card-dash ${zone.status} ${zone.isPredicted ? 'predicted' : ''}">
        <div class="zcd-name">
          ${zone.name}
          ${zone.isPredicted ? '<span class="zcd-predicted-badge">Predicted</span>' : ''}
        </div>
        <div class="zcd-count">${zone.currentCount}</div>
        <div class="zcd-meta">
          <div class="zcd-bar">
            <div class="zcd-bar-fill ${zone.status}" style="width: ${clampedPercent}%"></div>
          </div>
          <span class="zcd-percent">${percent}%</span>
        </div>
      </div>
    `;
    }).join('');
}

// ─── Zone Table ───
function updateZoneTable(zones) {
    const tbody = document.getElementById('zoneTableBody');
    if (!tbody) return;

    tbody.innerHTML = zones.map(zone => {
        const percent = zone.maxCapacity > 0 ? Math.round((zone.currentCount / zone.maxCapacity) * 100) : 0;
        return `
      <tr class="${zone.isPredicted ? 'predicted-row' : ''}">
        <td><strong>${zone.name}</strong></td>
        <td>${zone.currentCount}</td>
        <td>${zone.maxCapacity}</td>
        <td>${percent}%</td>
        <td><span class="status-badge ${zone.status}">${zone.status}</span></td>
        <td><span class="source-badge ${zone.isPredicted ? 'predicted' : 'actual'}">${zone.isPredicted ? '🤖 Predicted' : '📡 Actual'}</span></td>
      </tr>
    `;
    }).join('');
}

// ─── Alert Banner ───
function showAlertBanner(alert) {
    const banner = document.getElementById('alertBanner');
    const msg = document.getElementById('alertMessage');
    if (!banner || !msg) return;

    const icon = alert.severity === 'critical' ? '🚨' : '⚠️';
    msg.textContent = `${icon} ${alert.zoneName} is ${alert.severity === 'critical' ? 'OVERCROWDED' : 'near capacity'} — ${alert.count}/${alert.capacity} people`;
    banner.classList.add('visible');

    // Auto-dismiss after 10 seconds
    setTimeout(() => dismissAlert(), 10000);

    // Browser notification
    if (Notification.permission === 'granted') {
        new Notification(`${alert.severity === 'critical' ? '🚨' : '⚠️'} ${alert.zoneName}`, {
            body: `${alert.count}/${alert.capacity} people — ${alert.severity}`,
            icon: '/student/manifest.json'
        });
    }
}

function dismissAlert() {
    const banner = document.getElementById('alertBanner');
    if (banner) banner.classList.remove('visible');
}

// ─── Alert Log ───
function addAlertToLog(alert) {
    const list = document.getElementById('alertList');
    if (!list) return;

    // Remove empty state
    const empty = list.querySelector('.empty-state');
    if (empty) empty.remove();

    const time = new Date(alert.triggeredAt);
    const item = document.createElement('div');
    item.className = `alert-item ${alert.severity}`;
    item.innerHTML = `
    <div class="alert-severity">${alert.severity === 'critical' ? '🚨' : '⚠️'}</div>
    <div class="alert-details">
      <div class="alert-zone-name">${alert.zoneName}</div>
      <div class="alert-info">${alert.count} / ${alert.capacity} people</div>
    </div>
    <div class="alert-time">${time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br>${time.toLocaleDateString()}</div>
  `;

    list.insertBefore(item, list.firstChild);
}

// ─── Load Alerts ───
async function loadAlerts() {
    try {
        const res = await fetch(`${API_BASE}/api/zones/alerts`);
        const data = await res.json();
        const list = document.getElementById('alertList');
        if (!list || !data.alerts) return;

        if (data.alerts.length === 0) {
            list.innerHTML = '<div class="empty-state">No alerts yet</div>';
            return;
        }

        list.innerHTML = '';
        data.alerts.forEach(alert => addAlertToLog(alert));
    } catch (err) {
        console.error('Failed to load alerts:', err);
    }
}

// ─── Load Predictions ───
async function loadPredictions() {
    try {
        const res = await fetch(`${API_BASE}/api/predictions`);
        const data = await res.json();
        const grid = document.getElementById('predictionsGrid');
        if (!grid || !data.predictions) return;

        grid.innerHTML = data.predictions.map(p => {
            const confClass = p.confidence >= 70 ? 'high' : p.confidence >= 45 ? 'medium' : 'low';
            return `
        <div class="prediction-card ${p.predictedCount !== p.actualCount ? 'predicted' : ''}">
          <div class="pc-header">
            <span class="pc-name">${p.zoneName}</span>
            <span class="pc-confidence ${confClass}">${p.confidence}% conf</span>
          </div>
          <div class="pc-counts">
            <div class="pc-count-item">
              <span class="pc-count-label">Predicted</span>
              <span class="pc-count-value">${p.predictedCount}</span>
            </div>
            <div class="pc-count-item">
              <span class="pc-count-label">Actual</span>
              <span class="pc-count-value">${p.actualCount}</span>
            </div>
          </div>
          ${p.basedOn && p.basedOn.length > 0 ? `<div class="pc-based-on">Based on: ${p.basedOn.join(', ')}</div>` : ''}
        </div>
      `;
        }).join('');

        // Render comparison chart
        if (typeof renderPredictionChart === 'function') {
            renderPredictionChart(data.predictions);
        }
    } catch (err) {
        console.error('Failed to load predictions:', err);
    }
}

// ─── Load History ───
async function loadHistory() {
    const date = document.getElementById('historyDate')?.value;
    const hour = document.getElementById('historyHour')?.value;

    if (!date) {
        alert('Please select a date');
        return;
    }

    try {
        let url = `${API_BASE}/api/zones/history?date=${date}`;
        if (hour !== '') url += `&hour=${hour}`;

        const res = await fetch(url);
        const data = await res.json();

        // Update history table
        const tbody = document.getElementById('historyTableBody');
        if (tbody && data.data) {
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-secondary);">No data for this date/time</td></tr>';
            } else {
                tbody.innerHTML = data.data.map(d => `
          <tr>
            <td><strong>${d.zoneName}</strong></td>
            <td>${d.hour}:00</td>
            <td>${d.detectedCount}</td>
            <td>${d.estimatedTotal}</td>
          </tr>
        `).join('');
            }
        }

        // Render history chart
        if (data.data && data.data.length > 0 && typeof renderHistoryChart === 'function') {
            renderHistoryChart(data.data);
        }
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

// ─── Helpers ───
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

// ─── Initialize ───
document.addEventListener('DOMContentLoaded', () => {
    initSocket();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Load initial data via REST
    fetch(`${API_BASE}/api/zones/live`)
        .then(res => res.json())
        .then(data => {
            if (data.zones) handleZoneUpdate(data.zones);
        })
        .catch(err => console.error('Initial load failed:', err));
});
