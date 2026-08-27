// =====================================================
// ESP32 FLOOD MONITORING SYSTEM
// Sensor: YL-83 / FC-37 Rain Sensor
// =====================================================
#include <WiFi.h>
#include <HTTPClient.h>

const char* WIFI_SSID = "SmartCamp-Rain";
const char* WIFI_PASSWORD = "SmartCamp123";
const char* SERVER_URL = "http://192.168.137.1:8000/api/rainfall";

#define RAIN_DO 27
#define RAIN_AO 34

void setup() {

  Serial.begin(115200);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("Connecting to Wi-Fi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("Wi-Fi Connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());

  pinMode(RAIN_DO, INPUT);

  delay(1000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("      ESP32 FLOOD MONITORING SYSTEM");
  Serial.println("========================================");
  Serial.println("Sensor: YL-83 / FC-37");
  Serial.println();
}

void loop() {

  // ---------------------------------------------------
  // Read sensor
  // ---------------------------------------------------

  int rainAnalog = analogRead(RAIN_AO);
  int rainDigital = digitalRead(RAIN_DO);

  // ---------------------------------------------------
  // Determine rain condition
  // ---------------------------------------------------

  String rainStatus;
  String floodRisk;

  if (rainDigital == HIGH && rainAnalog > 3500) {

    rainStatus = "NO RAIN";
    floodRisk = "LOW";

  }
  else if (rainAnalog > 2500) {

    rainStatus = "LIGHT RAIN";
    floodRisk = "LOW";

  }
  else if (rainAnalog > 1500) {

    rainStatus = "RAIN DETECTED";
    floodRisk = "MODERATE";

  }
  else {

    rainStatus = "HEAVY WETNESS";
    floodRisk = "HIGH";
  }

  if (WiFi.status() == WL_CONNECTED) {

    HTTPClient http;

    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");

    String json = "{";
    json += "\"rain_analog\":" + String(rainAnalog) + ",";
    json += "\"rain_digital\":" + String(rainDigital) + ",";
    json += "\"rain_status\":\"" + rainStatus + "\",";
    json += "\"flood_risk\":\"" + floodRisk + "\"";
    json += "}";

    int responseCode = http.POST(json);

    Serial.print("HTTP Response: ");
    Serial.println(responseCode);

    http.end();

  } else {
    Serial.println("Wi-Fi disconnected");
  }
  // ---------------------------------------------------
  // Display results
  // ---------------------------------------------------

  Serial.println("----------------------------------------");

  Serial.print("Rain Sensor Value : ");
  Serial.println(rainAnalog);

  Serial.print("Digital Detection : ");

  if (rainDigital == LOW) {
    Serial.println("DETECTED");
  }
  else {
    Serial.println("NOT DETECTED");
  }

  Serial.print("Rain Condition    : ");
  Serial.println(rainStatus);

  Serial.print("Flood Risk        : ");
  Serial.println(floodRisk);

  Serial.println("----------------------------------------");

  delay(2000);
}