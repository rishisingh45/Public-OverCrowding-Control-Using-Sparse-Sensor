require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const cron = require('node-cron');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// ─── Middleware ───
app.use(cors());
app.use(express.json());

// ─── Serve Static Files ───
app.use('/student', express.static(path.join(__dirname, '../client/student-app')));
app.use('/dashboard', express.static(path.join(__dirname, '../client/dashboard')));

// ─── API Routes ───
const checkinRoutes = require('./routes/checkin');
const zonesRoutes = require('./routes/zones');
const predictionsRoutes = require('./routes/predictions');

app.use('/api/checkin', checkinRoutes);
app.use('/api/zones', zonesRoutes);
app.use('/api/predictions', predictionsRoutes);

// ─── Root redirect ───
app.get('/', (req, res) => {
    res.redirect('/dashboard/');
});

// ─── Socket.io ───
const { broadcastZoneUpdate } = require('./socket/liveUpdates');

io.on('connection', (socket) => {
    console.log(`🔌 Dashboard connected: ${socket.id}`);

    // Send initial data on connection
    broadcastZoneUpdate(io);

    socket.on('disconnect', () => {
        console.log(`⚡ Dashboard disconnected: ${socket.id}`);
    });

    socket.on('request-update', () => {
        broadcastZoneUpdate(io);
    });
});

// ─── Sparse Prediction Cron Job (every 30 seconds) ───
const { runPredictions } = require('./algorithms/sparsePredictor');

cron.schedule('*/30 * * * * *', async () => {
    if (mongoose.connection.readyState !== 1) {
        return;
    }

    console.log('🔄 Running sparse predictions...');
    const results = await runPredictions(io);
    console.log(`   ✅ Updated ${results.length} zones`);
});

// ─── Connect to MongoDB & Start Server ───
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/overcrowding_control';

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`\n🚀 Overcrowding Control System running!`);
    console.log(`   📱 Student App:  http://localhost:${PORT}/student/`);
    console.log(`   📊 Dashboard:    http://localhost:${PORT}/dashboard/`);
    console.log(`   🔌 Socket.io:    Enabled`);
    console.log(`   ⏰ Predictions:  Every 30 seconds\n`);
});

mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
})
    .then(() => {
        console.log('✅  Connected to MongoDB');
    })
    .catch(err => {
        console.error('❌  MongoDB connection error:', err.message);
        console.error('   Make sure MongoDB is running locally or update MONGO_URI in .env');
    });

module.exports = { app, io };
