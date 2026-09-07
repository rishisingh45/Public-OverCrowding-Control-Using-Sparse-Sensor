const mongoose = require('mongoose');

const zoneSchema = new mongoose.Schema({
    zoneId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    wifiSSIDs: [String],
    maxCapacity: { type: Number, default: 100 },
    currentCount: { type: Number, default: 0 },
    status: { type: String, enum: ['green', 'yellow', 'red'], default: 'green' },
    isPredicted: { type: Boolean, default: false },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    radius: { type: Number, default: 100 }, // meters
    neighbors: [String], // neighboring zoneIds
    ipRanges: [String]   // IP ranges for fallback detection
}, { timestamps: true });

zoneSchema.methods.updateStatus = function () {
    const ratio = this.currentCount / this.maxCapacity;
    if (ratio >= 0.75) this.status = 'red';
    else if (ratio >= 0.40) this.status = 'yellow';
    else this.status = 'green';
};

module.exports = mongoose.model('Zone', zoneSchema);
