# Chillow App

Chillow is the connected hospitality ecosystem for guest discovery, reservations, digital menus, ordering, payments, and operations.

This repository contains the Next.js frontend application. It is designed to run against a separately deployed API; no production or sandbox API host is assumed to be live solely because it is documented here.

## Local development

Use Node.js 24 (see `.nvmrc`), install dependencies, then start the development server:

```sh
npm install
npm run dev
```

Copy `.env.example` to a local environment file and set only the values appropriate to the environment you are running. Do not commit credentials.

## Environment configuration

| Variable | Purpose | Local default |
| --- | --- | --- |
| `FRONTEND_BASE_URL` | Exact frontend origin used at build time to expose canonical frontend links | `http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | Credentialed API endpoint used by the browser application | `http://localhost:5000` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key for the selected environment | `pk_test_...` |

When the matching backend deployments are available, sandbox should use `https://sandbox.app.chillow.io` with `https://sandbox.api.chillow.io`; production should use `https://app.chillow.io` with `https://api.chillow.io`. Keep those values environment-specific and do not redirect legacy customer links until an approved cutover plan is in place.

## Validation

```sh
npm run lint
npm run test:components
npm run build
```

Run focused workflow tests for the area being changed. Do not create live orders, reservations, payments, or customer communications as part of frontend validation.
