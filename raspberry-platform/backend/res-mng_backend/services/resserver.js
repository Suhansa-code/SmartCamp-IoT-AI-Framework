// Smart Camp Box — Backend Server
// Handles fingerprint registration, wristband distribution,
// and SAAMP-aware MQTT publishing to EMQX broker.

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('../db/database');
const saamp = require('./saampMqtt');
const fingerprintRoute = require('../src/routes/fingerprint');
const checkinRoute = require('../src/routes/checkin');
const registerRoute = require('../src/routes/register');
const wristbandRoute = require('../src/routes/wristband');
const distributeRoute = require('../src/routes/distribute');
const networkRoute    = require('../src/routes/network');
const statsRoute      = require('../src/routes/stats');
const predictionRoute = require('../src/routes/prediction');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialise database tables
db.initialize();

// Connect to MQTT broker
saamp.connect();

// Routes
app.use('/api/fingerprint', fingerprintRoute);
app.use('/api/checkin', checkinRoute);
app.use('/api/register', registerRoute);
app.use('/api/wristband', wristbandRoute);
app.use('/api/distribute', distributeRoute);
app.use('/api/network',     networkRoute);
app.use('/api/stats',      statsRoute);
app.use('/api/prediction', predictionRoute);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'smartcamp-backend' });
});

app.listen(PORT, () => {
  console.log(`Smart Camp Box backend running on port ${PORT}`);
});
