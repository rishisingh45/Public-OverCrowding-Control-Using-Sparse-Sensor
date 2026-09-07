// ─── Campus Map (Leaflet.js) — Dynamic Zone Loading ───

let map;
let zoneMarkers = {};
let zoneCircles = {};
let mapInitialized = false;

const STATUS_COLORS = {
    green: '#34d399',
    yellow: '#fbbf24',
    red: '#f87171'
};

function initMap() {
    // Initialize map without centering — will auto-fit to zones
    map = L.map('campusMap', {
        center: [30.68, 76.60],
        zoom: 15,
        zoomControl: true,
        attributionControl: false
    });

    // Dark tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(map);

    mapInitialized = true;
}

function createZoneIcon(name, count, status, isPredicted) {
    // Create a short label from the zone name
    const shortName = name.length > 10 ? name.slice(0, 10) + '…' : name;
    return L.divIcon({
        className: '',
        html: `
      <div class="zone-marker ${status} ${isPredicted ? 'predicted' : ''}">
        <span class="marker-count">${count}</span>
        <span class="marker-label">${shortName}</span>
      </div>
    `,
        iconSize: [64, 56],
        iconAnchor: [32, 28]
    });
}

function createPopupContent(name, count, capacity, status, isPredicted) {
    const percent = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
    const statusLabel = status === 'green' ? 'Safe' : status === 'yellow' ? 'Moderate' : 'Overcrowded';
    return `
    <div style="font-family: Inter, sans-serif; min-width: 180px;">
      <strong style="font-size: 14px;">${name}</strong>
      ${isPredicted ? '<span style="color: #a78bfa; font-size: 11px;"> (Predicted)</span>' : ''}
      <hr style="border-color: #333; margin: 6px 0;">
      <div style="font-size: 12px; color: #aaa;">
        Count: <strong style="color: white;">${count}</strong> / ${capacity}<br>
        Occupancy: <strong style="color: ${STATUS_COLORS[status]};">${percent}%</strong><br>
        Status: <span style="color: ${STATUS_COLORS[status]};">${statusLabel}</span>
      </div>
    </div>
  `;
}

function updateMapZones(zones) {
    if (!mapInitialized || !map) return;

    const bounds = [];

    zones.forEach(zone => {
        const lat = zone.lat;
        const lng = zone.lng;

        if (!lat || !lng) return; // Skip zones without coordinates

        bounds.push([lat, lng]);

        // If marker already exists, update it
        if (zoneMarkers[zone.zoneId]) {
            zoneMarkers[zone.zoneId].setIcon(createZoneIcon(
                zone.name,
                zone.currentCount,
                zone.status,
                zone.isPredicted
            ));
            zoneMarkers[zone.zoneId].setPopupContent(createPopupContent(
                zone.name,
                zone.currentCount,
                zone.maxCapacity,
                zone.status,
                zone.isPredicted
            ));

            if (zoneCircles[zone.zoneId]) {
                zoneCircles[zone.zoneId].setStyle({
                    color: STATUS_COLORS[zone.status],
                    fillColor: STATUS_COLORS[zone.status],
                    fillOpacity: zone.status === 'red' ? 0.25 : 0.12,
                    dashArray: zone.isPredicted ? '5, 5' : null
                });
            }
        } else {
            // Create new circle for zone radius
            const radius = zone.radius || 80;
            const circle = L.circle([lat, lng], {
                radius: radius,
                color: STATUS_COLORS[zone.status] || '#555',
                fillColor: STATUS_COLORS[zone.status] || '#555',
                fillOpacity: zone.status === 'red' ? 0.25 : 0.12,
                weight: 1,
                dashArray: zone.isPredicted ? '5, 5' : null
            }).addTo(map);

            zoneCircles[zone.zoneId] = circle;

            // Create marker
            const marker = L.marker([lat, lng], {
                icon: createZoneIcon(zone.name, zone.currentCount, zone.status, zone.isPredicted)
            }).addTo(map);

            marker.bindPopup(createPopupContent(
                zone.name,
                zone.currentCount,
                zone.maxCapacity,
                zone.status,
                zone.isPredicted
            ));

            zoneMarkers[zone.zoneId] = marker;
        }
    });

    // Auto-fit map to show all zones on first load
    if (bounds.length > 0 && !map._fitted) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
        map._fitted = true;
    }
}

// Initialize map when DOM is ready
document.addEventListener('DOMContentLoaded', initMap);
