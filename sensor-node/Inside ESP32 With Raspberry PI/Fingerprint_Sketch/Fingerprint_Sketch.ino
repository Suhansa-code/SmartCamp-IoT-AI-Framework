#include <Adafruit_Fingerprint.h>

// =====================================================
// ESP32 DEV BOARD + R503
// =====================================================

// R503 TX  -> ESP32 GPIO 16 (RX)
// R503 RX  -> ESP32 GPIO 17 (TX)
// R503 VCC -> Power
// R503 GND -> ESP32 GND

#define RX_PIN 16
#define TX_PIN 17

#define R503_BAUD 57600

HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// =====================================================
// LED COLORS
// =====================================================

#define R503_LED_RED    0x01
#define R503_LED_BLUE   0x02
#define R503_LED_GREEN  0x03

// =====================================================
// FUNCTIONS
// =====================================================

void displayMenu();

void enrollFingerprint();
void authenticateFingerprint();
void deleteFingerprint();
void emptyDatabase();
void databaseStatus();

bool captureFingerprint(uint16_t timeout);
bool waitForFingerRelease(uint16_t timeout);

int readNumber();
void clearSerialBuffer();

void printError(uint8_t code);

// =====================================================
// SETUP
// =====================================================

void setup() {

  Serial.begin(115200);

  delay(2000);

  Serial.println();
  Serial.println("========================================");
  Serial.println("        ESP32 + R503 FINGERPRINT");
  Serial.println("========================================");

  // ---------------------------------------------------
  // UART
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Starting UART...");

  mySerial.begin(
    R503_BAUD,
    SERIAL_8N1,
    RX_PIN,
    TX_PIN
  );

  delay(500);

  Serial.println("UART initialized.");

  Serial.print("ESP32 RX: GPIO ");
  Serial.println(RX_PIN);

  Serial.print("ESP32 TX: GPIO ");
  Serial.println(TX_PIN);

  Serial.print("R503 Baud: ");
  Serial.println(R503_BAUD);

  // ---------------------------------------------------
  // Verify sensor
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Checking R503...");

  uint8_t result = finger.verifyPassword();

  if (result == FINGERPRINT_OK) {

    Serial.println("SUCCESS: R503 detected!");

  } else {

    Serial.println("ERROR: R503 not detected.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    while (true) {
      delay(1000);
    }
  }

  // ---------------------------------------------------
  // Get parameters
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Reading sensor parameters...");

  result = finger.getParameters();

  if (result == FINGERPRINT_OK) {

    Serial.println("Parameters OK.");

    Serial.print("Capacity: ");
    Serial.println(finger.capacity);

    Serial.print("Security level: ");
    Serial.println(finger.security_level);

    Serial.print("Baud rate: ");
    Serial.println(finger.baud_rate);

  } else {

    Serial.print("Parameter error: ");
    Serial.println(result);
  }

  // ---------------------------------------------------
  // Template count
  // ---------------------------------------------------

  result = finger.getTemplateCount();

  if (result == FINGERPRINT_OK) {

    Serial.print("Stored fingerprints: ");
    Serial.println(finger.templateCount);

  } else {

    Serial.print("Template count error: ");
    Serial.println(result);
  }

  // ---------------------------------------------------
  // LED test
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Testing sensor LED...");

  finger.LEDcontrol(
    FINGERPRINT_LED_ON,
    0,
    R503_LED_RED,
    0
  );

  delay(500);

  finger.LEDcontrol(
    FINGERPRINT_LED_ON,
    0,
    R503_LED_BLUE,
    0
  );

  delay(500);

  finger.LEDcontrol(
    FINGERPRINT_LED_ON,
    0,
    R503_LED_GREEN,
    0
  );

  delay(500);

  finger.LEDcontrol(
    FINGERPRINT_LED_OFF,
    0,
    R503_LED_GREEN,
    0
  );

  Serial.println("LED test completed.");

  clearSerialBuffer();

  displayMenu();
}

// =====================================================
// LOOP
// =====================================================

void loop() {

  if (!Serial.available()) {
    return;
  }

  char option = Serial.read();

  if (option == '\n' || option == '\r') {
    return;
  }

  switch (option) {

    case '1':

      clearSerialBuffer();

      enrollFingerprint();

      clearSerialBuffer();

      displayMenu();

      break;

    case '2':

      clearSerialBuffer();

      authenticateFingerprint();

      clearSerialBuffer();

      displayMenu();

      break;

    case '3':

      clearSerialBuffer();

      deleteFingerprint();

      clearSerialBuffer();

      displayMenu();

      break;

    case '4':

      clearSerialBuffer();

      emptyDatabase();

      clearSerialBuffer();

      displayMenu();

      break;

    case '5':

      clearSerialBuffer();

      databaseStatus();

      clearSerialBuffer();

      displayMenu();

      break;

    case 'm':
    case 'M':

      clearSerialBuffer();

      displayMenu();

      break;

    default:

      Serial.println();
      Serial.println("Invalid option.");

      clearSerialBuffer();

      displayMenu();

      break;
  }
}

