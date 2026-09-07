// ─── Chart.js — Crowd Trend Graphs ───

let crowdChart = null;
let historyChart = null;
let predictionChart = null;

// Store time-series data for live chart
const chartData = {};
const MAX_DATA_POINTS = 20;

const ZONE_COLORS = {
    zone_main_gate: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    zone_block_a: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    zone_block_b: { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    zone_library: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    zone_canteen: { border: '#f43f5e', bg: 'rgba(244, 63, 94, 0.15)' },
    zone_ground: { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    zone_admin: { border: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
    zone_parking: { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)' }
};

const CHART_DEFAULTS = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: {
            position: 'top',
            labels: {
                color: 'rgba(240, 238, 255, 0.7)',
                font: { family: 'Inter', size: 11, weight: '500' },
                boxWidth: 12,
                padding: 12,
                usePointStyle: true,
                pointStyle: 'circle'
            }
        },
        tooltip: {
            backgroundColor: 'rgba(15, 14, 30, 0.95)',
            titleColor: '#f0eeff',
            bodyColor: 'rgba(240, 238, 255, 0.7)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: { family: 'Inter', weight: '600' },
            bodyFont: { family: 'Inter' },
            padding: 10
        }
    },
    scales: {
        x: {
            ticks: {
                color: 'rgba(240, 238, 255, 0.4)',
                font: { family: 'Inter', size: 10 },
                maxRotation: 0
            },
            grid: { color: 'rgba(255, 255, 255, 0.04)' }
        },
        y: {
            beginAtZero: true,
            ticks: {
                color: 'rgba(240, 238, 255, 0.4)',
                font: { family: 'Inter', size: 10 }
            },
            grid: { color: 'rgba(255, 255, 255, 0.04)' }
        }
    }
};

/**
 * Initialize the live crowd trend chart
 */
function initCrowdChart() {
    const ctx = document.getElementById('crowdChart');
    if (!ctx) return;

    crowdChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            ...CHART_DEFAULTS,
            interaction: { mode: 'index', intersect: false },
            elements: {
                line: { tension: 0.4, borderWidth: 2 },
                point: { radius: 0, hoverRadius: 5 }
            }
        }
    });
}

/**
 * Feed new zone data into the live chart
 */
function updateCrowdChart(zones) {
    if (!crowdChart) return;

    const timeLabel = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Initialize dataset per zone
    zones.forEach(zone => {
        if (!chartData[zone.zoneId]) {
            chartData[zone.zoneId] = [];
        }
        chartData[zone.zoneId].push(zone.currentCount);

        // Limit data points
        if (chartData[zone.zoneId].length > MAX_DATA_POINTS) {
            chartData[zone.zoneId].shift();
        }
    });

    // Update labels
    crowdChart.data.labels.push(timeLabel);
    if (crowdChart.data.labels.length > MAX_DATA_POINTS) {
        crowdChart.data.labels.shift();
    }

    // Build datasets
    const selectedZone = document.getElementById('chartZoneSelect')?.value || 'all';

    crowdChart.data.datasets = zones
        .filter(z => selectedZone === 'all' || z.zoneId === selectedZone)
        .map(zone => ({
            label: zone.name,
            data: [...(chartData[zone.zoneId] || [])],
            borderColor: ZONE_COLORS[zone.zoneId]?.border || '#888',
            backgroundColor: ZONE_COLORS[zone.zoneId]?.bg || 'rgba(136,136,136,0.15)',
            fill: selectedZone !== 'all',
            borderDash: zone.isPredicted ? [5, 5] : []
        }));

    crowdChart.update('none');
}

/**
 * Populate the zone select dropdown
 */
function populateChartSelect(zones) {
    const select = document.getElementById('chartZoneSelect');
    if (!select || select.options.length > 1) return;

    zones.forEach(zone => {
        const opt = document.createElement('option');
        opt.value = zone.zoneId;
        opt.textContent = zone.name;
        select.appendChild(opt);
    });
}

