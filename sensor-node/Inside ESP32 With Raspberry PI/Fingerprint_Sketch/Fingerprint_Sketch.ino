#include <Adafruit_Fingerprint.h>

// Hardware UART Pins on XIAO ESP32-C3
#define RX_PIN 20 // Connect to R503 Yellow (TXD)
#define TX_PIN 21 // Connect to R503 Green (RXD)

HardwareSerial mySerial(1);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// Define LED Colors for R503
#define R503_LED_RED   0x01
#define R503_LED_BLUE  0x02
#define R503_LED_GREEN 0x03

// Function Prototypes
void displayMenu();
void enrollFingerprint();
void authenticateFingerprint();
void deleteFingerprint();
void emptyDatabase();
void databaseStatus();
bool waitForFinger(unsigned long timeoutMs);
void waitForFingerRelease(unsigned long timeoutMs);
uint8_t readNumber();

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  // Initialize hardware serial for R503 at 57600 baud
  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);

  Serial.println("\n========================================");
  Serial.println("     XIAO ESP32-C3 + R503 FINGERPRINT   ");
  Serial.println("========================================");

  if (finger.verifyPassword()) {
    Serial.println("R503 sensor detected successfully!");
  } else {
    Serial.println("Did not find R503 sensor!");
    Serial.println("Check RX/TX wiring, GND, and power connection.");
    while (1) { delay(1); }
  }

  // Load sensor details
  finger.getParameters();
  finger.getTemplateCount();
  
  Serial.print("Stored fingerprints: "); Serial.println(finger.templateCount);
  Serial.print("Sensor capacity:     "); Serial.println(finger.capacity);

  // Brief LED test cycle (Red -> Blue -> Green)
  finger.LEDcontrol(FINGERPRINT_LED_ON, 0, R503_LED_RED, 0);
  delay(400);
  finger.LEDcontrol(FINGERPRINT_LED_ON, 0, R503_LED_BLUE, 0);
  delay(400);
  finger.LEDcontrol(FINGERPRINT_LED_ON, 0, R503_LED_GREEN, 0);
  delay(400);
  finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, R503_LED_RED, 0);

  displayMenu();
}

void loop() {
  if (Serial.available() > 0) {
    char option = Serial.read();

    if (option == '\n' || option == '\r') return;

    switch (option) {
      case '1':
        enrollFingerprint();
        displayMenu();
        break;
      case '2':
        authenticateFingerprint();
        displayMenu();
        break;
      case '3':
        deleteFingerprint();
        displayMenu();
        break;
      case '4':
        emptyDatabase();
        displayMenu();
        break;
      case '5':
        databaseStatus();
        displayMenu();
        break;
      case 'M':
      case 'm':
        displayMenu();
        break;
      default:
        break;
    }
  }
}

void displayMenu() {
  Serial.println("\n----------------------------------------");
  Serial.println("                MAIN MENU               ");
  Serial.println("----------------------------------------");
  Serial.println("1 - Add / Enroll fingerprint");
  Serial.println("2 - Authenticate fingerprint");
  Serial.println("3 - Delete fingerprint");
  Serial.println("4 - Delete ALL fingerprints");
  Serial.println("5 - Database status");
  Serial.println("M - Show menu");
  Serial.println("----------------------------------------");
  Serial.print("Enter option: ");
}

