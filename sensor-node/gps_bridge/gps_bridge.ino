#include <HardwareSerial.h>

HardwareSerial GPSSerial(2);

// GPS pins
#define GPS_RX 16   // ESP32 RX <- GPS TX
#define GPS_TX 17   // ESP32 TX -> GPS RX

// DHT11 pins
#define DHT_PIN 4   // ESP32 GPIO4 -> DHT11 DATA
#define DHT_TYPE 11

#include <DHT.h>

DHT dht(DHT_PIN, DHT_TYPE);

unsigned long lastDhtRead = 0;
const unsigned long DHT_INTERVAL = 2000; // read DHT11 every 2 seconds

void setup() {
  Serial.begin(115200);

  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  dht.begin();

  delay(1000);
  Serial.println("ESP32 GPS+DHT11 Bridge Started");
}

void loop() {
  // Forward GPS NMEA data to computer
  while (GPSSerial.available()) {
    char c = GPSSerial.read();
    Serial.write(c);
  }

  // Read and send DHT11 data every 2 seconds
  unsigned long now = millis();
  if (now - lastDhtRead >= DHT_INTERVAL) {
    lastDhtRead = now;

    float humidity = dht.readHumidity();
    float temperature = dht.readTemperature();

    if (!isnan(humidity) && !isnan(temperature)) {
      Serial.print("TEMP:");
      Serial.print(temperature, 2);
      Serial.print("|HUM:");
      Serial.println(humidity, 2);
    }
  }
}
