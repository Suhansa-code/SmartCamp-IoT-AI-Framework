# Fingerprint Scanner Integration

ESP32 + R503 optical sensor, bridged to the SmartCamp backend over USB serial.

## Layout

| Piece | Path |
|---|---|
| Firmware (Arduino sketch) | `firmware/esp32-r503/esp32-r503.ino` |
| Serial bridge | `backend/services/resource/fingerprint-serial.js` |
| Domain logic | `backend/services/resource/fingerprint.js` |
| Live event stream (SSE) | `backend/services/resource/fingerprint-events.js` |
| HTTP surface | `backend/routes/resource/fingerprint.js` |
| UI hook | `frontend/src/lib/useFingerprintDevice.js` |
| Registration desk | `frontend/src/components/resources/RegistrationScreen.jsx` |
| Device emulator (no hardware needed) | `backend/scripts/fake-fingerprint-device.js` |

## Wiring

Sensor UART pins are selected per board in the sketch (`SENSOR_RX` / `SENSOR_TX`):

| R503 | Arduino Nano ESP32 | XIAO ESP32-C3 | Generic ESP32 |
|---|---|---|---|
| Red — VCC | 3V3 | 3V3 | 3V3 |
| Black — GND | GND | GND | GND |
| Yellow — TXD | **D2** | GPIO20 | GPIO16 |
| Brown — RXD | **D3** | GPIO21 | GPIO17 |
| White — V-TCH | 3V3 | 3V3 | 3V3 |
| Blue — WAKE | any GPIO (optional) | any GPIO | any GPIO |

The ESP32 talks to the Pi at **115200** over USB; the R503 runs at **57600**.

> **Pin numbers are not portable.** A sketch written for XIAO ESP32-C3 pins (20/21)
> compiled for an Arduino Nano ESP32 aims the UART at the wrong pads,
> `verifyPassword()` fails, and the node goes silent on USB. The sketch picks pins
> from the board macro, so select the right board before uploading.

## Flash the firmware

1. Arduino IDE → Library Manager → install **Adafruit Fingerprint Sensor Library**.
2. Board: any ESP32 dev module. Open `firmware/esp32-r503/esp32-r503.ino` and upload.
3. Serial Monitor at 115200 should print `{"event":"READY","templates":0}`.

> Two older sketches exist and **neither** works with this backend:
>
> - `~/Documents/arduino-fingerprint` — plain text at 9600 over `SoftwareSerial`
>   (an AVR library; not usable on an ESP32 at all).
> - `~/Arduino/sketch_jun14a` — an interactive ASCII menu driven by single
>   keypresses (`1`–`5`). It also blocks in `while (!Serial)` and traps in
>   `while(1)` when the sensor is missing, so the node can go permanently silent.
>
> Flash the sketch above instead.

## Point the backend at it

Find the port with `ls -l /dev/serial/by-id/`, then set it in `backend/.env`.
Boards with native USB (Nano ESP32, ESP32-S3/C3) enumerate as `ttyACM*`;
boards behind a CP210x/CH340 bridge enumerate as `ttyUSB*`.

```
FINGERPRINT_ENABLED=true
FINGERPRINT_SERIAL_PORT=/dev/ttyACM0
FINGERPRINT_BAUD_RATE=115200
FINGERPRINT_MAX_SLOTS=200
FINGERPRINT_SIMULATE=true
```

**Only one process may hold a serial port.** If the Arduino IDE Serial Monitor or
the old `~/finger-print-auth` prototype is open, the backend logs
`Cannot lock port` and stays in simulation mode. Close them first. The bridge
retries every 5s, so it connects as soon as the port frees — no restart needed.

### Running in Docker

`docker-compose.yml` passes the device through and joins gid 20 (`dialout`),
because `/dev/tty*` is `root:dialout 0660` and the image runs as `node`:

```yaml
devices:
  - "${FINGERPRINT_SERIAL_PORT:-/dev/ttyACM0}:${FINGERPRINT_SERIAL_PORT:-/dev/ttyACM0}"
group_add:
  - "20"
```

Comment the `devices:` block out when no scanner is attached, or the container
will refuse to start.

The user running the backend needs serial access: `sudo usermod -a -G dialout $USER`
(log out and back in).

`serialport` is an **optional** dependency, so `npm install` still succeeds on a
machine without build tools — the backend just stays in simulation mode there.

## Behaviour without hardware

Nothing breaks. With `FINGERPRINT_ENABLED=false`, or when the port cannot be
opened, scans resolve against the simulator and enrollments replay a scripted
capture through the same code path. The UI shows a **Simulation mode** chip.
The bridge retries a missing port every 5 seconds, so plugging the device in
later recovers without a restart.

## Wire protocol

Newline-delimited JSON, both directions.

```
Pi  → ESP32   {"command":"AUTHENTICATE"}
              {"command":"ENROLL","fingerId":12}
              {"command":"DELETE","fingerId":12}
              {"command":"STATUS"}
              {"command":"CANCEL"}

ESP32 → Pi    {"event":"READY","templates":37}
              {"event":"AUTHENTICATED","fingerId":12,"confidence":164}
              {"event":"NO_MATCH"}
              {"event":"ENROLL_STEP","step":"PLACE_FINGER"}
              {"event":"ENROLLED","fingerId":12,"templates":38}
              {"event":"ERROR","message":"IMAGE_FAIL"}
```

The firmware also polls the pad while idle, so a touch pushes `AUTHENTICATED`
without the Pi asking — that is why the UI listens on SSE rather than polling.

## HTTP API

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/fingerprint/events` | SSE stream: `status`, `device`, `scan-result`, `enroll-progress`, `enroll-result`, `error` |
| `GET` | `/api/fingerprint/status` | Device connection, template count, linked persons |
| `GET` | `/api/fingerprint/next-slot` | Smallest free sensor slot |
| `GET` | `/api/fingerprint/search?q=` | Person lookup by name / ID / wristband |
| `POST` | `/api/fingerprint/scan` | Request a scan (`{}`) or resolve a known slot (`{"slot":12}`) |
| `POST` | `/api/fingerprint/enroll` | `{"person_id":5}` — slot auto-assigned, or pass `"slot"` |
| `POST` | `/api/fingerprint/enroll/cancel` | Abort the capture in flight |
| `POST` | `/api/fingerprint/link` | `{"person_id":5,"slot":12}` — bind without re-capturing |
| `POST` | `/api/fingerprint/unlink` | Clear the binding and delete the template on the sensor |

With hardware attached, `POST /scan` returns `{"status":"SCANNING"}` immediately and
the match arrives on the SSE stream. Without hardware it resolves inline.

## Data model

`persons.fingerprint_slot` (INTEGER, uniquely indexed where not null) holds the
physical R503 template index, 1–`FINGERPRINT_MAX_SLOTS`. It is deliberately
separate from the existing `fingerprint_id` text column, which is a
registration-time identifier used by search and the seed scripts.

## Testing without hardware

```bash
socat -d -d pty,raw,echo=0,link=/tmp/ttyPI pty,raw,echo=0,link=/tmp/ttyESP &
node backend/scripts/fake-fingerprint-device.js --port /tmp/ttyESP --finger 7 &
FINGERPRINT_ENABLED=true FINGERPRINT_SERIAL_PORT=/tmp/ttyPI npm start --prefix backend
```

The emulator accepts `--miss` (answer scans with `NO_MATCH`) and `--fail`
(fail enrollments) to exercise the error paths.