void enrollFingerprint() {
  Serial.println("\n========================================");
  Serial.println("           ENROLL FINGERPRINT           ");
  Serial.println("========================================");
  
  Serial.print("\nEnter fingerprint ID (1-200): ");
  uint8_t id = readNumber();

  if (id < 1 || id > 200) {
    Serial.println("\nInvalid ID. Must be between 1 and 200.");
    return;
  }

  // STEP 1: Breathing Blue Light while waiting
  Serial.println("\nSTEP 1: Place finger firmly on sensor...");
  finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, R503_LED_BLUE, 0);
  
  if (!waitForFinger(10000)) return;
  
  // Convert image to template slot 1 (image was captured inside waitForFinger)
  int p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    Serial.print("Failed to process image 1. Error code: "); Serial.println(p);
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
    return;
  }
  
  Serial.println("First scan captured! Lift finger...");
  finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, R503_LED_BLUE, 0);
  
  // Wait for user to lift finger
  waitForFingerRelease(5000);

  // STEP 2: Breathing Blue Light again
  Serial.println("\nSTEP 2: Place the SAME finger again...");
  finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, R503_LED_BLUE, 0);

  if (!waitForFinger(10000)) return;

  // Convert image to template slot 2
  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    Serial.print("Failed to process image 2. Error code: "); Serial.println(p);
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
    return;
  }

  // Create unified model
  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println("Fingerprints did not match across both scans.");
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
    return;
  }

  // Store model
  p = finger.storeModel(id);
  if (p == FINGERPRINT_OK) {
    finger.LEDcontrol(FINGERPRINT_LED_ON, 0, R503_LED_GREEN, 0);
    Serial.println("\n**************************************");
    Serial.println("       FINGERPRINT ENROLLED!          ");
    Serial.println("**************************************");
    Serial.print("Saved at ID #: "); Serial.println(id);
    delay(2000);
    finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, R503_LED_GREEN, 0);
  } else {
    Serial.print("Error storing fingerprint. Error code: "); Serial.println(p);
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
  }
}
void authenticateFingerprint() {
  Serial.println("\n========================================");
  Serial.println("            AUTHENTICATION              ");
  Serial.println("========================================");
  Serial.println("\nPlace finger firmly on the sensor...");

  // LED Breathing Blue
  finger.LEDcontrol(FINGERPRINT_LED_BREATHING, 100, R503_LED_BLUE, 0);

  // 1. Wait for finger presence & capture image
  if (!waitForFinger(10000)) return;

  // 2. Convert image to feature template in slot 1
  int p = finger.image2Tz(1); 
  if (p != FINGERPRINT_OK) {
    Serial.print("Error converting image. Code: "); Serial.println(p);
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
    return;
  }

  // 3. Search database using standard fingerSearch() instead of fingerFastSearch()
  p = finger.fingerSearch();
  
  if (p == FINGERPRINT_OK) {
    finger.LEDcontrol(FINGERPRINT_LED_ON, 0, R503_LED_GREEN, 0);
    Serial.println("\n**************************************");
    Serial.println("           ACCESS GRANTED             ");
    Serial.println("**************************************");
    Serial.print("Matched ID #: "); Serial.println(finger.fingerID);
    Serial.print("Confidence:   "); Serial.println(finger.confidence);
  } else if (p == FINGERPRINT_NOTFOUND) {
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
    Serial.println("\n**************************************");
    Serial.println("           ACCESS DENIED              ");
    Serial.println("**************************************");
    Serial.println("Reason: Fingerprint does not match database.");
  } else {
    Serial.print("Search error code: "); Serial.println(p);
    finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
  }

  delay(2000);
  finger.LEDcontrol(FINGERPRINT_LED_OFF, 0, R503_LED_BLUE, 0);
}

void deleteFingerprint() {
  Serial.print("\nEnter ID to delete (1-200): ");
  uint8_t id = readNumber();
  if (id == 0) return;

  if (finger.deleteModel(id) == FINGERPRINT_OK) {
    Serial.print("ID #"); Serial.print(id); Serial.println(" deleted successfully!");
  } else {
    Serial.print("Failed to delete ID #"); Serial.println(id);
  }
}

void emptyDatabase() {
  if (finger.emptyDatabase() == FINGERPRINT_OK) {
    Serial.println("Database successfully cleared!");
  } else {
    Serial.println("Failed to clear database.");
  }
}

void databaseStatus() {
  finger.getTemplateCount();
  Serial.print("Stored Fingerprints: "); Serial.println(finger.templateCount);
}

// Waits for finger press AND captures image into the hardware buffer
bool waitForFinger(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_OK) {
    if (millis() - start > timeoutMs) {
      Serial.println("\nTimeout: No finger detected.");
      finger.LEDcontrol(FINGERPRINT_LED_FLASHING, 100, R503_LED_RED, 3);
      return false;
    }
    delay(50);
  }
  return true;
}

// Waits until finger is completely removed from the glass
void waitForFingerRelease(unsigned long timeoutMs) {
  unsigned long start = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - start > timeoutMs) break;
    delay(50);
  }
}

uint8_t readNumber() {
  uint8_t num = 0;
  while (num == 0) {
    while (!Serial.available()) delay(10);
    num = Serial.parseInt();
  }
  return num;
}