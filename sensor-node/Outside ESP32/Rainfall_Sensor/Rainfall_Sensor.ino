// =====================================================
// ESP32 FLOOD MONITORING SYSTEM
// Sensor: YL-83 / FC-37 Rain Sensor
// Wireless Communication to Edge Gateway
// =====================================================
#include <WiFi.h>
#include <HTTPClient.h>

// ── Configuration (change for production) ───────────────────────────────
const char* WIFI_SSID = "SmartCamp-Rain";
const char* WIFI_PASSWORD = "SmartCamp123";
const char* EDGE_GATEWAY_URL = "http://192.168.137.1:8000";
const char* DEVICE_ID = "RAIN-001";

// ── Sensor Pins ─────────────────────────────────────────────────────────
#define RAIN_DO 27
#define RAIN_AO 34

// ── Timing ──────────────────────────────────────────────────────────────
const unsigned long SEND_INTERVAL_MS = 2000;
const unsigned long RECONNECT_INTERVAL_MS = 5000;
const int MAX_RETRY_ATTEMPTS = 3;

void setup() {
  Serial.begin(115200);
  
  // Initialize sensor pin
  pinMode(RAIN_DO, INPUT);
  
  // Connect to Wi-Fi
  connectToWiFi();
  
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
}

void connectToWiFi() {
  Serial.print("Connecting to Wi-Fi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED && attempt < 20) {
    delay(500);
    Serial.print(".");
    attempt++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("Wi-Fi Connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Wi-Fi connection failed! Will retry...");
  }
}

void ensureWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected, reconnecting...");
    WiFi.disconnect();
    delay(1000);
    connectToWiFi();
  }
}

void loop() {
  static unsigned long lastSendTime = 0;
  unsigned long currentTime = millis();
  
  // Check Wi-Fi connection
  ensureWiFi();
  
  // Read sensor
  int rainAnalog = analogRead(RAIN_AO);
  int rainDigital = digitalRead(RAIN_DO);
  
  // Determine rain condition
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
  
  // Send data at configured interval
  if (currentTime - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentTime;
    
    if (WiFi.status() == WL_CONNECTED) {
      HTTPClient http;
      String url = String(EDGE_GATEWAY_URL) + "/api/rainfall";
      
      http.begin(url);
      http.addHeader("Content-Type", "application/json");
      
      // Get timestamp
      String timestamp = String(currentTime);
      
      String json = "{";
      json += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
      json += "\"rain_analog\":" + String(rainAnalog) + ",";
      json += "\"rain_digital\":" + String(rainDigital) + ",";
      json += "\"rain_status\":\"" + rainStatus + "\",";
      json += "\"flood_risk\":\"" + floodRisk + "\",";
      json += "\"timestamp\":\"" + timestamp + "\"";
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
    } else {
      Serial.println("Wi-Fi disconnected - data not sent");
    }
  }
  
  // Display results (every second)
  static unsigned long lastDisplayTime = 0;
  if (currentTime - lastDisplayTime >= 1000) {
    lastDisplayTime = currentTime;
    
    Serial.println("----------------------------------------");
    Serial.print("Rain Sensor Value : ");
    Serial.println(rainAnalog);
    Serial.print("Digital Detection : ");
    Serial.println(rainDigital == LOW ? "DETECTED" : "NOT DETECTED");
    Serial.print("Rain Condition    : ");
    Serial.println(rainStatus);
    Serial.print("Flood Risk        : ");
    Serial.println(floodRisk);
    Serial.print("Wi-Fi Status      : ");
    Serial.println(WiFi.status() == WL_CONNECTED ? "Connected" : "Disconnected");
    Serial.println("----------------------------------------");
  }
}