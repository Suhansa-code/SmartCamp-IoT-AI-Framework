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

// Wi-Fi / Mobile Hotspot Credentials
const char* WIFI_SSID = "SmartCamp-Rain";
const char* WIFI_PASSWORD = "SmartCamp123";
const char* EDGE_GATEWAY_URL = "http://192.168.137.1:8000";

// Device ID
const char* DEVICE_ID = "RAIN-001";

// =====================================================
// ESP32-S3 PIN CONFIGURATION
// =====================================================

// Rain Sensor Pins
// Board pin labelled "4" = GPIO4
#define RAIN_AO 4

// Board pin labelled "5" = GPIO5
#define RAIN_DO 5

// External Wi-Fi Status LED
// Board pin labelled "2" = GPIO2
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

  // Set ESP32-S3 ADC resolution
  // Range: 0 to 4095
  analogReadResolution(12);

  // Initialize Rain Sensor Digital Pin
  pinMode(RAIN_DO, INPUT);

  // Initialize Wi-Fi Status LED
  pinMode(WIFI_LED, OUTPUT);

  // LED OFF at startup
  digitalWrite(WIFI_LED, LOW);


  Serial.println();
  Serial.println("========================================");
  Serial.println("     ESP32-S3 FLOOD MONITORING SYSTEM");
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

  // Set ESP32-S3 to Wi-Fi Station Mode
  WiFi.mode(WIFI_STA);

  // Start Wi-Fi Connection
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempt = 0;

  // Try connecting for approximately 10 seconds
  while (WiFi.status() != WL_CONNECTED && attempt < 20) {

    delay(500);

    Serial.print(".");

    // Keep LED OFF while connecting
    digitalWrite(WIFI_LED, LOW);

    attempt++;
  }

  Serial.println();

  // Check Connection Result
  if (WiFi.status() == WL_CONNECTED) {

    Serial.println("Wi-Fi Connected Successfully!");

    Serial.print("ESP32-S3 IP Address: ");
    Serial.println(WiFi.localIP());

    Serial.print("Connected Wi-Fi: ");
    Serial.println(WIFI_SSID);

    // LED ON = Wi-Fi successfully connected
    digitalWrite(WIFI_LED, HIGH);

  } else {

    Serial.println("Wi-Fi Connection Failed!");

    // LED OFF = Wi-Fi disconnected
    digitalWrite(WIFI_LED, LOW);
  }
}


// =====================================================
// ENSURE WI-FI CONNECTION
// =====================================================

void ensureWiFi() {

  // If Wi-Fi is connected
  if (WiFi.status() == WL_CONNECTED) {

    // LED ON
    digitalWrite(WIFI_LED, HIGH);

    return;
  }

  // Wi-Fi disconnected
  // LED OFF
  digitalWrite(WIFI_LED, LOW);

  unsigned long currentTime = millis();

  // Reconnect after the configured interval
  if (currentTime - lastReconnectAttempt >= RECONNECT_INTERVAL_MS) {

    lastReconnectAttempt = currentTime;

    Serial.println("Wi-Fi disconnected. Reconnecting...");

    WiFi.disconnect();

    delay(100);

    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
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

  // Do not send if Wi-Fi is disconnected
  if (WiFi.status() != WL_CONNECTED) {

    Serial.println("Wi-Fi disconnected - data not sent");

    return;
  }


  HTTPClient http;

  // Raspberry Pi API Endpoint
  String url = String(EDGE_GATEWAY_URL) + "/api/rainfall";

  Serial.print("Sending data to: ");
  Serial.println(url);


  // Start HTTP Connection
  http.begin(url);

  // Set JSON Content Type
  http.addHeader("Content-Type", "application/json");


  // Development timestamp
  String timestamp = String(millis());


  // Create JSON Data
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


  // Display JSON in Serial Monitor
  Serial.print("JSON Data: ");
  Serial.println(json);


  // Send POST Request
  int responseCode = http.POST(json);


  // Check Response
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


  // Close HTTP Connection
  http.end();
}


// =====================================================
// LOOP
// =====================================================

void loop() {

  unsigned long currentTime = millis();


  // -----------------------------------------------------
  // CHECK WI-FI CONNECTION
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


  // No Rain
  if (rainDigital == HIGH && rainAnalog > 3500) {

    rainStatus = "NO RAIN";

    floodRisk = "LOW";

  }


  // Light Rain
  else if (rainAnalog > 2500) {

    rainStatus = "LIGHT RAIN";

    floodRisk = "LOW";

  }


  // Rain Detected
  else if (rainAnalog > 1500) {

    rainStatus = "RAIN DETECTED";

    floodRisk = "MODERATE";

  }


  // Heavy Wetness
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


    Serial.println("----------------------------------------");
  }
}