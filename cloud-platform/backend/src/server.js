import { createApp } from './app.js';
import { MqttService } from './services/network/mqtt.service.js';
import { NetworkMonitor } from './services/network/networkMonitor.service.js';
import { SimulationService } from './services/network/simulation.service.js';
import { startCampDataService } from './services/resources/campData.service.js';
import { AlertSyncService } from './services/education/alertSync.service.js';
import { env } from './config/env.js';

const mqttService = new MqttService();
const networkMonitor = new NetworkMonitor(mqttService);
const simulationService = new SimulationService(networkMonitor);
const alertSyncService = new AlertSyncService(mqttService);

const app = createApp({ monitor: networkMonitor });

async function startServer() {
  try {
    if (env.enableSimulation) {
      await simulationService.start();
      console.log('[Simulation] Started - generating mock network data');
    } else {
      await mqttService.connect();
      console.log('[MQTT] Connected to broker');

      alertSyncService.start();
      console.log('[AlertSync] Alert sync service started');
    }

    networkMonitor.start();
    console.log('[Monitor] Network monitoring started');

    startCampDataService();
    console.log('[Camp Data] Camp data service started');

    app.listen(env.port, () => {
      console.log(`[Server] Running on port ${env.port}`);
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