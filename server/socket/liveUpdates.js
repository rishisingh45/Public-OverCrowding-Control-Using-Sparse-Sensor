const Zone = require('../models/Zone');
const Prediction = require('../models/Prediction');
const Alert = require('../models/Alert');

/**
 * Broadcast current zone data to all connected dashboard clients
 */
async function broadcastZoneUpdate(io) {
    try {
        const zones = await Zone.find({}).lean();

        // Get latest predictions for each zone
        const predictions = await Prediction.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: '$zoneId',
                    predictedCount: { $first: '$predictedCount' },
                    confidence: { $first: '$confidence' },
                    basedOn: { $first: '$basedOn' },
                    timestamp: { $first: '$timestamp' }
                }
            }
        ]);

        const predMap = {};
        predictions.forEach(p => { predMap[p._id] = p; });

        const zoneData = zones.map(z => ({
            zoneId: z.zoneId,
            name: z.name,
            currentCount: z.currentCount,
            maxCapacity: z.maxCapacity,
            status: z.status,
            isPredicted: z.isPredicted,
            lat: z.lat,
            lng: z.lng,
            radius: z.radius || 80,
            prediction: predMap[z.zoneId] || null
        }));

        io.emit('zone-update', {
            zones: zoneData,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('❌ Broadcast error:', err.message);
    }
}

/**
 * Broadcast an overcrowding alert
 */
function broadcastAlert(io, alert) {
    io.emit('overcrowd-alert', alert);
}

/**
 * Get recent alerts for dashboard
 */
async function getRecentAlerts(limit = 20) {
    return Alert.find({}).sort({ triggeredAt: -1 }).limit(limit).lean();
}

module.exports = { broadcastZoneUpdate, broadcastAlert, getRecentAlerts };