function updateChart() {
    // Re-render with same data but possibly different zone filter
    if (crowdChart && Object.keys(chartData).length > 0) {
        const zones = Object.keys(chartData).map(zoneId => ({
            zoneId,
            name: getZoneNameById(zoneId),
            currentCount: chartData[zoneId][chartData[zoneId].length - 1] || 0,
            isPredicted: false
        }));
        // Just trigger a re-filter
        const selectedZone = document.getElementById('chartZoneSelect')?.value || 'all';
        crowdChart.data.datasets = zones
            .filter(z => selectedZone === 'all' || z.zoneId === selectedZone)
            .map(zone => ({
                label: zone.name,
                data: [...(chartData[zone.zoneId] || [])],
                borderColor: ZONE_COLORS[zone.zoneId]?.border || '#888',
                backgroundColor: ZONE_COLORS[zone.zoneId]?.bg || 'rgba(136,136,136,0.15)',
                fill: selectedZone !== 'all'
            }));
        crowdChart.update('none');
    }
}

// Zone name lookup (populated from live data)
const zoneNames = {};
function getZoneNameById(zoneId) {
    return zoneNames[zoneId] || zoneId;
}

/**
 * Render the history chart
 */
function renderHistoryChart(data) {
    const ctx = document.getElementById('historyChart');
    if (!ctx) return;

    if (historyChart) historyChart.destroy();

    // Group by zone
    const byZone = {};
    data.forEach(d => {
        if (!byZone[d.zoneId]) byZone[d.zoneId] = [];
        byZone[d.zoneId].push(d);
    });

    const hours = [...new Set(data.map(d => d.hour))].sort((a, b) => a - b);

    const datasets = Object.entries(byZone).map(([zoneId, items]) => ({
        label: items[0].zoneName || zoneId,
        data: hours.map(h => {
            const item = items.find(i => i.hour === h);
            return item ? item.estimatedTotal : 0;
        }),
        borderColor: ZONE_COLORS[zoneId]?.border || '#888',
        backgroundColor: ZONE_COLORS[zoneId]?.bg || 'rgba(136,136,136,0.15)',
        fill: false,
        tension: 0.4,
        borderWidth: 2
    }));

    historyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hours.map(h => `${h}:00`),
            datasets
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: {
                ...CHART_DEFAULTS.plugins,
                legend: {
                    ...CHART_DEFAULTS.plugins.legend,
                    position: 'bottom'
                }
            }
        }
    });
}

/**
 * Render prediction vs actual chart
 */
function renderPredictionChart(predictions) {
    const ctx = document.getElementById('predictionChart');
    if (!ctx) return;

    if (predictionChart) predictionChart.destroy();

    const labels = predictions.map(p => p.zoneName);
    const predictedData = predictions.map(p => p.predictedCount);
    const actualData = predictions.map(p => p.actualCount);

    predictionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Predicted',
                    data: predictedData,
                    backgroundColor: 'rgba(124, 92, 252, 0.6)',
                    borderColor: '#7c5cfc',
                    borderWidth: 1,
                    borderRadius: 6
                },
                {
                    label: 'Actual',
                    data: actualData,
                    backgroundColor: 'rgba(52, 211, 153, 0.6)',
                    borderColor: '#34d399',
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },
        options: {
            ...CHART_DEFAULTS,
            plugins: {
                ...CHART_DEFAULTS.plugins,
                legend: {
                    ...CHART_DEFAULTS.plugins.legend,
                    position: 'bottom'
                }
            }
        }
    });
}

// Initialize charts on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initCrowdChart();

    // Populate history hour dropdown
    const hourSelect = document.getElementById('historyHour');
    if (hourSelect) {
        for (let h = 0; h < 24; h++) {
            const opt = document.createElement('option');
            opt.value = h;
            opt.textContent = `${h.toString().padStart(2, '0')}:00`;
            hourSelect.appendChild(opt);
        }
    }

    // Set default date to today
    const dateInput = document.getElementById('historyDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
});
