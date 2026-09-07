const express = require('express');
const router = express.Router();
const Prediction = require('../models/Prediction');
const Zone = require('../models/Zone');

/**
 * GET /api/predictions
 * Returns the latest prediction for each zone
 */
router.get('/', async (req, res) => {
    try {
        const zones = await Zone.find({}).lean();

        const predictions = await Prediction.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: '$zoneId',
                    predictedCount: { $first: '$predictedCount' },
                    confidence: { $first: '$confidence' },
                    basedOn: { $first: '$basedOn' },
                    method: { $first: '$method' },
                    timestamp: { $first: '$timestamp' }
                }
            }
        ]);

        const zoneMap = {};
        zones.forEach(z => { zoneMap[z.zoneId] = z; });

        const result = predictions.map(p => ({
            zoneId: p._id,
            zoneName: zoneMap[p._id] ? zoneMap[p._id].name : p._id,
            predictedCount: p.predictedCount,
            actualCount: zoneMap[p._id] ? zoneMap[p._id].currentCount : 0,
            confidence: p.confidence,
            basedOn: p.basedOn,
            method: p.method,
            timestamp: p.timestamp
        }));

        res.json({ predictions: result });
    } catch (err) {
        console.error('❌ Predictions error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
