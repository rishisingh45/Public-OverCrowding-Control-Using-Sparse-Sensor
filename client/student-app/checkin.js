// ─── Configuration ───
const API_BASE = window.location.origin;
const CHECKIN_INTERVAL = 2 * 60 * 1000; // 2 minutes

let autoCheckinTimer = null;
let deviceId = localStorage.getItem('campus_device_id');

// Generate anonymous device ID if not exists
if (!deviceId) {
    deviceId = 'anon_' + crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    localStorage.setItem('campus_device_id', deviceId);
}

// ─── DOM Elements ───
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const zoneName = document.getElementById('zoneName');
const zoneCard = document.getElementById('zoneCard');
const zoneStatusDot = document.getElementById('zoneStatusDot');
const zoneStatusText = document.getElementById('zoneStatusText');
const zoneMeta = document.getElementById('zoneMeta');
const checkinBtn = document.getElementById('checkinBtn');
const detectionMethod = document.getElementById('detectionMethod');
const zoneCount = document.getElementById('zoneCount');
const lastCheckin = document.getElementById('lastCheckin');
const wifiName = document.getElementById('wifiName');
const wifiSelector = document.getElementById('wifiSelector');

let wifiNetworks = []; // Loaded from server

// ─── Initialize ───
window.addEventListener('load', () => {
    setStatus('ready', 'Ready to check in');
    detectWifiInfo();
    loadWifiNetworks();
});

// ─── Load WiFi Networks from Server ───
async function loadWifiNetworks() {
    try {
        const response = await fetch(`${API_BASE}/api/zones/wifi`);
        if (!response.ok) throw new Error('Failed to fetch WiFi networks');
        const data = await response.json();
        wifiNetworks = data.networks || [];

        // Populate the dropdown
        wifiSelector.innerHTML = '<option value="">-- Not connected / Unknown --</option>';
        wifiNetworks.forEach(net => {
            const opt = document.createElement('option');
            opt.value = net.ssid;
            opt.textContent = `📶 ${net.ssid}`;
            wifiSelector.appendChild(opt);
        });

        // Restore previously selected WiFi if any
        const savedSSID = localStorage.getItem('selected_wifi_ssid');
        if (savedSSID) {
            wifiSelector.value = savedSSID;
            wifiName.textContent = savedSSID;
        }
    } catch (err) {
        console.warn('Could not load WiFi networks:', err.message);
    }
}

// ─── WiFi Selection Handler ───
function onWifiSelected() {
    const ssid = wifiSelector.value;
    if (ssid) {
        localStorage.setItem('selected_wifi_ssid', ssid);
        wifiName.textContent = ssid;
    } else {
        localStorage.removeItem('selected_wifi_ssid');
        wifiName.textContent = 'Not selected';
    }
}

// ─── Status Helpers ───
function setStatus(state, text) {
    statusDot.className = 'status-dot';
    if (state === 'active') statusDot.classList.add('active');
    else if (state === 'error') statusDot.classList.add('error');
    statusText.textContent = text;
}

function setZoneStatus(status) {
    zoneCard.className = 'zone-card ' + status;
    zoneStatusDot.className = 'zone-status-dot ' + status;

    const labels = { green: 'Safe — Low Crowd', yellow: 'Moderate Crowd', red: '⚠️ Overcrowded!' };
    zoneStatusText.textContent = labels[status] || 'Unknown';
}

// ─── WiFi Detection ───
function detectWifiInfo() {
    // navigator.connection provides limited info (type, effectiveType)
    // Full SSID detection requires native APIs; we use what's available
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (conn) {
        wifiName.textContent = conn.type === 'wifi' ? 'WiFi Connected' : conn.type || 'Unknown';
    } else {
        wifiName.textContent = 'Not available';
    }
}

// ─── GPS Collection ───
function getLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                });
            },
            (err) => {
                console.warn('GPS error:', err.message);
                resolve({ lat: null, lng: null, accuracy: null });
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
    });
}

// ─── Simulated Visible Networks ───
// In a real deployment, a native wrapper would provide this
function getVisibleNetworks() {
    // Browser limitation: cannot scan WiFi SSIDs
    // Return empty array; zone detection will fall back to GPS/IP
    return [];
}

// ─── Get Connected WiFi SSID ───
function getConnectedSSID() {
    // Use the WiFi dropdown selection instead of browser API
    const selected = wifiSelector ? wifiSelector.value : '';
    return selected || null;
}

// ─── Main Check-In Function ───
async function performCheckin() {
    if (checkinBtn.classList.contains('loading')) return;

    checkinBtn.classList.add('loading');
    setStatus('active', 'Checking in...');

    try {
        // Collect GPS
        const location = await getLocation();

        // Collect WiFi info
        const connectedSSID = getConnectedSSID();
        const visibleNetworks = getVisibleNetworks();

        // Build payload
        const payload = {
            deviceId,
            lat: location.lat,
            lng: location.lng,
            wifiSSID: connectedSSID || '',
            signalStrength: 0,
            visibleNetworks,
            timestamp: new Date().toISOString()
        };

        // Send to server
        const response = await fetch(`${API_BASE}/api/checkin`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const data = await response.json();

        // Update UI
        zoneName.textContent = data.zone.name;
        setZoneStatus(data.zone.status);

        const capacityPercent = Math.round((data.zone.currentCount / data.zone.maxCapacity) * 100);
        zoneMeta.textContent = `${data.zone.currentCount} / ${data.zone.maxCapacity} (${capacityPercent}%)`;

        // Update info cards
        const methodLabels = {
            wifi_connected: '📶 WiFi (Connected)',
            wifi_visible: '📡 WiFi (Nearby)',
            gps: '📍 GPS Location',
            ip_range: '🌐 IP Address',
            prediction: '🤖 Predicted'
        };
        detectionMethod.textContent = methodLabels[data.detectionMethod] || data.detectionMethod;
        zoneCount.textContent = `${data.zone.currentCount} people`;

        const now = new Date();
        lastCheckin.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (connectedSSID) {
            wifiName.textContent = connectedSSID;
        }

        setStatus('active', `In ${data.zone.name}`);

    } catch (err) {
        console.error('Check-in error:', err);
        setStatus('error', 'Check-in failed');
        zoneName.textContent = 'Error';
        zoneStatusText.textContent = 'Could not reach server';
        zoneCard.className = 'zone-card';
    } finally {
        checkinBtn.classList.remove('loading');
    }
}

// ─── Auto Check-In Toggle ───
function toggleAutoCheckin() {
    const toggle = document.getElementById('autoToggle');

    if (toggle.checked) {
        // Start auto check-in
        performCheckin();
        autoCheckinTimer = setInterval(performCheckin, CHECKIN_INTERVAL);
        setStatus('active', 'Auto check-in active');
    } else {
        // Stop auto check-in
        if (autoCheckinTimer) {
            clearInterval(autoCheckinTimer);
            autoCheckinTimer = null;
        }
        setStatus('ready', 'Auto check-in disabled');
    }
}

// ─── Service Worker Registration ───
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.warn('SW registration failed:', err));
}
