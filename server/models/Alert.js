const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    zoneId: { type: String, required: true },
    zoneName: { type: String, required: true },
    count: { type: Number, required: true },
    capacity: { type: Number, required: true },
    severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
    resolved: { type: Boolean, default: false },
    triggeredAt: { type: Date, default: Date.now }
});

alertSchema.index({ triggeredAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
