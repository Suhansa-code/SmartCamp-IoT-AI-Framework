// =====================================================
// ESP32-S3 FLOOD MONITORING SYSTEM
// Sensor: YL-83 / FC-37 Rain Sensor
// Wireless Communication to Raspberry Pi Edge Gateway
// =====================================================

#include <WiFi.h>
#include <HTTPClient.h>

// =====================================================
// CONFIGURATION
// =====================================================

// Raspberry Pi Hotspot
const char* WIFI_SSID = "CampNetowrk";

// Open/shared hotspot - NO PASSWORD
const char* WIFI_PASSWORD = "";

// IMPORTANT:
// Replace 192.168.X.X with the Raspberry Pi hotspot IP.
// See instructions below to find it.
const char* EDGE_GATEWAY_URL = "http://192.168.0.2:8000";

// Device ID
const char* DEVICE_ID = "RAIN-001";

// =====================================================
// ESP32-S3 PIN CONFIGURATION
// =====================================================

// Rain Sensor
#define RAIN_AO 4
#define RAIN_DO 5

// Wi-Fi Status LED
#define WIFI_LED 2

// =====================================================
// TIMING CONFIGURATION
// =====================================================

const unsigned long SEND_INTERVAL_MS = 2000;
const unsigned long RECONNECT_INTERVAL_MS = 5000;

unsigned long lastSendTime = 0;
unsigned long lastReconnectAttempt = 0;


// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(1000);

  analogReadResolution(12);

  pinMode(RAIN_DO, INPUT);

  pinMode(WIFI_LED, OUTPUT);

  digitalWrite(WIFI_LED, LOW);

  Serial.println();
  Serial.println("========================================");
  Serial.println("     ESP32-S3 FLOOD MONITORING SYSTEM");
  Serial.println("========================================");

  Serial.println("Sensor: YL-83 / FC-37");

  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);

  Serial.print("Wi-Fi Network: ");
  Serial.println(WIFI_SSID);

  Serial.print("Edge Gateway: ");
  Serial.println(EDGE_GATEWAY_URL);

  Serial.println();

  connectToWiFi();
}


// =====================================================
// CONNECT TO WI-FI
// =====================================================

void connectToWiFi() {

  Serial.print("Connecting to CampNetowrk");

  WiFi.mode(WIFI_STA);

  // Open Wi-Fi network - empty password
  WiFi.begin(WIFI_SSID);

  int attempt = 0;

  while (WiFi.status() != WL_CONNECTED && attempt < 20) {

    delay(500);

    Serial.print(".");

    digitalWrite(WIFI_LED, LOW);

    attempt++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi Connected Successfully!");

    Serial.print("ESP32-S3 IP Address: ");
    Serial.println(WiFi.localIP());

    Serial.print("Connected Wi-Fi: ");
    Serial.println(WIFI_SSID);

    digitalWrite(WIFI_LED, HIGH);

  } else {

    Serial.println("Wi-Fi Connection Failed!");

    digitalWrite(WIFI_LED, LOW);
  }
}


// =====================================================
// ENSURE WI-FI CONNECTION
// =====================================================

void ensureWiFi() {

  if (WiFi.status() == WL_CONNECTED) {

    digitalWrite(WIFI_LED, HIGH);

    return;
  }

  digitalWrite(WIFI_LED, LOW);

  unsigned long currentTime = millis();

  if (currentTime - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {

    lastReconnectAttempt = currentTime;

    Serial.println("Wi-Fi disconnected. Reconnecting...");

    WiFi.disconnect();

    delay(100);

    // Open Wi-Fi network
    WiFi.begin(WIFI_SSID);
  }
}


// =====================================================
// SEND RAINFALL DATA TO RASPBERRY PI
// =====================================================

void sendRainfallData(
  int rainAnalog,
  int rainDigital,
  String rainStatus,
  String floodRisk
) {

  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Wi-Fi disconnected - data not sent");

    return;
  }

  HTTPClient http;

  String url = String(EDGE_GATEWAY_URL) + "/api/rainfall";

  Serial.print("Sending data to: ");
  Serial.println(url);

  http.begin(url);

  http.addHeader("Content-Type", "application/json");

  // Development timestamp
  String timestamp = String(millis());

  // Create JSON
  String json = "{";

  json += "\"device_id\":\"";
  json += DEVICE_ID;
  json += "\",";

  json += "\"rain_analog\":";
  json += String(rainAnalog);
  json += ",";

  json += "\"rain_digital\":";
  json += String(rainDigital);
  json += ",";

  json += "\"rain_status\":\"";
  json += rainStatus;
  json += "\",";

  json += "\"flood_risk\":\"";
  json += floodRisk;
  json += "\",";

  json += "\"timestamp\":\"";
  json += timestamp;
  json += "\"";

  json += "}";

  Serial.print("JSON Data: ");
  Serial.println(json);

  int responseCode = http.POST(json);

  if (responseCode > 0) {

    Serial.print("HTTP Response Code: ");
    Serial.println(responseCode);

    String response = http.getString();

    Serial.print("Server Response: ");
    Serial.println(response);

  } else {

    Serial.print("HTTP Error: ");

    Serial.println(
      http.errorToString(responseCode)
    );
  }

  http.end();
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  unsigned long currentTime = millis();


  // -----------------------------------------------------
  // CHECK WI-FI
  // -----------------------------------------------------

  ensureWiFi();


  // -----------------------------------------------------
  // READ RAIN SENSOR
  // -----------------------------------------------------

  int rainAnalog = analogRead(RAIN_AO);

  int rainDigital = digitalRead(RAIN_DO);


  // -----------------------------------------------------
  // DETERMINE RAIN CONDITION
  // -----------------------------------------------------

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


  // -----------------------------------------------------
  // SEND DATA EVERY 2 SECONDS
  // -----------------------------------------------------

  if (currentTime - lastSendTime >= SEND_INTERVAL_MS) {

    lastSendTime = currentTime;

    sendRainfallData(
      rainAnalog,
      rainDigital,
      rainStatus,
      floodRisk
    );
  }


  // -----------------------------------------------------
  // DISPLAY SENSOR INFORMATION
  // -----------------------------------------------------

  static unsigned long lastDisplayTime = 0;

  if (currentTime - lastDisplayTime >= 1000) {

    lastDisplayTime = currentTime;

    Serial.println();

    Serial.println("----------------------------------------");

    Serial.print("Rain Sensor Value : ");
    Serial.println(rainAnalog);

    Serial.print("Digital Detection : ");

    if (rainDigital == LOW) {
      Serial.println("DETECTED");
    } else {
      Serial.println("NOT DETECTED");
    }

    Serial.print("Rain Condition    : ");
    Serial.println(rainStatus);

    Serial.print("Flood Risk        : ");
    Serial.println(floodRisk);

    Serial.print("Wi-Fi Status      : ");

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("Connected");
    } else {
      Serial.println("Disconnected");
    }

    Serial.print("ESP32-S3 IP       : ");

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println(WiFi.localIP());
    } else {
      Serial.println("Not Connected");
    }

    Serial.print("Raspberry Pi      : ");
    Serial.println(EDGE_GATEWAY_URL);

    Serial.println("----------------------------------------");
  }
}

