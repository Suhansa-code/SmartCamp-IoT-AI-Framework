/*
 * SmartCamp ESP32 GPS Bridge
 * 
 * Reads NMEA sentences from NEO-8 GPS module (connected to Serial2)
 * and forwards them via USB Serial for the Node.js backend to consume.
 * 
 * Hardware wiring:
 *   NEO-8 TX  → ESP32 GPIO16 (Serial2 RX)
 *   NEO-8 RX  → ESP32 GPIO17 (Serial2 TX)
 *   NEO-8 VCC → 3.3V
 *   NEO-8 GND → GND
 * 
 * Board: ESP32 Dev Module
 * Upload speed: 921600
 */

#define GPS_BAUD 9600
#define USB_BAUD 115200
#define GPS_RX_PIN 16
#define GPS_TX_PIN 17

void setup() {
  Serial.begin(USB_BAUD);
  Serial2.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  delay(1000);
  Serial.println("[GPS-BRIDGE] NEO-8 GPS bridge started");
}

void loop() {
  while (Serial2.available()) {
    char c = Serial2.read();
    Serial.write(c);
  }
}
