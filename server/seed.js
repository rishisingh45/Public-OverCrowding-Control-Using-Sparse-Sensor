require('dotenv').config();
const mongoose = require('mongoose');
const Zone = require('./models/Zone');

const zones = [
    {
        zoneId: 'flat_home',
        name: 'Flat',
        wifiSSIDs: ['Bihari babu 5G', 'Bihari babu 4G'],
        maxCapacity: 10,
        currentCount: 0,
        status: 'green',
        lat: 30.7266622,
        lng: 76.6408936,
        radius: 50,
        neighbors: ['Airtel_ak_49', 'Mani Wifi'],
        ipRanges: ['192.168.1.0/24']
    },
    {
        zoneId: 'near_home',
        name: 'Near Home',
        wifiSSIDs: ['home wifi'],
        maxCapacity: 20,
        currentCount: 0,
        status: 'green',
        lat: 30.7265829,
        lng: 76.6416395,
        radius: 50,
        neighbors: ['Airtel_mani', 'Error_404'],
        ipRanges: ['192.168.2.0/24']
    },
    {
        zoneId: 'Zone_1',
        name: 'Block 1',
        wifiSSIDs: ['CGC_Block_1'],
        maxCapacity: 2000,
        currentCount: 0,
        status: 'green',
        lat: 30.6807763,
        lng: 76.6055092,
        radius: 150,
        neighbors: ['zone_block_a', 'zone_admin'],
        ipRanges: ['192.168.4.0/24']
    },
    {
        zoneId: 'Zone_Workshop',
        name: 'WorkShop',
        wifiSSIDs: [],
        maxCapacity: 150,
        currentCount: 0,
        status: 'green',
        lat: 30.6803129,
        lng: 76.6060617,
        radius: 110,
        neighbors: ['zone_block_b', 'zone_ground'],
        ipRanges: ['192.168.5.0/24']
    },
    {
        zoneId: 'zone_2',
        name: 'Block 2',
        wifiSSIDs: ['CGC_Block_2'],
        maxCapacity: 500,
        currentCount: 0,
        status: 'green',
        lat: 30.6802613,
        lng: 76.6070226,
        radius: 100,
        neighbors: ['zone_canteen', 'zone_parking'],
        ipRanges: ['192.168.6.0/24']
    },
    {
        zoneId: 'zone_TuckShop',
        name: 'TuckShop',
        wifiSSIDs: [],
        maxCapacity: 200,
        currentCount: 0,
        status: 'green',
        lat: 30.6807278,
        lng: 76.6071279,
        radius: 150,
        neighbors: ['zone_block_b', 'zone_library'],
        ipRanges: ['192.168.7.0/24']
    },
    {
        zoneId: 'zone_girls_Hostel',
        name: 'Girls_Hostel',
        wifiSSIDs: [],
        maxCapacity: 500,
        currentCount: 0,
        status: 'green',
        lat: 30.6805199,
        lng: 76.6077881,
        radius: 250,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_block_3',
        name: 'Block 3',
        wifiSSIDs: ['CGC_BLock_3'],
        maxCapacity: 500,
        currentCount: 0,
        status: 'green',
        lat: 30.6813221,
        lng: 76.6078353,
        radius: 100,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.9.0/24']
    },
    {
        zoneId: 'zone_block_4',
        name: 'Block 4 / Law College',
        wifiSSIDs: ['CGC_Block_4'],
        maxCapacity: 500,
        currentCount: 0,
        status: 'green',
        lat: 30.6819576,
        lng: 76.6078223,
        radius: 100,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Bus_parking',
        name: 'Parking Zone 2',
        wifiSSIDs: [],
        maxCapacity: 100,
        currentCount: 0,
        status: 'green',
        lat: 30.6815828,
        lng: 76.6082591,
        radius: 150,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_SportArena',
        name: 'Sport Arena',
        wifiSSIDs: [],
        maxCapacity: 2000,
        currentCount: 0,
        status: 'green',
        lat: 30.6802976,
        lng: 76.6089039,
        radius: 300,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Block_5',
        name: 'Block 5',
        wifiSSIDs: ['CGC_Block_5'],
        maxCapacity: 200,
        currentCount: 0,
        status: 'green',
        lat: 30.6820637,
        lng: 76.6070079,
        radius: 150,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Garden_silence',
        name: 'Garden of Silence',
        wifiSSIDs: [],
        maxCapacity: 100,
        currentCount: 0,
        status: 'green',
        lat: 30.6826831,
        lng: 76.6076298,
        radius: 150,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_frontgate_parking',
        name: 'Parking Zone 1',
        wifiSSIDs: [],
        maxCapacity: 100,
        currentCount: 0,
        status: 'green',
        lat: 30.6817030,
        lng: 76.6063299,
        radius: 100,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Frontgate',
        name: 'Gate 1',
        wifiSSIDs: [],
        maxCapacity: 100,
        currentCount: 0,
        status: 'green',
        lat: 30.6819245,
        lng: 76.6058046,
        radius: 80,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Applebees',
        name: 'AppleBees Ground',
        wifiSSIDs: [],
        maxCapacity: 100,
        currentCount: 0,
        status: 'green',
        lat: 30.6815450,
        lng: 76.6054545,
        radius: 100,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Girls_hostel',
        name: 'Girls Hostel 2',
        wifiSSIDs: [],
        maxCapacity: 500,
        currentCount: 0,
        status: 'green',
        lat: 30.6814625,
        lng: 76.6047280,
        radius: 150,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_Block7',
        name: 'Capgemini X CGC',
        wifiSSIDs: [],
        maxCapacity: 1000,
        currentCount: 0,
        status: 'green',
        lat: 30.6817541,
        lng: 76.6039552,
        radius: 150,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    },
    {
        zoneId: 'zone_boys_hostel',
        name: 'Boys Hostel',
        wifiSSIDs: [],
        maxCapacity: 2000,
        currentCount: 0,
        status: 'green',
        lat: 30.6811361,
        lng: 76.6039599,
        radius: 300,
        neighbors: ['zone_main_gate', 'zone_ground'],
        ipRanges: ['192.168.8.0/24']
    }
];

async function seed() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅  Connected to MongoDB');

        await Zone.deleteMany({});
        console.log('🗑️  Cleared existing zones');

        await Zone.insertMany(zones);
        console.log('🌱  Seeded 8 campus zones successfully!');

        zones.forEach(z => {
            console.log(`   📍 ${z.name} — capacity: ${z.maxCapacity}, SSIDs: [${z.wifiSSIDs.join(', ')}]`);
        });

        await mongoose.disconnect();
        console.log('\n✅  Done. Database seeded.');
        process.exit(0);
    } catch (err) {
        console.error('❌  Seed error:', err.message);
        process.exit(1);
    }
}

seed();
