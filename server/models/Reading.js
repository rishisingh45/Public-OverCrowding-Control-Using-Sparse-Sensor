const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },
    zoneId: { type: String, required: true },
    lat: { type: Number },
    lng: { type: Number },
    wifiSSID: { type: String },
    signalStrength: { type: Number },
    visibleNetworks: [{
        ssid: String,
        rssi: Number
    }],
    detectionMethod: {
        type: String,
        enum: ['wifi_connected', 'wifi_visible', 'gps', 'ip_range', 'prediction'],
        default: 'wifi_connected'
    },
    timestamp: { type: Date, default: Date.now }
});

readingSchema.index({ zoneId: 1, timestamp: -1 });
readingSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Reading', readingSchema);
