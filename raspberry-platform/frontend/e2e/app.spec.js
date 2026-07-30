import { test, expect } from '@playwright/test'

const AUTH_CODE = '260724'

const mockPerson = {
  id: 1,
  fingerprint_id: 'FP_MOCK_001',
  full_name: 'John Doe',
  age: 30,
  gender: 'M',
  person_type: 'refugee',
  family_unit_id: 'FAM_MOCK_001',
  family_size: 4,
  is_pregnant: 0,
  has_chronic_illness: 0,
  medical_notes: '',
  pre_registered: 1,
  created_at: '2026-07-30T10:00:00.000Z',
  mqtt_client_id: 'client_mock_001',
  mqtt_password: 'pass_mock_001',
}

const mockCheckinResponse = {
  person: { ...mockPerson },
  wristband_barcode: 'WB000042',
  mqtt: {
    final_qos: 1,
    priority: 'high',
    network_state: 'STABLE',
    published: true,
  },
}

const mockDistributions = {
  breakfast: false,
  lunch: false,
  dinner: false,
  water: false,
}

const mockStatsOverview = {
  population: {
    total: 42,
    pre_registered: 10,
    today_registered: 3,
    today_checkins: 5,
    families: 15,
  },
  vulnerable: {
    pregnant: 2,
    chronic_illness: 1,
    total_flagged: 3,
  },
  distribution_today: {
    breakfast: { served: 20, pending: 10, percent: 67 },
    lunch: { served: 15, pending: 15, percent: 50 },
    dinner: { served: 0, pending: 30, percent: 0 },
    water: { served: 25, pending: 5, percent: 83 },
  },
  eligible_for_distribution: 30,
  prediction_tomorrow: {
    expected_persons: 47,
    breakfast_kg: 23.5,
    lunch_kg: 28.2,
    dinner_kg: 23.5,
    water_litres: 705,
    note: 'Predicted increase of 5 persons based on recent registration trend.',
  },
  mqtt: {
    network_state: 'STABLE',
    buffered_messages: 0,
  },
  recent_registrations: [
    {
      id: 42,
      full_name: 'Jane Smith',
      age: 25,
      gender: 'F',
      is_pregnant: 0,
      has_chronic_illness: 0,
      created_at: '2026-07-30T09:00:00.000Z',
      pre_registered: 0,
      wristband_barcode: 'WB000042',
    },
  ],
}

test.describe('SmartCamp E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear()
    })
  })

  test('1. Authorize with valid code and navigate to registration', async ({ page }) => {
    await page.goto('/authorize')

    await expect(page.getByText('Staff Authorization')).toBeVisible()
    await expect(page.getByText('Enter your 6-digit access code')).toBeVisible()

    const digitInputs = page.locator('input[inputmode="numeric"][maxlength="1"]')
    await expect(digitInputs).toHaveCount(6)

    const codeDigits = AUTH_CODE.split('')
    for (let i = 0; i < codeDigits.length; i++) {
      await digitInputs.nth(i).fill(codeDigits[i])
    }

    await page.getByRole('button', { name: 'Authenticate' }).click()

    await page.waitForURL('**/registration')
    await expect(page.getByText('Camp Registration Hub')).toBeVisible()
  })

  test('2. Registration - scan fingerprint, confirm check-in, get wristband', async ({ page }) => {
    await page.route('http://localhost:5000/api/fingerprint/scan', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ matched: true, person: mockPerson }),
      })
    })

    await page.route('http://localhost:5000/api/checkin', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}')
      expect(body.person_id).toBe(mockPerson.id)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCheckinResponse),
      })
    })

    const token = btoa(JSON.stringify({ code: AUTH_CODE, loggedInAt: Date.now() }))
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000
    await page.addInitScript(({ token, expiresAt }) => {
      localStorage.setItem('scamp_auth', JSON.stringify({ token, expiresAt }))
    }, { token, expiresAt })

    await page.goto('/registration')
    await expect(page.getByText('Camp Registration Hub')).toBeVisible()

    await page.getByRole('button', { name: /Initiate Scan/i }).click()
    await expect(page.getByText('Analyzing Biometrics')).toBeVisible()

    await expect(page.getByText('Match Confirmed')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(mockPerson.full_name)).toBeVisible()
    await expect(page.getByText(`Identity verified: ${mockPerson.full_name}`)).toBeVisible()

    await page.getByRole('button', { name: /Confirm Check-in & Assign Wristband/i }).click()

    await expect(page.getByText('Ready to Go')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(mockCheckinResponse.wristband_barcode)).toBeVisible()
    await expect(page.getByText('Process Next Person')).toBeVisible()
  })

  test('3. Wristband scan - look up barcode, distribute a resource', async ({ page }) => {
    await page.route('http://localhost:5000/api/wristband/WB000001', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          person: mockPerson,
          wristband_barcode: 'WB000001',
          today_distributions: { ...mockDistributions },
        }),
      })
    })

    await page.route('http://localhost:5000/api/distribute', async (route) => {
      const body = JSON.parse(route.request().postData() || '{}')
      expect(body.barcode).toBe('WB000001')
      expect(['breakfast', 'lunch', 'dinner', 'water']).toContain(body.resource_type)
      const updated = { ...mockDistributions, [body.resource_type]: true }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          today_distributions: updated,
          mqtt: {
            final_qos: 1,
            priority: 'high',
            network_state: 'STABLE',
            published: true,
          },
        }),
      })
    })

    const token = btoa(JSON.stringify({ code: AUTH_CODE, loggedInAt: Date.now() }))
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000
    await page.addInitScript(({ token, expiresAt }) => {
      localStorage.setItem('scamp_auth', JSON.stringify({ token, expiresAt }))
    }, { token, expiresAt })

    await page.goto('/wristband')
    await expect(page.getByText('Distribution Hub')).toBeVisible()

    await page.getByPlaceholder(/scan or type barcode/i).fill('WB000001')
    await page.getByRole('button', { name: 'Lookup' }).click()

    await expect(page.getByText(mockPerson.full_name)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(`Age ${mockPerson.age}`)).toBeVisible()
    await expect(page.getByText(`Family ${mockPerson.family_unit_id}`)).toBeVisible()

    const distributeButtons = page.locator('button:has-text("Distribute")')
    await expect(distributeButtons).toHaveCount(4)

    await distributeButtons.first().click()
    await expect(page.getByText('Breakfast distributed successfully')).toBeVisible()

    await expect(distributeButtons).toHaveCount(3)
    await page.getByText('Allocated').first().waitFor()
  })

  test('4. Dashboard shows stats overview', async ({ page }) => {
    await page.route('http://localhost:5000/api/stats/overview', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStatsOverview),
      })
    })

    const token = btoa(JSON.stringify({ code: AUTH_CODE, loggedInAt: Date.now() }))
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000
    await page.addInitScript(({ token, expiresAt }) => {
      localStorage.setItem('scamp_auth', JSON.stringify({ token, expiresAt }))
    }, { token, expiresAt })

    await page.goto('/dashboard')
    await expect(page.getByText('Total Population')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('42')).toBeVisible()
    await expect(page.getByText('Eligible Today')).toBeVisible()
    await expect(page.getByText('30')).toBeVisible()
  })
})