// =====================================================
// MENU
// =====================================================

void displayMenu() {

  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("              MAIN MENU");
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

// =====================================================
// ENROLL
// =====================================================

void enrollFingerprint() {

  Serial.println();
  Serial.println("========================================");
  Serial.println("          ENROLL FINGERPRINT");
  Serial.println("========================================");

  Serial.println();
  Serial.println("Enter fingerprint ID (1-200): ");

  int id = readNumber();

  if (id < 1 || id > 200) {

    Serial.println();
    Serial.println("Invalid ID.");

    return;
  }

  Serial.print("Selected ID: ");
  Serial.println(id);

  // ---------------------------------------------------
  // Check existing ID
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Checking ID...");

  uint8_t result = finger.loadModel(id);

  if (result == FINGERPRINT_OK) {

    Serial.println();
    Serial.println("WARNING: Fingerprint already exists at");
    Serial.print("ID #");
    Serial.println(id);

    Serial.println();
    Serial.println("Choose another ID.");

    return;
  }

  Serial.println("ID is available.");

  // ---------------------------------------------------
  // STEP 1
  // ---------------------------------------------------

  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("STEP 1 / 2");
  Serial.println("----------------------------------------");

  Serial.println("Place your finger on the sensor.");
  Serial.println("Keep it still.");

  finger.LEDcontrol(
    FINGERPRINT_LED_BREATHING,
    100,
    R503_LED_BLUE,
    0
  );

  if (!captureFingerprint(15000)) {

    finger.LEDcontrol(
      FINGERPRINT_LED_OFF,
      0,
      R503_LED_BLUE,
      0
    );

    return;
  }

  Serial.println();
  Serial.println("Fingerprint image captured.");

  // ---------------------------------------------------
  // Convert image
  // ---------------------------------------------------

  result = finger.image2Tz(1);

  if (result != FINGERPRINT_OK) {

    Serial.println("Could not convert first image.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );

    return;
  }

  Serial.println("First fingerprint processed.");

  finger.LEDcontrol(
    FINGERPRINT_LED_OFF,
    0,
    R503_LED_BLUE,
    0
  );

  // ---------------------------------------------------
  // Remove finger
  // ---------------------------------------------------

  Serial.println();
  Serial.println("REMOVE YOUR FINGER.");

  if (!waitForFingerRelease(10000)) {

    Serial.println("Warning: finger was not removed.");

  } else {

    Serial.println("Finger removed.");
  }

  delay(500);

  // ---------------------------------------------------
  // STEP 2
  // ---------------------------------------------------

  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("STEP 2 / 2");
  Serial.println("----------------------------------------");

  Serial.println("Place the SAME finger again.");
  Serial.println("Keep it still.");

  finger.LEDcontrol(
    FINGERPRINT_LED_BREATHING,
    100,
    R503_LED_BLUE,
    0
  );

  if (!captureFingerprint(15000)) {

    finger.LEDcontrol(
      FINGERPRINT_LED_OFF,
      0,
      R503_LED_BLUE,
      0
    );

    return;
  }

  Serial.println();
  Serial.println("Second fingerprint image captured.");

  // ---------------------------------------------------
  // Convert second image
  // ---------------------------------------------------

  result = finger.image2Tz(2);

  if (result != FINGERPRINT_OK) {

    Serial.println("Could not convert second image.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );

    return;
  }

  Serial.println("Second fingerprint processed.");

  // ---------------------------------------------------
  // Create model
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Comparing fingerprints...");

  result = finger.createModel();

  if (result != FINGERPRINT_OK) {

    Serial.println();
    Serial.println("ERROR: Fingerprints do not match.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );

    return;
  }

  Serial.println("Fingerprint model created.");

  // ---------------------------------------------------
  // Store
  // ---------------------------------------------------

  Serial.print("Saving fingerprint to ID #");
  Serial.println(id);

  result = finger.storeModel(id);

  if (result == FINGERPRINT_OK) {

    finger.LEDcontrol(
      FINGERPRINT_LED_ON,
      0,
      R503_LED_GREEN,
      0
    );

    Serial.println();
    Serial.println("**************************************");
    Serial.println("       FINGERPRINT ENROLLED!");
    Serial.println("**************************************");

    Serial.print("Fingerprint ID: ");
    Serial.println(id);

    delay(2000);

    finger.LEDcontrol(
      FINGERPRINT_LED_OFF,
      0,
      R503_LED_GREEN,
      0
    );

  } else {

    Serial.println();
    Serial.println("ERROR: Failed to save fingerprint.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );
  }
}

// =====================================================
// AUTHENTICATION
// =====================================================

void authenticateFingerprint() {

  Serial.println();
  Serial.println("========================================");
  Serial.println("           AUTHENTICATION");
  Serial.println("========================================");

  // ---------------------------------------------------
  // Check database
  // ---------------------------------------------------

  finger.getTemplateCount();

  Serial.print("Fingerprints in database: ");
  Serial.println(finger.templateCount);

  if (finger.templateCount == 0) {

    Serial.println();
    Serial.println("NO FINGERPRINTS ARE STORED.");
    Serial.println("Please enroll a fingerprint first.");

    return;
  }

  // ---------------------------------------------------
  // Capture
  // ---------------------------------------------------

  Serial.println();
  Serial.println("Place your finger on the sensor.");
  Serial.println("Keep it still.");

  finger.LEDcontrol(
    FINGERPRINT_LED_BREATHING,
    100,
    R503_LED_BLUE,
    0
  );

  if (!captureFingerprint(15000)) {

    finger.LEDcontrol(
      FINGERPRINT_LED_OFF,
      0,
      R503_LED_BLUE,
      0
    );

    return;
  }

  Serial.println();
  Serial.println("Fingerprint image captured.");

  // ---------------------------------------------------
  // Convert image
  // ---------------------------------------------------

  uint8_t result = finger.image2Tz(1);

  if (result != FINGERPRINT_OK) {

    Serial.println("Could not process fingerprint.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );

    return;
  }

  Serial.println("Fingerprint processed.");

  // ---------------------------------------------------
  // Search
  // ---------------------------------------------------

  Serial.println("Searching database...");

  result = finger.fingerSearch();

  if (result == FINGERPRINT_OK) {

    finger.LEDcontrol(
      FINGERPRINT_LED_ON,
      0,
      R503_LED_GREEN,
      0
    );

    Serial.println();
    Serial.println("**************************************");
    Serial.println("           ACCESS GRANTED");
    Serial.println("**************************************");

    Serial.print("Matched ID: ");
    Serial.println(finger.fingerID);

    Serial.print("Confidence: ");
    Serial.println(finger.confidence);

  } else if (result == FINGERPRINT_NOTFOUND) {

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );

    Serial.println();
    Serial.println("**************************************");
    Serial.println("           ACCESS DENIED");
    Serial.println("**************************************");

    Serial.println("Fingerprint not found in database.");

  } else {

    Serial.println();
    Serial.println("Fingerprint search failed.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);

    finger.LEDcontrol(
      FINGERPRINT_LED_FLASHING,
      100,
      R503_LED_RED,
      3
    );
  }

  delay(2000);

  finger.LEDcontrol(
    FINGERPRINT_LED_OFF,
    0,
    R503_LED_GREEN,
    0
  );
}

// =====================================================
// CAPTURE FINGERPRINT IMAGE
// =====================================================

bool captureFingerprint(uint16_t timeout) {

  unsigned long start = millis();

  Serial.println();
  Serial.println("Waiting for finger...");

  while (millis() - start < timeout) {

    uint8_t result = finger.getImage();

    // -----------------------------------------------
    // Finger successfully detected
    // -----------------------------------------------

    if (result == FINGERPRINT_OK) {

      Serial.println("SUCCESS: Finger detected.");

      return true;
    }

    // -----------------------------------------------
    // Normal state: no finger
    // -----------------------------------------------

    if (result == FINGERPRINT_NOFINGER) {

      // Don't print continuously
      delay(100);

      continue;
    }

    // -----------------------------------------------
    // Image problem
    // -----------------------------------------------

    if (result == FINGERPRINT_IMAGEFAIL) {

      Serial.println("Sensor detected a finger but image capture failed.");

      delay(100);

      continue;
    }

    // -----------------------------------------------
    // Communication error
    // -----------------------------------------------

    Serial.print("Sensor communication error: ");
    Serial.println(result);

    printError(result);

    delay(200);

    return false;
  }

  Serial.println();
  Serial.println("TIMEOUT: No usable fingerprint image.");

  Serial.println();
  Serial.println("Possible causes:");
  Serial.println("1. Finger not touching sensor correctly.");
  Serial.println("2. Fingerprint sensor glass is dirty.");
  Serial.println("3. R503 power is insufficient.");
  Serial.println("4. Sensor TX/RX connection problem.");
  Serial.println("5. Finger is moving during capture.");

  return false;
}

// =====================================================
// WAIT FOR FINGER REMOVAL
// =====================================================

bool waitForFingerRelease(uint16_t timeout) {

  unsigned long start = millis();

  while (millis() - start < timeout) {

    uint8_t result = finger.getImage();

    if (result == FINGERPRINT_NOFINGER) {

      return true;
    }

    delay(100);
  }

  return false;
}

// =====================================================
// DELETE ONE
// =====================================================

void deleteFingerprint() {

  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("DELETE FINGERPRINT");
  Serial.println("----------------------------------------");

  Serial.print("Enter ID (1-200): ");

  int id = readNumber();

  if (id < 1 || id > 200) {

    Serial.println("Invalid ID.");

    return;
  }

  uint8_t result = finger.deleteModel(id);

  if (result == FINGERPRINT_OK) {

    Serial.print("Fingerprint ID #");
    Serial.print(id);
    Serial.println(" deleted.");

  } else {

    Serial.println("Delete failed.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);
  }
}

// =====================================================
// DELETE ALL
// =====================================================

void emptyDatabase() {

  Serial.println();
  Serial.println("========================================");
  Serial.println("       DELETE ALL FINGERPRINTS");
  Serial.println("========================================");

  Serial.println();
  Serial.println("WARNING: ALL fingerprints will be deleted.");
  Serial.println("Type Y and press Enter to continue.");

  clearSerialBuffer();

  while (!Serial.available()) {
    delay(10);
  }

  char c = Serial.read();

  clearSerialBuffer();

  if (c != 'Y' && c != 'y') {

    Serial.println("Cancelled.");

    return;
  }

  uint8_t result = finger.emptyDatabase();

  if (result == FINGERPRINT_OK) {

    Serial.println("Database cleared successfully.");

  } else {

    Serial.println("Failed to clear database.");

    Serial.print("Error code: ");
    Serial.println(result);

    printError(result);
  }
}

// =====================================================
// DATABASE STATUS
// =====================================================

void databaseStatus() {

  Serial.println();
  Serial.println("----------------------------------------");
  Serial.println("DATABASE STATUS");
  Serial.println("----------------------------------------");

  uint8_t result = finger.getTemplateCount();

  if (result == FINGERPRINT_OK) {

    Serial.print("Stored fingerprints: ");
    Serial.println(finger.templateCount);

    Serial.print("Sensor capacity: ");
    Serial.println(finger.capacity);

    Serial.print("Available slots: ");
    Serial.println(
      finger.capacity - finger.templateCount
    );

  } else {

    Serial.print("Failed to read database.");
    Serial.print(" Error: ");
    Serial.println(result);

    printError(result);
  }
}

// =====================================================
// READ NUMBER
// =====================================================

int readNumber() {

  String input = "";

  while (true) {

    while (!Serial.available()) {
      delay(10);
    }

    while (Serial.available()) {

      char c = Serial.read();

      if (c == '\n' || c == '\r') {

        if (input.length() > 0) {

          int value = input.toInt();

          Serial.println();

          return value;
        }

      } else {

        if (c >= '0' && c <= '9') {

          input += c;
          Serial.print(c);
        }
      }

      delay(2);
    }
  }
}

// =====================================================
// CLEAR SERIAL
// =====================================================

void clearSerialBuffer() {

  delay(50);

  while (Serial.available()) {
    Serial.read();
  }
}

// =====================================================
// ERROR INFORMATION
// =====================================================

void printError(uint8_t code) {

  Serial.print("Description: ");

  switch (code) {

    case FINGERPRINT_OK:
      Serial.println("OK");
      break;

    case FINGERPRINT_PACKETRECIEVEERR:
      Serial.println("Communication error");
      break;

    case FINGERPRINT_NOFINGER:
      Serial.println("No finger detected");
      break;

    case FINGERPRINT_IMAGEFAIL:
      Serial.println("Image capture failed");
      break;

    case FINGERPRINT_IMAGEMESS:
      Serial.println("Image too messy");
      break;

    case FINGERPRINT_FEATUREFAIL:
      Serial.println("Could not find fingerprint features");
      break;

    case FINGERPRINT_NOMATCH:
      Serial.println("Fingerprints do not match");
      break;

    case FINGERPRINT_NOTFOUND:
      Serial.println("Fingerprint not found");
      break;

    case FINGERPRINT_BADLOCATION:
      Serial.println("Invalid storage location");
      break;

    case FINGERPRINT_FLASHERR:
      Serial.println("Flash memory error");
      break;

    case FINGERPRINT_INVALIDREG:
      Serial.println("Invalid register");
      break;

    case FINGERPRINT_PASSVERIFY:
      Serial.println("Password verification failed");
      break;

    default:
      Serial.println("Unknown error");
      break;
  }
}