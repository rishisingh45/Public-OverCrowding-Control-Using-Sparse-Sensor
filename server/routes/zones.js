const express = require('express');
const router = express.Router();
const Zone = require('../models/Zone');
const Reading = require('../models/Reading');
const Alert = require('../models/Alert');

/**
 * GET /api/zones/live
 * Returns all 8 zones with current count and status
 */
router.get('/live', async (req, res) => {
    try {
        const zones = await Zone.find({}).lean();
        const result = zones.map(z => ({
            zoneId: z.zoneId,
            name: z.name,
            currentCount: z.currentCount,
            maxCapacity: z.maxCapacity,
            status: z.status,
            isPredicted: z.isPredicted || false,
            lat: z.lat,
            lng: z.lng,
            radius: z.radius || 80,
            occupancyPercent: Math.round((z.currentCount / z.maxCapacity) * 100)
        }));
        res.json({ zones: result, timestamp: new Date().toISOString() });
    } catch (err) {
        console.error('❌ Zones live error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/zones/history?date=YYYY-MM-DD&hour=HH
 * Returns historical crowd data for a selected date and hour
 */
router.get('/history', async (req, res) => {
    try {
        const { date, hour } = req.query;
        if (!date) {
            return res.status(400).json({ error: 'date parameter is required (YYYY-MM-DD)' });
        }

        const targetDate = new Date(date);
        const targetHour = hour !== undefined ? parseInt(hour) : null;

        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        let matchQuery = {
            timestamp: { $gte: startOfDay, $lte: endOfDay }
        };

        const pipeline = [
            { $match: matchQuery },
            {
                $addFields: {
                    hour: { $hour: '$timestamp' }
                }
            }
        ];

        if (targetHour !== null) {
            pipeline.push({ $match: { hour: targetHour } });
        }

        pipeline.push(
            {
                $group: {
                    _id: { zoneId: '$zoneId', hour: '$hour' },
                    uniqueDevices: { $addToSet: '$deviceId' }
                }
            },
            {
                $project: {
                    zoneId: '$_id.zoneId',
                    hour: '$_id.hour',
                    count: { $size: '$uniqueDevices' },
                    estimatedTotal: {
                        $round: [{ $divide: [{ $size: '$uniqueDevices' }, 0.45] }, 0]
                    }
                }
            },
            { $sort: { 'zoneId': 1, 'hour': 1 } }
        );

        const readings = await Reading.aggregate(pipeline);

        // Get zone names
        const zones = await Zone.find({}).lean();
        const zoneMap = {};
        zones.forEach(z => { zoneMap[z.zoneId] = z.name; });

        const result = readings.map(r => ({
            zoneId: r.zoneId,
            zoneName: zoneMap[r.zoneId] || r.zoneId,
            hour: r.hour,
            detectedCount: r.count,
            estimatedTotal: r.estimatedTotal
        }));

        res.json({ date, hour: targetHour, data: result });
    } catch (err) {
        console.error('❌ History error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/zones/capacity
 * Update zone max capacity
 */
router.post('/capacity', async (req, res) => {
    try {
        const { zoneId, maxCapacity } = req.body;
        if (!zoneId || !maxCapacity) {
            return res.status(400).json({ error: 'zoneId and maxCapacity are required' });
        }

        const zone = await Zone.findOne({ zoneId });
        if (!zone) {
            return res.status(404).json({ error: 'Zone not found' });
        }

        zone.maxCapacity = maxCapacity;
        zone.updateStatus();
        await zone.save();

        res.json({
            success: true,
            zone: {
                zoneId: zone.zoneId,
                name: zone.name,
                maxCapacity: zone.maxCapacity,
                status: zone.status
            }
        });
    } catch (err) {
        console.error('❌ Capacity error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/zones/alerts
 * Returns recent alerts
 */
router.get('/alerts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const alerts = await Alert.find({}).sort({ triggeredAt: -1 }).limit(limit).lean();
        res.json({ alerts });
    } catch (err) {
        console.error('❌ Alerts error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/zones/wifi
 * Returns all WiFi SSIDs grouped by zone for the student WiFi selector
 */
router.get('/wifi', async (req, res) => {
    try {
        const zones = await Zone.find({}).lean();
        const wifiList = [];
        zones.forEach(z => {
            z.wifiSSIDs.forEach(ssid => {
                wifiList.push({ ssid, zoneId: z.zoneId, zoneName: z.name });
            });
        });
        res.json({ networks: wifiList });
    } catch (err) {
        console.error('❌ WiFi list error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
