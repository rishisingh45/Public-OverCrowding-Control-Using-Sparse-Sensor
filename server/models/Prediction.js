const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
    zoneId: { type: String, required: true },
    predictedCount: { type: Number, required: true },
    confidence: { type: Number, required: true }, // 0-100
    basedOn: [String], // zoneIds used for prediction
    method: { type: String, default: 'weighted_interpolation' },
    timestamp: { type: Date, default: Date.now }
});

predictionSchema.index({ zoneId: 1, timestamp: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
