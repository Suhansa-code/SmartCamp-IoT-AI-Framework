#include <HardwareSerial.h>
#include <DHT.h>
#include <TinyGPSPlus.h>

// =====================================================
// GPS
// =====================================================

HardwareSerial GPSSerial(2);
TinyGPSPlus gps;

#define GPS_RX 16
#define GPS_TX 17

// =====================================================
// DHT11
// =====================================================

#define DHT_PIN 4
#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// =====================================================
// YL-83 / FC-37 Rain Sensor
// =====================================================

#define RAIN_DO 27
#define RAIN_AO 34

// =====================================================
// Timing
// =====================================================

unsigned long lastSensorRead = 0;

const unsigned long SENSOR_INTERVAL = 2000;

// =====================================================
// Setup
// =====================================================

void setup() {

  Serial.begin(115200);

  // GPS
  GPSSerial.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);

  // DHT11
  dht.begin();

  // Rain sensor
  pinMode(RAIN_DO, INPUT);

  delay(1000);

  Serial.println();
  Serial.println("==========================================");
  Serial.println("      ESP32 FLOOD MONITORING SYSTEM");
  Serial.println("==========================================");
  Serial.println();

}

// =====================================================
// Loop
// =====================================================

void loop() {

  // ===================================================
  // Read GPS data
  // ===================================================

  while (GPSSerial.available() > 0) {

    gps.encode(GPSSerial.read());

  }


  // ===================================================
  // Read sensors every 2 seconds
  // ===================================================

  unsigned long currentMillis = millis();

  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {

    lastSensorRead = currentMillis;

    // -------------------------------------------------
    // DHT11
    // -------------------------------------------------

    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();


    // -------------------------------------------------
    // Rain sensor
    // -------------------------------------------------

    int rainAnalog = analogRead(RAIN_AO);
    int rainDigital = digitalRead(RAIN_DO);


    String rainStatus;
    String wetnessLevel;


    if (rainDigital == LOW) {

      rainStatus = "RAIN_DETECTED";

    } else {

      rainStatus = "NO_RAIN";

    }


    if (rainAnalog > 3500) {

      wetnessLevel = "DRY";

    }
    else if (rainAnalog > 2500) {

      wetnessLevel = "LIGHT";

    }
    else if (rainAnalog > 1500) {

      wetnessLevel = "MODERATE";

    }
    else {

      wetnessLevel = "HEAVY";

    }


    // =================================================
    // Display
    // =================================================

    Serial.println();
    Serial.println("==========================================");
    Serial.println("           SENSOR DATA");
    Serial.println("==========================================");


    // -------------------------------------------------
    // GPS
    // -------------------------------------------------

    Serial.println("[GPS]");

    if (gps.location.isValid()) {

      Serial.print("Latitude    : ");
      Serial.println(gps.location.lat(), 6);

      Serial.print("Longitude   : ");
      Serial.println(gps.location.lng(), 6);

    }
    else {

      Serial.println("Location    : NO FIX");

    }


    if (gps.altitude.isValid()) {

      Serial.print("Altitude    : ");
      Serial.print(gps.altitude.meters());
      Serial.println(" m");

    }


    if (gps.satellites.isValid()) {

      Serial.print("Satellites  : ");
      Serial.println(gps.satellites.value());

    }


    // -------------------------------------------------
    // DHT11
    // -------------------------------------------------

    Serial.println();
    Serial.println("[DHT11]");

    if (!isnan(temperature) && !isnan(humidity)) {

      Serial.print("Temperature : ");
      Serial.print(temperature, 2);
      Serial.println(" °C");

      Serial.print("Humidity    : ");
      Serial.print(humidity, 2);
      Serial.println(" %");

    }
    else {

      Serial.println("DHT11       : SENSOR ERROR");

    }


    // -------------------------------------------------
    // Rain Sensor
    // -------------------------------------------------

    Serial.println();
    Serial.println("[RAIN SENSOR]");

    Serial.print("Analog Value: ");
    Serial.println(rainAnalog);

    Serial.print("Digital     : ");

    if (rainDigital == LOW) {

      Serial.println("DETECTED");

    }
    else {

      Serial.println("NOT DETECTED");

    }


    Serial.print("Rain Status : ");
    Serial.println(rainStatus);

    Serial.print("Wetness     : ");
    Serial.println(wetnessLevel);


    // -------------------------------------------------
    // End
    // -------------------------------------------------

    Serial.println("==========================================");

  }

}