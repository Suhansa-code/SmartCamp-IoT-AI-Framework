// =====================================================
// ESP32 FLOOD MONITORING SYSTEM
// Sensor: YL-83 / FC-37 Rain Sensor
// =====================================================

#define RAIN_DO 27
#define RAIN_AO 34

void setup() {

  Serial.begin(115200);

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