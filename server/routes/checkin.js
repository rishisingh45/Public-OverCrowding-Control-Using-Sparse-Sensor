const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');

/**
 * POST /api/checkin
 * Student check-in: detect zone using 5-priority method
 */
router.post('/', async (req, res) => {
    try {
        const {
            deviceId,
            lat,
            lng,
            wifiSSID,
            signalStrength,
            visibleNetworks,
            timestamp
        } = req.body;

        if (!deviceId) {
            return res.status(400).json({ error: 'deviceId is required' });
        }

        const allZones = await Zone.find({}).lean();
        let detectedZone = null;
        let detectionMethod = 'prediction';

        // ─── Priority 1: Connected WiFi SSID ───
        if (wifiSSID) {
            detectedZone = allZones.find(z =>
                z.wifiSSIDs.map(s => s.toUpperCase()).includes(wifiSSID.toUpperCase())
            );
            if (detectedZone) detectionMethod = 'wifi_connected';
        }

        // ─── Priority 2: Visible WiFi (strongest signal) ───
        if (!detectedZone && visibleNetworks && visibleNetworks.length > 0) {
            const sorted = [...visibleNetworks].sort((a, b) => b.rssi - a.rssi);
            for (const net of sorted) {
                detectedZone = allZones.find(z =>
                    z.wifiSSIDs.map(s => s.toUpperCase()).includes(net.ssid.toUpperCase())
                );
                if (detectedZone) {
                    detectionMethod = 'wifi_visible';
                    break;
                }
            }
        }

        // ─── Priority 3: GPS coordinates → zone boundaries ───
        if (!detectedZone && lat && lng) {
            let closestZone = null;
            let minDistance = Infinity;

            for (const zone of allZones) {
                const dist = haversineDistance(lat, lng, zone.lat, zone.lng);
                if (dist <= zone.radius && dist < minDistance) {
                    minDistance = dist;
                    closestZone = zone;
                }
            }

            if (closestZone) {
                detectedZone = closestZone;
                detectionMethod = 'gps';
            }
        }

        // ─── Priority 4: IP address range (simplified) ───
        if (!detectedZone) {
            const clientIP = req.ip || req.socket?.remoteAddress || '';
            for (const zone of allZones) {
                if (zone.ipRanges && zone.ipRanges.some(range => ipInRange(clientIP, range))) {
                    detectedZone = zone;
                    detectionMethod = 'ip_range';
                    break;
                }
            }
        }

        // ─── Priority 5: Assign to nearest zone (fallback) ───
        if (!detectedZone && lat && lng) {
            let closestZone = null;
            let minDistance = Infinity;
            for (const zone of allZones) {
                const dist = haversineDistance(lat, lng, zone.lat, zone.lng);
                if (dist < minDistance) {
                    minDistance = dist;
                    closestZone = zone;
                }
            }
            detectedZone = closestZone;
            detectionMethod = 'prediction';
        }

        // Final fallback: assign to main gate
        if (!detectedZone) {
            detectedZone = allZones.find(z => z.zoneId === 'zone_main_gate') || allZones[0];
            detectionMethod = 'prediction';
        }

        // Save the reading
        const reading = await Reading.create({
            deviceId,
            zoneId: detectedZone.zoneId,
            lat: lat || detectedZone.lat,
            lng: lng || detectedZone.lng,
            wifiSSID: wifiSSID || '',
            signalStrength: signalStrength || 0,
            visibleNetworks: visibleNetworks || [],
            detectionMethod,
            timestamp: timestamp ? new Date(timestamp) : new Date()
        });

        // Update zone count
        const recentWindow = new Date(Date.now() - 10 * 60 * 1000);
        const uniqueDevices = await Reading.distinct('deviceId', {
            zoneId: detectedZone.zoneId,
            timestamp: { $gte: recentWindow }
        });

        const estimatedTotal = Math.round(uniqueDevices.length / 0.45);
        const zone = await Zone.findOne({ zoneId: detectedZone.zoneId });
        zone.currentCount = Math.min(estimatedTotal, zone.maxCapacity * 1.2);
        zone.isPredicted = false;
        zone.updateStatus();
        await zone.save();

        // Check for overcrowding alert
        if (zone.currentCount >= zone.maxCapacity * 0.75) {
            const recentAlert = await Alert.findOne({
                zoneId: zone.zoneId,
                triggeredAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
            });

            if (!recentAlert) {
                await Alert.create({
                    zoneId: zone.zoneId,
                    zoneName: zone.name,
                    count: zone.currentCount,
                    capacity: zone.maxCapacity,
                    severity: zone.currentCount >= zone.maxCapacity ? 'critical' : 'warning',
                    triggeredAt: new Date()
                });
            }
        }

        res.json({
            success: true,
            zone: {
                zoneId: zone.zoneId,
                name: zone.name,
                status: zone.status,
                currentCount: zone.currentCount,
                maxCapacity: zone.maxCapacity
            },
            detectionMethod,
            readingId: reading._id
        });
    } catch (err) {
        console.error('❌ Check-in error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Haversine distance between two lat/lng points in meters
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) {
    return (deg * Math.PI) / 180;
}

/**
 * Simple IP range check (supports /24 only for now)
 */
function ipInRange(ip, cidr) {
    if (!ip || !cidr) return false;
    const cleanIP = ip.replace('::ffff:', '');
    const [rangeBase] = cidr.split('/');
    const ipParts = cleanIP.split('.');
    const rangeParts = rangeBase.split('.');
    if (ipParts.length !== 4 || rangeParts.length !== 4) return false;
    return ipParts[0] === rangeParts[0] &&
        ipParts[1] === rangeParts[1] &&
        ipParts[2] === rangeParts[2];
}

module.exports = router;
