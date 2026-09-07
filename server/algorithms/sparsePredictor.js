const Reading = require('../models/Reading');
const Zone = require('../models/Zone');
const Prediction = require('../models/Prediction');
const Alert = require('../models/Alert');

const PARTICIPATION_RATE = 0.45;
const RECENT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

// Time-of-day heuristics: expected crowd multiplier per zone per hour
const TIME_HEURISTICS = {
    zone_main_gate: { 8: 1.8, 9: 1.5, 16: 1.6, 17: 1.8 },
    zone_block_a: { 9: 1.5, 10: 1.7, 11: 1.6, 14: 1.5, 15: 1.4 },
    zone_block_b: { 9: 1.4, 10: 1.6, 11: 1.5, 14: 1.4, 15: 1.3 },
    zone_library: { 10: 1.3, 11: 1.4, 14: 1.6, 15: 1.7, 16: 1.5 },
    zone_canteen: { 12: 2.0, 13: 1.8, 18: 1.5, 19: 1.3 },
    zone_ground: { 7: 1.3, 16: 1.5, 17: 1.7 },
    zone_admin: { 10: 1.3, 11: 1.4, 14: 1.3 },
    zone_parking: { 8: 1.6, 9: 1.4, 16: 1.5, 17: 1.7 }
};

/**
 * Count unique devices in a zone within the recent window
 */
async function getRecentUniqueCount(zoneId, since) {
    const readings = await Reading.aggregate([
        { $match: { zoneId, timestamp: { $gte: since } } },
        { $group: { _id: '$deviceId' } },
        { $count: 'uniqueDevices' }
    ]);
    return readings.length > 0 ? readings[0].uniqueDevices : 0;
}

/**
 * Get historical average for a zone at the current hour
 */
async function getHistoricalAvg(zoneId, hour) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await Reading.aggregate([
        {
            $match: {
                zoneId,
                timestamp: { $gte: sevenDaysAgo }
            }
        },
        {
            $addFields: {
                hour: { $hour: '$timestamp' }
            }
        },
        {
            $match: { hour: hour }
        },
        {
            $group: {
                _id: {
                    day: { $dayOfYear: '$timestamp' },
                    deviceId: '$deviceId'
                }
            }
        },
        {
            $group: {
                _id: null,
                totalUniquePerDay: { $sum: 1 },
                dayCount: { $addToSet: '$_id.day' }
            }
        },
        {
            $project: {
                avg: {
                    $cond: {
                        if: { $gt: [{ $size: '$dayCount' }, 0] },
                        then: { $divide: ['$totalUniquePerDay', { $size: '$dayCount' }] },
                        else: 0
                    }
                }
            }
        }
    ]);

    return result.length > 0 ? result[0].avg : 0;
}

/**
 * Apply time-of-day heuristic multiplier
 */
function getTimeMultiplier(zoneId, hour) {
    const heuristics = TIME_HEURISTICS[zoneId];
    if (!heuristics || !heuristics[hour]) return 1.0;
    return heuristics[hour];
}

/**
 * Predict missing zone count using weighted interpolation
 * Formula: 60% historical + 40% neighbors, adjusted by time heuristic
 */
async function predictZone(zone, allZones, hour, since) {
    const historicalAvg = await getHistoricalAvg(zone.zoneId, hour);

    // Get neighbor counts
    const neighborCounts = [];
    for (const neighborId of zone.neighbors) {
        const neighborZone = allZones.find(z => z.zoneId === neighborId);
        if (neighborZone && neighborZone.currentCount > 0) {
            neighborCounts.push(neighborZone.currentCount);
        }
    }

    const neighborAvg = neighborCounts.length > 0
        ? neighborCounts.reduce((a, b) => a + b, 0) / neighborCounts.length
        : 0;

    const timeMultiplier = getTimeMultiplier(zone.zoneId, hour);

    let predictedCount;
    let confidence;
    let basedOn = [];

    if (historicalAvg > 0 && neighborAvg > 0) {
        // Both sources available: 60% history + 40% neighbors
        predictedCount = (historicalAvg * 0.6 + neighborAvg * 0.4) * timeMultiplier;
        confidence = 75;
        basedOn = zone.neighbors.filter(nId =>
            allZones.find(z => z.zoneId === nId && z.currentCount > 0)
        );
    } else if (historicalAvg > 0) {
        // Only historical data
        predictedCount = historicalAvg * timeMultiplier;
        confidence = 55;
    } else if (neighborAvg > 0) {
        // Only neighbor data
        predictedCount = neighborAvg * 0.7 * timeMultiplier;
        confidence = 45;
        basedOn = zone.neighbors.filter(nId =>
            allZones.find(z => z.zoneId === nId && z.currentCount > 0)
        );
    } else {
        // No data at all: use base heuristic
        predictedCount = zone.maxCapacity * 0.15 * timeMultiplier;
        confidence = 20;
    }

    predictedCount = Math.round(Math.max(0, Math.min(predictedCount, zone.maxCapacity)));

    return { predictedCount, confidence, basedOn };
}

