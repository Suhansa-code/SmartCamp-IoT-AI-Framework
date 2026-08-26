#include <HardwareSerial.h>
#include <DHT.h>

// =====================================================
// GPS — raw NMEA forwarded to Serial
// =====================================================

HardwareSerial GPSSerial(2);

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

}

// =====================================================
// Loop
// =====================================================

void loop() {

  // ===================================================
  // Forward raw NMEA sentences from GPS to Serial
  // The Python parser (sensor_state.py) reads lines
  // starting with $GPGGA or $GNGGA via pynmea2.
  // ===================================================

  while (GPSSerial.available() > 0) {

    Serial.write(GPSSerial.read());

  }


  // ===================================================
  // Read sensors every 2 seconds
  // ===================================================

  unsigned long currentMillis = millis();

  if (currentMillis - lastSensorRead >= SENSOR_INTERVAL) {

    lastSensorRead = currentMillis;

    // -------------------------------------------------
    // DHT11 — output format: TEMP:28.10|HUM:88.00
    // -------------------------------------------------

    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();

    if (!isnan(temperature) && !isnan(humidity)) {

      Serial.print("TEMP:");
      Serial.print(temperature, 2);
      Serial.print("|HUM:");
      Serial.println(humidity, 2);

    }


    // -------------------------------------------------
    // Rain sensor — output format: RAIN:4095|0|NO_RAIN|DRY
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


    Serial.print("RAIN:");
    Serial.print(rainAnalog);
    Serial.print("|");
    Serial.print(rainDigital);
    Serial.print("|");
    Serial.print(rainStatus);
    Serial.print("|");
    Serial.println(wetnessLevel);

  }

}
