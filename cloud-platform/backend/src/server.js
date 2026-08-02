import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import networkRoutes              from './routes/network.js';
import resourceRoutes             from './routes/resources.js';
import disasterRoutes             from './routes/disaster.js';
import alertRoutes                from './routes/alerts.js';
import { MqttService }            from './services/mqtt.js';
import { NetworkMonitor }         from './services/networkMonitor.js';
import { SimulationService }      from './services/simulation.js';
import { startCampDataService }   from './services/campDataService.js';
import { AlertSyncService }       from './services/alertSyncService.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const mqttService = new MqttService();
const networkMonitor = new NetworkMonitor(mqttService);
const simulationService = new SimulationService(networkMonitor);
const alertSyncService = new AlertSyncService(mqttService.client);

app.use('/api/network',    networkRoutes(networkMonitor));
app.use('/api/resources', resourceRoutes);
app.use('/api/disaster', disasterRoutes());
app.use('/api/alerts',    alertRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

async function startServer() {
  try {
    if (process.env.ENABLE_SIMULATION === 'true') {
      simulationService.start();
      console.log('[Simulation] Started - generating mock network data');
    } else {
      await mqttService.connect();
      console.log('[MQTT] Connected to broker');
      
      // Start alert sync service after MQTT connection
      alertSyncService.start();
      console.log('[AlertSync] Alert sync service started');
    }

    networkMonitor.start();
    console.log('[Monitor] Network monitoring started');

    // Subscribe to camp MQTT events from EMQX for the cloud dashboard
    startCampDataService();
    console.log('[Camp Data] Camp data service started');

    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  console.log('[Server] Shutting down...');
  simulationService.stop();
  alertSyncService.stop();
  mqttService.disconnect();
  process.exit(0);
});

startServer();
