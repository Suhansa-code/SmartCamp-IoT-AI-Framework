# Public Donation Portal

The Sri Lanka donation experience is available at `/donate`. It is visually and operationally separate from the SmartCamp operations console.

The current money flow is a frontend demonstration gateway using LKR. It looks and behaves like a checkout but does not transmit card details, create a real charge, or require Stripe configuration.

## Cloud configuration

Set these values in `backend/.env` before accepting real donations:

```dotenv
PUBLIC_URL=https://donate.example.org
GOOGLE_CLIENT_ID=your-web-oauth-client.apps.googleusercontent.com
DONATION_SESSION_SECRET=a-random-value-at-least-32-bytes-long
```

1. In Google Cloud Console, create an OAuth 2.0 **Web application** client.
2. Add the production HTTPS origin and local development origin, such as `http://localhost:3000`, to **Authorized JavaScript origins**.
3. Run `npm run db:init` from `cloud-platform/backend` after deploying the schema update.

The public portal shows prepared preview needs if PostgreSQL is disabled or the resource inventory is empty. Once inventory exists, `/api/donations/needs` publishes only the limited resource fields needed by donors.

In-kind submissions are stored as `PLEDGED`; they do not increase inventory. Operations staff must verify receipt before changing a pledge to `RECEIVED` and adding an auditable inventory movement.

Google OAuth requires an HTTPS domain in production. The included card gateway remains demonstration-only until it is deliberately replaced with a licensed Sri Lankan payment provider.
