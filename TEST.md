# Smart Camp Box — Testing Guide

## Overview

This project has two independent platforms with separate test suites:

- **Raspberry Pi Platform** — local backend (Express + SQLite + MQTT)
- **Cloud Platform** — cloud backend (Express + PostgreSQL)

Tests protect existing functionality and catch regressions before deployment.

---

## Quick Commands

### Raspberry Pi Platform

```bash
cd raspberry-platform/backend

# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run tests/config/camp-id.test.js
```

### Cloud Platform

```bash
cd cloud-platform/backend

# Run all tests
npm test

# Run a specific test file
node --test tests/app.test.js
```

---

## Test Structure

### Raspberry Pi Platform (`raspberry-platform/backend/tests/`)

```
tests/
├── setup.js                          # Global mocks (logger)
├── config/
│   └── camp-id.test.js               # CAMP_ID derivation & persistence
├── disaster/
│   ├── gps-storage.test.js           # GPS storage & movement detection
│   └── alert-evaluator.test.js       # Flood prediction alert logic
├── education/
│   ├── alert.test.js                 # Education alert creation
│   ├── scoring.test.js               # ML scoring & fallback
│   └── session.test.js               # Session lifecycle (start, taskComplete)
├── integration/
│   └── api.test.js                   # Full API endpoint tests (supertest)
├── network/
│   └── saamp-mqtt.test.js            # MQTT QoS & adaptive networking
├── resource/
│   ├── distribute.test.js            # Resource distribution
│   ├── fingerprint.test.js           # Fingerprint scan/link/search
│   ├── register.test.js              # Person registration
│   └── wristband.test.js             # Wristband lookup
└── sync/
    ├── sync-integration.test.js      # Cross-module sync flows
    ├── sync-manager.test.js          # Sync manager exports & status
    ├── sync-notify.test.js           # Sync notification (TABLE_PK)
    ├── sync-priority.test.js         # Priority classification
    ├── sync-queue.test.js            # Pending record discovery
    └── sync-receiver.test.js         # Cloud sync receiver
```

**Framework:** Vitest 4.x  
**Config:** `vitest.config.mjs`  
**Mock strategy:** `vi.mock()` for database, constants, logger, MQTT, filesystem

### Cloud Platform (`cloud-platform/backend/tests/`)

```
tests/
├── app.test.js                       # API endpoint integration tests
├── disaster/
│   ├── camps.data.test.js            # Static camp data integrity
│   └── floodPrediction.test.js       # Flood prediction model
├── education/
│   └── alert.repository.test.js      # Education alert CRUD
├── network/
│   └── networkMonitor.test.js        # Network monitoring
└── resources/
    └── prediction.test.js            # Resource prediction
```

**Framework:** Node.js built-in test runner (`node:test`)  
**Config:** None required  
**Mock strategy:** `process.env.DB_ENABLED = 'false'` for in-memory mode

---

## Test Coverage

### Raspberry Pi (250 tests)

| Area | Tests | Status |
|------|-------|--------|
| Config (camp-id) | 12 | ✅ |
| Disaster (GPS, alerts) | 17 | ✅ |
| Education (alerts, scoring, sessions) | 24 | ✅ |
| Integration (API endpoints) | 14 | ✅ |
| Network (MQTT QoS) | 15 | ✅ |
| Resources (register, distribute, fingerprint, wristband) | 30 | ✅ |
| Sync (queue, priority, notify, manager, receiver, integration) | 138 | ✅ |

### Cloud (41 tests)

| Area | Tests | Status |
|------|-------|--------|
| API endpoints | 12 | ✅ |
| Disaster data | 7 | ✅ |
| Flood prediction | 3 | ✅ |
| Education alerts | 10 | ✅ |
| Network monitoring | 5 | ✅ |
| Resource prediction | 3 | ✅ |
| Camp data integrity | 1 | ✅ |

---

## Regression Workflow

### After any code change:

1. **Identify affected platform**
   - RPi-only → run `cd raspberry-platform/backend && npm test`
   - Cloud-only → run `cd cloud-platform/backend && npm test`
   - Integration change → run both

2. **Run the affected test suite**

3. **Add tests for new functionality** (if applicable)

4. **Fix any failing tests** (only after verifying the new behavior is correct)

5. **Do not disable or delete failing tests** to make the suite pass

### What counts as an "integration change":

- MQTT payload structure changed
- DEVICE_ID or CAMP_ID handling changed
- Cloud sync protocol changed
- Device/camp mapping changed
- Shared data contract changed

---

## Mocking Patterns

### Raspberry Pi (Vitest)

```javascript
// Mock entire modules
vi.mock('../../config/database.js', () => ({
  campDb: { prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })) },
  pagesDb: { prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })) },
}));

// Mock with implementation
vi.mock('../../config/camp-id.js', () => ({
  getCampId: vi.fn(() => 'CAMP-TEST'),
}));

// Reset modules between tests
beforeEach(async () => {
  vi.resetModules();
  module = await import('../../module.js');
});
```

### Cloud (Node test runner)

```javascript
// Process-level env vars for behavior switching
process.env.DB_ENABLED = 'false';

// Dynamic import after env setup
const { createApp } = await import('../src/app.js');
```

---

## Writing New Tests

### Rule: Every new feature must have tests

When adding:

| Feature | Add tests for |
|---------|---------------|
| New API endpoint | Request/response, validation, error handling |
| New database table | Insert, query, update, constraints |
| New service function | Business logic, edge cases, error paths |
| New MQTT handler | Message parsing, routing, error handling |
| New UI component | Rendering, user interaction (if testable) |

### Test naming convention

```
describe('module name', () => {
  describe('function name', () => {
    it('does X when Y', () => { ... });
    it('returns Z for valid input', () => { ... });
    it('throws for invalid input', () => { ... });
  });
});
```

---

## Known Gaps

- **RPi frontend** — No automated tests (React app; consider adding component tests later)
- **Cloud frontend** — No automated tests (Next.js app; consider adding component tests later)
- **MQTT end-to-end** — Unit tests mock MQTT; no live broker integration tests
- **Cloud PostgreSQL** — Tests use in-memory mode; no real database integration tests
- **Edge Gateway** — No automated tests (Python service)
- **Fingerprint hardware** — Unit tests simulate; no hardware-in-the-loop tests

---

## CI/CD Integration

Add to your CI pipeline:

```yaml
# GitHub Actions example
- name: RPi Tests
  run: cd raspberry-platform/backend && npm test

- name: Cloud Tests
  run: cd cloud-platform/backend && npm test
```

Both suites can run in parallel since they are independent.
