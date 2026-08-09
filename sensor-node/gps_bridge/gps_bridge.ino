#include <HardwareSerial.h>

HardwareSerial GPSSerial(2);

// GPS pins
#define GPS_RX 16   // ESP32 RX <- GPS TX
#define GPS_TX 17   // ESP32 TX -> GPS RX

void setup() {
  // ESP32 USB Serial -> Computer
  Serial.begin(115200);

  // GPS module -> ESP32
  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  delay(1000);

  Serial.println("ESP32 GPS Reader Started");
}

void loop() {
  while (GPSSerial.available()) {
    char c = GPSSerial.read();

    // Forward GPS NMEA data to computer
    Serial.write(c);
  }
}