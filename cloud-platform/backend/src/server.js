import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import networkRoutes from './routes/network.js';
import { MqttService } from './services/mqtt.js';
import { NetworkMonitor } from './services/networkMonitor.js';
import { SimulationService } from './services/simulation.js';

config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const mqttService = new MqttService();
const networkMonitor = new NetworkMonitor(mqttService);
const simulationService = new SimulationService(networkMonitor);

app.use('/api/network', networkRoutes(networkMonitor));

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
    }

    networkMonitor.start();
    console.log('[Monitor] Network monitoring started');

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
  mqttService.disconnect();
  process.exit(0);
});

startServer();