/**
 * Main prediction runner — called by cron every 30 seconds
 */
async function runPredictions(io) {
    try {
        const now = new Date();
        const since = new Date(now.getTime() - RECENT_WINDOW_MS);
        const currentHour = now.getHours();

        const allZones = await Zone.find({});
        const results = [];

        // Phase 1: Calculate real counts for zones with data
        for (const zone of allZones) {
            const detectedCount = await getRecentUniqueCount(zone.zoneId, since);

            if (detectedCount > 0) {
                // Adjust for participation rate
                const estimatedTotal = Math.round(detectedCount / PARTICIPATION_RATE);
                zone.currentCount = Math.min(estimatedTotal, zone.maxCapacity * 1.2);
                zone.isPredicted = false;
                zone.updateStatus();
                await zone.save();

                results.push({
                    zoneId: zone.zoneId,
                    name: zone.name,
                    count: zone.currentCount,
                    status: zone.status,
                    isPredicted: false
                });
            }
        }

        // Phase 2: Predict missing zones
        // Reload zones to get updated counts from Phase 1
        const updatedZones = await Zone.find({});

        for (const zone of updatedZones) {
            const detectedCount = await getRecentUniqueCount(zone.zoneId, since);

            if (detectedCount === 0) {
                const { predictedCount, confidence, basedOn } = await predictZone(
                    zone, updatedZones, currentHour, since
                );

                zone.currentCount = predictedCount;
                zone.isPredicted = true;
                zone.updateStatus();
                await zone.save();

                // Save prediction record
                await Prediction.create({
                    zoneId: zone.zoneId,
                    predictedCount,
                    confidence,
                    basedOn,
                    timestamp: now
                });

                results.push({
                    zoneId: zone.zoneId,
                    name: zone.name,
                    count: predictedCount,
                    status: zone.status,
                    isPredicted: true,
                    confidence
                });
            }
        }

        // Phase 3: Check for overcrowding alerts
        const finalZones = await Zone.find({});
        for (const zone of finalZones) {
            if (zone.currentCount >= zone.maxCapacity * 0.75) {
                const recentAlert = await Alert.findOne({
                    zoneId: zone.zoneId,
                    triggeredAt: { $gte: new Date(now.getTime() - 5 * 60 * 1000) }
                });

                if (!recentAlert) {
                    const alert = await Alert.create({
                        zoneId: zone.zoneId,
                        zoneName: zone.name,
                        count: zone.currentCount,
                        capacity: zone.maxCapacity,
                        severity: zone.currentCount >= zone.maxCapacity ? 'critical' : 'warning',
                        triggeredAt: now
                    });

                    if (io) {
                        io.emit('overcrowd-alert', {
                            zoneId: zone.zoneId,
                            zoneName: zone.name,
                            count: zone.currentCount,
                            capacity: zone.maxCapacity,
                            severity: alert.severity,
                            triggeredAt: now
                        });
                    }
                }
            }
        }

        // Broadcast updated zone data
        if (io) {
            const { broadcastZoneUpdate } = require('../socket/liveUpdates');
            await broadcastZoneUpdate(io);
        }

        return results;
    } catch (err) {
        console.error('❌ Prediction error:', err.message);
        return [];
    }
}

module.exports = { runPredictions, predictZone, getRecentUniqueCount };
