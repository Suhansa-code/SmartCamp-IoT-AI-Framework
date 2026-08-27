// =====================================================
// ESP32 FLOOD MONITORING SYSTEM
// Sensor: YL-83 / FC-37 Rain Sensor
// Wireless Communication to Edge Gateway
// =====================================================

#include <WiFi.h>
#include <HTTPClient.h>

// ── Configuration ──────────────────────────────────────
const char* WIFI_SSID = "SmartCamp-Rain";
const char* WIFI_PASSWORD = "SmartCamp123";
const char* EDGE_GATEWAY_URL = "http://192.168.137.1:8000";
const char* DEVICE_ID = "RAIN-001";

// ── Sensor Pins ────────────────────────────────────────
#define RAIN_DO 27
#define RAIN_AO 34

// ── Wi-Fi LED ──────────────────────────────────────────
#define WIFI_LED 2

// ── Timing ─────────────────────────────────────────────
const unsigned long SEND_INTERVAL_MS = 2000;
const unsigned long RECONNECT_INTERVAL_MS = 5000;

unsigned long lastSendTime = 0;
unsigned long lastReconnectAttempt = 0;

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  // Initialize sensor
  pinMode(RAIN_DO, INPUT);

  // Initialize Wi-Fi LED BEFORE Wi-Fi connection
  pinMode(WIFI_LED, OUTPUT);
  digitalWrite(WIFI_LED, LOW);

  Serial.println();
  Serial.println("========================================");
  Serial.println("      ESP32 FLOOD MONITORING SYSTEM");
  Serial.println("========================================");
  Serial.println("Sensor: YL-83 / FC-37");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Edge Gateway: ");
  Serial.println(EDGE_GATEWAY_URL);
  Serial.println();

  // Connect to Wi-Fi
  connectToWiFi();
}

// =====================================================
// CONNECT TO WI-FI
// =====================================================

void connectToWiFi() {

  Serial.print("Connecting to Wi-Fi");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempt = 0;

  while (WiFi.status() != WL_CONNECTED && attempt < 20) {

    delay(500);
    Serial.print(".");

    // Keep LED OFF while connecting
    digitalWrite(WIFI_LED, LOW);

    attempt++;
  }

  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi Connected!");

    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());

    // LED ON = Wi-Fi connected
    digitalWrite(WIFI_LED, HIGH);

  } else {

    Serial.println("Wi-Fi connection failed!");

    // LED OFF = Wi-Fi disconnected
    digitalWrite(WIFI_LED, LOW);
  }
}

// =====================================================
// CHECK WI-FI CONNECTION
// =====================================================

void ensureWiFi() {

  if (WiFi.status() == WL_CONNECTED) {

    // Wi-Fi connected → LED ON
    digitalWrite(WIFI_LED, HIGH);

    return;
  }

  // Wi-Fi disconnected → LED OFF
  digitalWrite(WIFI_LED, LOW);

  unsigned long currentTime = millis();

  // Prevent continuous reconnection attempts
  if (currentTime - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {

    lastReconnectAttempt = currentTime;

    Serial.println("Wi-Fi disconnected. Reconnecting...");

    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }
}

// =====================================================
// SEND RAINFALL DATA
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

  http.begin(url);

  http.addHeader("Content-Type", "application/json");

  // millis() timestamp for current development testing
  String timestamp = String(millis());

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

  int responseCode = http.POST(json);

  if (responseCode > 0) {

    Serial.print("HTTP Response: ");
    Serial.println(responseCode);

  } else {

    Serial.print("HTTP Error: ");
    Serial.println(http.errorToString(responseCode));
  }

  http.end();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  unsigned long currentTime = millis();

  // ── Check Wi-Fi ──────────────────────────────────────
  ensureWiFi();

  // ── Read rainfall sensor ─────────────────────────────
  int rainAnalog = analogRead(RAIN_AO);
  int rainDigital = digitalRead(RAIN_DO);

  // ── Determine rain condition ─────────────────────────
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

  // ── Send data every 2 seconds ────────────────────────
  if (currentTime - lastSendTime >= SEND_INTERVAL_MS) {

    lastSendTime = currentTime;

    sendRainfallData(
      rainAnalog,
      rainDigital,
      rainStatus,
      floodRisk
    );
  }

  // ── Display information every second ────────────────
  static unsigned long lastDisplayTime = 0;

  if (currentTime - lastDisplayTime >= 1000) {

    lastDisplayTime = currentTime;

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

    Serial.println("----------------------------------------");
  }
}