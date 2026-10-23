# Full Codebase Audit and Project Context Extraction

Audit date: 2026-09-29

Audit scope:

- Frontend repository: C:/Users/pc/Desktop/Quick-serve-qr-menu
- Canonical sibling backend repository: C:/Users/pc/Desktop/Quickserve-be
- Method: static source tracing, frontend-to-backend route cross-reference, data-model and environment-reference analysis, dependency audits, TypeScript and lint checks, and bounded test execution
- Excluded: generated dependency trees, secret values, production systems, live provider calls, data mutation, package installation, deployment, and refactoring

This is the only artifact created by the audit. Secret-bearing local environment files were detected but their values were not read or reproduced.

## 1. Product overview

### Identity, purpose, and users

The code uses both **QuickServe** and **Chillow**. Approved architecture describes Chillow as the hospitality platform evolving from QuickServe, while packages, UI copy, cookies, storage keys, and compatibility contracts still use QuickServe. Renaming those contracts without a migration would be unsafe.

This is a multi-tenant hospitality operations platform for restaurants, bars, and lodging businesses. It combines guest self-service, staff work queues, owner management, reservations, payments, inventory, housekeeping, CRM, analytics, billing, and scheduled automation.

| User | Identity | Principal journeys |
|---|---|---|
| Anonymous visitor | None | Discover a business; check table/room availability; start a reservation |
| QR guest | Narrow GuestSession capability plus device ID; not an authenticated user | Scan QR; browse menu; order/pay; see order state; call staff; submit feedback |
| Reservation guest | Secure action/payment capability | Pay, view a privacy-reduced confirmation, check in, or report not coming |
| Waiter | Staff session | Handle calls/orders; create offline orders; transition or reconcile orders |
| Kitchen staff | Staff session | Work food fulfillment queue |
| Bartender | Staff session | Work bar fulfillment queue |
| Housekeeper | Staff session plus permissions | Work room-turnover queue and supply outcomes |
| Manager | Staff session plus explicit grants | Delegated tenant operations; default deny outside grants |
| Co-owner | Staff session plus restrictions | Broad management, except primary-owner-only actions |
| Primary owner | Owner credentials on Business | Full tenant management, billing, Stripe, team ownership |
| Platform admin | Supabase bearer plus allowlist | Cross-tenant business, owner, plan, and platform administration |
| Internal operator | CRON_SECRET bearer | Invoke named cron, repair, and queue-diagnostic endpoints |

### Major capabilities

- Public venue profile by country and business slug
- Restaurant availability, booking, arrival, cancellation, and manual no-show management
- Hotel room availability, authoritative pricing, checkout, confirmation, check-in, cancellation, and housekeeping
- Rotatable service-point QR capabilities and guest-session bootstrap
- Menu CMS, cart, ordering, Stripe checkout, offline ordering, reorder, receipts, and feedback
- Kitchen/bar fulfillment and waitstaff requests
- Owner dashboard, virtual transactions, analytics, CRM, staff, permissions, service points, branding, and settings
- Canonical inventory balances and movements, Simple Stock, recipes, room supplies, reconciliation, and exceptions
- Stripe Connect guest payments and Stripe Billing subscriptions
- Durable email, in-app notification, webhook, and recovery pipelines
- Weekly AI business analyst reports

Public pages support discovery, onboarding, authentication, reservation, QR, and guest ordering. Authenticated pages support role-specific operations and tenant management. The API also exposes platform-admin, webhook, health, and internal automation surfaces. BullMQ work runs in a separate worker process.

The repository is beyond prototype stage: it contains strong invariants, durable provider processing, tenant-aware permissions, repair jobs, and extensive tests. It is still actively hardening, evidenced by legacy aliases, dual naming, bounded inventory phases, placeholder actions, incomplete deployment documentation, lint/test debt, and no checked-in CI. Actual production traffic and rollout state are **Unknown / requires runtime or team confirmation**.

## 2. Technology stack

### Frontend

| Concern | Technology |
|---|---|
| Runtime target | Node.js 24.x from package.json engines and .nvmrc |
| Framework/runtime | Next.js 16.3.5 App Router; React and React DOM 19.2 |
| Language/build | TypeScript 5, strict, noEmit, ES6 target; Next build |
| Rendering/routing | Predominantly client-rendered route pages; file-system App Router |
| HTTP/server state | Axios 1.20 with credentials; imperative component/hook fetching; no React Query/SWR |
| Global state | React contexts and Zustand 5.0.9; persisted cart |
| Forms/validation | Controlled local state and domain helpers; no common form/schema framework found |
| Styling/components | Tailwind CSS 4, PostCSS, CSS modules, shadcn-style Radix UI primitives |
| Icons/animation/charts | lucide-react; Framer Motion 12.38; Recharts 2.15.4 |
| Dates/IDs/QR | date-fns 4.1; uuid 13; html5-qrcode; qrcode |
| Payments/analytics | Stripe React 6.7 and stripe-js 9.6; Vercel Analytics 1.3.1 |
| Tests/lint | Native Node test runner with .test.mjs contracts; ESLint 9 and eslint-config-next 16 |
| i18n/SEO package | No i18n framework or dedicated SEO package found |

### Backend

| Concern | Technology |
|---|---|
| Runtime/framework | Node.js 24.x target, ECMAScript modules, Express 5 |
| Architecture | REST/SSE modular monolith: routes, middleware, controllers, services, Mongoose models |
| Database | MongoDB with Mongoose 9 |
| Session/cache/pub-sub | Redis with express-session/connect-redis plus redis and ioredis clients |
| Authentication/security | bcrypt, Helmet, CORS, express-rate-limit, Origin/Referer validation |
| Jobs | BullMQ 6 workers and repeatable jobs |
| Payments | Stripe SDK; Stripe Connect and Stripe Billing |
| Email | Resend with React Email templates |
| Uploads | Multer memory storage and Cloudinary |
| Other providers | Supabase Auth for platform admin, Google Places, Cloudflare Workers AI |
| Realtime | Server-Sent Events plus Redis pub/sub; no WebSocket stack |
| Logging/monitoring | console logging and health probes; no structured logger, tracing, Sentry, or metrics SDK |
| Tests | Native Node test runner; isolated contracts plus environment-gated Mongo integration tests |

### Infrastructure and package manager

- netlify.toml configures a Next build with @netlify/plugin-nextjs. README also references Vercel. The canonical frontend host is **Unknown / requires runtime or team confirmation**.
- Backend API is a long-lived server.js process. src/workers/index.js is a separate long-lived worker.
- No Docker, Kubernetes, reverse-proxy config, infrastructure-as-code, process-manager config, or checked-in CI pipeline was found.
- Express trusts one proxy hop. Exact edge, CDN, DNS, region, autoscaling, and monitoring topology is **Unknown / requires runtime or team confirmation**.
- Frontend contains package-lock.json v3 and pnpm-lock.yaml v9 without a packageManager declaration. npm is the working default, but the dual locks can drift. Backend uses npm/package-lock.

## 3. Repository structure

The system is split across two repositories, not a monorepo. The backend is a modular monolith.

    Quick-serve-qr-menu/
    +-- .ai/approved/          architectural source of truth
    +-- app/                   Next layouts and route pages
    |   +-- b/, reserve/       public discovery/reservation
    |   +-- q/, s/             QR bootstrap and guest journey
    |   +-- owner/             tenant management
    |   +-- waitstaff/         waiter operations
    |   +-- kitchen/, bar/     station fulfillment
    |   +-- housekeeping/      lodging operations
    |   +-- onboarding/        signup
    |   +-- layout.tsx         root shell/metadata
    |   +-- page.tsx           public demo entry
    +-- components/            shared UI and domain components
    +-- contexts/              Auth and Business contexts
    +-- hooks/                 guards, SSE, notifications, feature hooks
    +-- lib/                   Axios, permissions, capabilities, APIs, utilities
    +-- stores/                persisted Zustand cart
    +-- public/, styles/       assets and styles
    +-- test/                  native Node source/contract tests
    +-- next.config.mjs        Next configuration
    +-- netlify.toml           deployment evidence
    +-- package*.json          manifest and npm lock
    +-- pnpm-lock.yaml         second, ambiguous lock
    +-- tsconfig.json          strict TS configuration
    +-- {console.error(e)      anomalous zero-byte root file

    Quickserve-be/
    +-- emails/                React Email templates
    +-- scripts/               manual migration, seed, verification, repair tools
    +-- src/
    |   +-- config/            DB, sessions, providers, Swagger, env checks
    |   +-- constants/         permissions/domain constants
    |   +-- controllers/       HTTP orchestration
    |   +-- middleware/        auth, roles, permissions, origin and infrastructure guards
    |   +-- models/            Mongoose schemas and indexes
    |   +-- routes/            Express routers
    |   +-- services/          domain logic and provider orchestration
    |   +-- utils/             cache, realtime, search, signing, IDs
    |   +-- validators/        focused validators
    |   +-- workers/           BullMQ processors and worker entry
    +-- test/                  native Node tests
    +-- server.js              API entry
    +-- package.json
    +-- package-lock.json

No workspaces are declared. The backend has no formal repository/DAO layer: controllers and services query models directly. High-risk logic is service-oriented; some CRUD remains in controllers.

## 4. Application entry points

### Frontend

Next starts through npm run dev, npm run build, or npm start. app/layout.tsx creates the document shell, metadata, styles, analytics, and providers. App Router selects pages. Authenticated layouts mount AuthProvider and BusinessProvider, apply client guards, and build role/capability-aware navigation. Pages call the shared Axios client. Guest QR pages exchange a URL-fragment capability for a sessionStorage GuestSession.

No frontend route handlers, server actions, middleware.ts, CLI, or cron entry was found.

### API

server.js:

1. Loads dotenv and calls assertEnvironment("api").
2. Creates Express and trusts one proxy hop.
3. Mounts /webhook before express.json for Stripe raw-body signature verification.
4. Applies Helmet, JSON parsing, and a 50-request/minute process-local global limiter.
5. Configures credentialed CORS for frontend, optional backoffice, and local development.
6. Mounts /healthz and /ready before sessions.
7. Applies Redis sessions and fail-closed store-unavailable handling.
8. Applies Origin/Referer validation to state-changing browser requests.
9. Mounts application routers, Swagger, and a generic 500 handler.
10. Connects MongoDB before listening; then connects session Redis and realtime pub/sub.

/ready requires MongoDB and session Redis. Queue/cache/presence degradation does not fail readiness.

### Worker and scripts

src/workers/index.js, started by npm run worker, validates its environment, connects data services, constructs BullMQ workers, registers repeatable jobs, and handles shutdown. API-only deployment will not process queues.

scripts contains targeted migration, index, seed, webhook, billing, reservation, inventory, and reconciliation utilities. There is no versioned migration runner; scripts must be selected and reviewed manually.

## 5. Routing

### Frontend route inventory

“Private” means a client guard exists; backend authorization is still authoritative.

| Path | Access and inputs | Purpose/data |
|---|---|---|
| / | Public | Demo/entry page |
| /login | Public | Login and GET /auth/me |
| /onboarding | Public session flow | Multi-step onboarding and address lookup |
| /setup-account; /staff/setup-account | Public token query | Owner/staff invite password setup |
| /reset-password | Public token query | Password reset |
| /scan | Public | Camera QR scanner |
| /b/:countryCode/:businessSlug | Public | Public business profile |
| /reserve/:countryCode/:businessSlug | Public | Restaurant availability/reservation |
| /reserve/:countryCode/:businessSlug/hotel | Public | Hotel availability/pricing/booking |
| /reservation/pay/:secureToken | Public narrow capability; optional payment=cancelled | Resume hotel payment |
| /reservation/confirmation/:reservationId | Checkout Session ID in fragment | Privacy-reduced confirmation |
| /reservation/arrival; /reservation/not-coming | Signed token query | Check-in and non-arrival actions |
| /q/:businessId/:servicePointId | Signed capability fragment | GuestSession bootstrap |
| /s/:servicePointId | Guest layout | Service-point shell |
| /s/:servicePointId/menu | businessId query | Menu |
| /s/:servicePointId/order | Scoped cart | Order review/checkout |
| /s/:servicePointId/status | orderId, businessId, scope | Live order status |
| /s/:servicePointId/orders | GuestSession | Visit orders |
| /s/:servicePointId/confirmation | orderId, businessId, waiterMode | Order confirmation |
| /s/:servicePointId/waitstaff-request | reason | Request staff |
| /kitchen; /bar | Role private | Station fulfillment |
| /waitstaff | Waiter/authorized management | Calls and active orders |
| /waitstaff/past-orders | range query | Reconciliation history |
| /waitstaff/take-order; /waitstaff/take-order/:servicePointId | Staff | Offline order creation |
| /waitstaff/checkout | Staff | Checkout/reconciliation |
| /housekeeping | Lodging and housekeeping permission | Room-turnover queue |
| /owner | Private | Dashboard redirect |
| /owner/dashboard | dashboard.view | Tenant summary/setup |
| /owner/orders; /owner/transactions | respective view permissions | Operational and financial history |
| /owner/reservations | reservations.view/manage | Restaurant/hotel operations |
| /owner/menu | menu.view/manage | Menu CMS |
| /owner/service-points; /owner/service-points/print | servicePoints permissions | Tables/rooms and QR print |
| /owner/inventory; /items; /recipes; /room-supplies | granular inventory permissions | Stock, recipes, lodging supplies |
| /owner/staff | staff permissions | Staff CMS |
| /owner/settings/team-access | Primary owner | Co-owner access |
| /owner/analytics | analytics.view and entitlement | Advanced analytics |
| /owner/feedback; /owner/guests | feedback.view or crm.view | Feedback and CRM |
| /owner/ai | aiAnalyst.view and entitlement | Weekly AI reports |
| /owner/property-profile; /owner/branding; /owner/settings | management areas | Tenant configuration |
| /owner/billing | billing area/primary owner per action | Subscription/Connect/invoices |
| /owner/confirm-email; /owner/access-denied | Authenticated | Email completion and fallback |

### API route map and contracts

Mounted bases are /orders, /businesses/:businessId/orders, /payments, /kitchen, /bar, /waitstaff, /owner/guests, /owner, /housekeeping, /menu-items, /business, /table-session, /admin, /auth, /upload, /feedback, /public, /internal, /onboarding, /events, /webhook, /healthz, /ready, and /api-docs.

Auth/onboarding:

- GET /auth/invite/validate and /auth/invite/staff/validate validate expiring invite tokens.
- POST /auth/invite/setup-password and /auth/invite/staff/setup-password accept token/new password, hash it, consume the invite, and update Business or Staff.
- POST /auth/login accepts email/password, validates Business or Staff, regenerates/saves session, and returns safe identity/business data.
- GET /auth/me reloads canonical identity, capabilities, permissions, and restrictions.
- GET /auth/access-events is co-owner revocation SSE; POST /auth/heartbeat updates Staff presence; POST /auth/logout destroys session.
- POST /auth/forgot-password returns a generic result and queues mail; POST /auth/reset-password consumes a hashed expiring token.
- POST /auth/change-password and /auth/request-email-change require a session; GET /auth/confirm-email-change consumes the confirmation capability.
- POST /onboarding/signup, /resend-verification, and /verify-email operate OnboardingSession. GET/PATCH /onboarding/session/:sessionId read/update steps; GET its /address-suggestions calls Google; POST /complete creates Business. GET /onboarding/plans is public.

Public/reservations:

- GET /public/business/:countryCode/:slug resolves a public Business DTO; GET /business-config returns cached public capabilities/config; GET /plans returns active plans.
- GET /public/reservations/restaurant-availability and /available-rooms validate tenant/date/occupancy against Reservation and ServicePoint.
- POST /public/reservations accepts tenant-resolvable restaurant/hotel guest inputs plus idempotency and calls reservation services.
- POST /public/reservations/arrival/validate and /arrival/check-in use an arrival capability.
- GET/POST /public/restaurant-reservations/not-coming/:token are legacy validate/cancel aliases. POST /public/reservations/not-coming/validate, /cancel, and /not-coming are current/compatibility action routes.
- GET /public/reservations/by-token/:secureToken returns a payment-resume DTO.
- GET /public/reservations/by-id/:reservationId requires X-Reservation-Confirmation-Session and binds PendingCheckout, tenant, and Reservation before returning a strict masked DTO.

QR/menu/order/payment/feedback:

- POST /table-session/start exchanges signed QR capability, business/service point, and device context for GuestSession. POST /journey/start creates/returns CustomerJourney.
- GET /menu-items and /popular are guest-or-authorized reads. POST /menu-items, PATCH/DELETE /menu-items/:id, and PATCH /:id/availability require menu management and write MenuItem.
- GET/POST /orders list/create scoped orders; creation accepts item IDs/quantities and idempotency but server-prices items. DELETE /orders/session is management-only.
- GET /orders/current and /orders/:orderId are capability/session-scoped. POST /:orderId/reorder revalidates current menu.
- PATCH /orders/:orderId/status, /mark-paid, /reconcile-complete, and /receipt-email enforce roles/permissions and canonical transitions; POST /receipt is rate-limited and queues email.
- /businesses/:businessId/orders duplicates detail/status/mark-paid/receipt/receipt-email handlers for compatibility; authorization still derives tenant.
- POST /payments/checkout accepts cart/context/idempotency, validates GuestSession/menu/pricing, creates PendingCheckout/inventory hold, and calls Stripe. POST /checkout-reservation creates/reuses a hotel checkout.
- POST /feedback validates order/session proof and writes Feedback.

Operational:

- GET /kitchen and PATCH /kitchen/orders/:orderId/fulfillment serve kitchen queue/transitions.
- GET /bar/orders and PATCH /bar/orders/:orderId/fulfillment serve bar queue/transitions.
- GET/POST /waitstaff/calls list/create calls. GET /waitstaff/past-orders; PATCH /orders/:orderId/mark-paid and /reconcile-complete handle reconciliation.
- GET /waitstaff, POST /waitstaff/orders, PATCH /orders/:orderId/status, POST /orders/:orderId/cancel, GET /service-points, PATCH /calls/:id/claim, and /resolve implement waiter operations.
- GET /housekeeping/rooms, /eligible-staff, /history; PUT /settings, /operations/:id/assignment, /priority; POST /operations/:id/start, /no-supplies, /complete, /inventory-exception/acknowledge, and /resolve use precise housekeeping permissions and HousekeepingOperation services.

Owner/business:

- Notifications: GET /owner/notifications/events, /notifications, /unread-count; PATCH /:notificationId/read; POST /read-all.
- Branding/reporting: GET/PATCH /owner/branding; GET /owner/orders, /transactions, /dashboard, /setup-progress; POST /setup-progress/dismiss.
- Inventory: GET /owner/inventory/overview, /items, /items/:id, /movements; POST /items, /items/:id/receive, /waste, /adjust; PATCH/DELETE /items/:id.
- Room supplies/recipes: POST /owner/inventory/room-usage; GET /room-usage/context; GET /recipes and /recipes/:menuItemId; PUT/DELETE /recipes/:menuItemId.
- Simple Stock: POST /owner/inventory/simple-stock/menu-items; GET /menu-items/:id/removal-preview and /drift; DELETE /menu-items/:id; POST /menu-items/:id/adjust, /migrate, /rollback and /reconcile; PATCH /menu-items/:id/settings.
- Analytics/CRM: GET /owner/analytics, /table-sessions/overview, /feedback; GET /owner/guests, /analytics, /:guestId.
- Staff/team: GET/POST /owner/staff; PATCH /staff/:staffId/permissions; DELETE /staff/:staffId. GET /team; POST /team/co-owner; GET/PATCH /team/co-owner/:staffId/access; DELETE /team/co-owner/:staffId. Team actions are primary-owner-only.
- Service points: GET/POST /owner/service-points; GET/PATCH/DELETE /:servicePointId; PATCH /toggle and /toggle-reservable; GET /qr-capability and POST /qr-capability/rotate.
- Reservations: GET/POST /owner/reservations; GET /restaurant-availability, /availability, /pricing-preview; PATCH /:id/status, /room, /service-point; POST /:id/cancel, /check-in, /resend-confirmation, /resend-payment-link; DELETE /:id.
- Stripe/billing: POST /owner/stripe/connect-account; GET /stripe/status, /dashboard-link, /payout-summary; GET /billing, /commission, /invoices; POST /billing/setup-intent, /verify-payment-method, /plan, /report-usage; DELETE /billing/payment-method and /invoices/:id; PATCH /billing/platform-fee-settings.
- AI: GET /owner/ai-business-analyst/latest, /history, /current-week, /:periodKey.
- Business: GET/PATCH /business/settings; PATCH /settings/modules, /operating-hours, /settings/ordering-preferences, /payment-preferences, /table-preferences; GET/PATCH /property-profile/:section; GET/POST/DELETE /categories; POST/PATCH/DELETE /room-types; GET/PATCH /room-types/supply-template.

Uploads/admin/internal:

- POST /upload/image, /property-photo, /business-logo, and /menu-item require session plus relevant area/permission and use server-derived Cloudinary folders.
- /admin: GET /business-modules; POST/GET /businesses; GET/PATCH/DELETE /businesses/:businessId; POST/GET /owners; GET /dashboard-stats; GET /plans; PATCH /plans/:id. Router boundary requires Supabase admin allowlist.
- POST /webhook/stripe uses Stripe signature and durable event processing.
- /internal uses CRON_SECRET: POST /cron/billing-lifecycle, /cron/reservation-expiry, /queue/diagnostic, /queue/email/recover, /queue/post-payment/recover; GET /queue/health.
- GET /healthz is liveness; GET /ready checks Mongo/session Redis; GET /events is role/capability-filtered SSE.

Routes live under src/routes; handlers under src/controllers; critical operations call src/services and models. Responses are feature-specific DTOs, not a universal envelope. Exact optional presentation fields should be read from current controller/service contracts rather than duplicated into clients.

## 6. Frontend architecture

app/layout.tsx supplies the root shell. Authenticated layouts layer AuthProvider, BusinessProvider, role/capability-aware navigation, and page content. AuthContext calls /auth/me, exposes login/logout/refresh, listens for 401 SESSION_REVOKED and co-owner access events, and sends heartbeat. BusinessContext normalizes modules, terminology, currency, tax, timezone, and capabilities.

State:

- Auth/business: React contexts.
- Cart: Zustand persisted as quickserve-cart and scoped by actor, business, and service point. Crossing context clears incompatible state.
- Device: qs_session_id UUID in localStorage; correlation only.
- Guest capability: qs_gs_<servicePointId> in sessionStorage with expiry/session instance/journey.
- UI: local state/reducers. Server data is fetched with Axios; there is no normalized client cache.

lib/axios-config.ts sets NEXT_PUBLIC_API_BASE_URL with a localhost fallback, JSON defaults, and withCredentials. The response interceptor broadcasts session revocation on 401. No global retries, CSRF token, or universal response normalizer exists. Pages own loading/error/empty/toast/dialog state. Reservation confirmation has a bounded five-attempt webhook-convergence retry.

components/ui contains Radix-backed primitives. Feature components use cards, responsive tables, filters, search, cursor pagination, dialogs, confirmation prompts, charts, and toasts. Owner navigation is computed from modules, entitlements, areas, permissions, and restrictions.

Client permissions include dashboard.view; orders.view/manage; transactions.view; reservations.view/manage; menu.view/manage; inventory view/manage/receive/waste/adjust/recipe.manage/roomUsage.record; housekeeping view/perform/assign/manage; servicePoints view/manage; staff view/manage; analytics.view; feedback.view; crm.view; aiAnalyst.view; settings.operational.manage.

Client validation protects UX only. Backend remains authoritative for tenant, permissions, prices, availability, money, status transitions, and inventory.

## 7. Backend architecture

The prevailing path is:

    route
      -> authentication/role/permission/module/entitlement middleware
      -> controller
      -> domain service(s)
      -> Mongoose model(s) and external providers
      -> DTO/HTTP response

Routes define transport and middleware ordering. Controllers parse input and shape responses. Services own high-risk invariants, transactions, idempotency, provider calls, repair logic, and cross-model orchestration. Models own schemas, indexes, optimistic versions, and selected validation. Utilities own signing, safe regex, money/date helpers, caching, and realtime. Workers reuse the same services/models.

Critical truth is server-side:

- Checkout and webhook services validate provider amount, currency, account, idempotency, and materialization.
- Restaurant slot and hotel stay semantics remain distinct.
- Inventory services enforce balances, movements, transactions, and coexistence rules.
- Protected requests reload Business/Staff; session claims alone are insufficient.
- Recipient/channel access is derived server-side.

No feature is a separate microservice.

## 8. Database

MongoDB uses Mongoose. src/config/db.js owns connection. MONGODB_URI may use a local development fallback; production validation requires it. Indexes are declared in schemas and can be checked through INDEX_VERIFY_STRICT. There is no general migration framework.

### Complete model catalog

| Model | Purpose, important fields, constraints, usage |
|---|---|
| Business | Tenant root: businessId, country/slug, contact/address, currency/timezone, type/modules/categories, property/hotel data, owner hash/auth/tokens, preferences, Stripe Connect and billing. Unique identities; read by nearly every feature. |
| Staff | Tenant staffId, role, profile/email/hash, status/presence, permissions/restrictions, invite/reset/authVersion. Unique within tenant; auth and operations. |
| ServicePoint | Tenant physical table/room/booth/other: ID, label/code, type, room type, capacity, active/reservable, price/beds/amenities/images, qrVersion/readiness. Orders, reservations, QR, housekeeping. |
| ServiceRequest | Guest/waitstaff request with tenant/context/SP/reservation/session/device/reason/status/claim/expiry. Partial unique active-scope key prevents duplicates. |
| GuestProfile | CRM contact and visit/order/spend aggregates. Guest entity, never dashboard authentication. |
| CustomerJourney | Visit context, guest/session/device/SP IDs and counters. |
| GuestVisit | Tenant/email/date visit projection. |
| CustomerConsent | Order/email marketing-consent audit. |
| CrmOrderProjectionLedger | Idempotent order-to-CRM projection record. |
| Order | Embedded item snapshots, tenant/SP/session/journey, source/staff, fulfillment/status, money/payment/Stripe/commission, receipt, idempotency, inventory evidence. Strong validation; central restaurant aggregate. |
| Reservation | Restaurant/hotel aggregate: tenant/type/status/source, guest PII, times/dates/party/room/SP, idempotency, secure action tokens, pricing/cents/payment/Stripe/commission, refund/email/reminder/check-in/archive. Indexed for tenant/date/overlap/search. |
| PendingCheckout | Pre-payment attempt and snapshot: tenant/order-or-reservation, fingerprints/idempotency/status/expiry, Stripe request/session, inventory hold and reconciliation. Provider binding before materialization. |
| ReservationRefund | Durable provider refund/idempotency/amount/fee/type/status/actor/email audit. |
| BillingInvoice | Stripe Billing invoice ledger plus legacy-compatible fields, amount/currency/status/URLs/period/customer/subscription. |
| Plan | Slug/level, monthly price, commission, offline allowance, entitlements, Stripe price IDs, active status. |
| MenuItem | Tenant menu product: price/category/type/station/behavior, availability, image, archive, Simple Stock settings/linkage. |
| InventoryItem | Canonical tenant balance: identity/category/domain, unit/dimension, onHand, reserved, cost, active/archive, optimistic version. Unique normalized operational identity. |
| InventoryMovement | Append-only ledger: type, deltas, before/after, source/actor, idempotency, allocations, cost/discrepancy. |
| InventoryReservation | Checkout/order stock allocation, canonical/legacy/sidecar snapshots, status/provider state/idempotency/version. |
| MenuInventoryRecipe | Tenant+menu mapping, mode/status/version, canonical components, independent ingredientComponents, migration/lifecycle snapshot. |
| InventoryPaymentException | Visible paid-order inventory reconciliation exception. |
| HousekeepingOperation | Tenant/room trigger/status/priority, assignment/history/claims, completion, supply outcome, inventory exception, command receipts. |
| Notification | Durable recipient notification with tenant, role/access filters, type/payload, read, TTL, idempotency. |
| NotificationIntent | Fan-out/outbox intent with recipient policy, claim/status/attempts/TTL/idempotency. |
| EmailDelivery | Durable email intent/ledger: tenant/entity/job/version/type, recipient metadata, status/attempts/provider/error/schedule. |
| Feedback | Tenant/order/session proof, ratings/comment/tags/sentiment; unique submission boundary. |
| StripeWebhookEvent | Provider event claim with event ID/type/status/lease/attempt/error/completion. |
| OnboardingSession | Temporary owner/business draft, password hash, verification/step, approximately seven-day TTL. |
| WeeklyAnalystReport | Tenant/week snapshot, deterministic insights, provider/model/token usage, normalized report/status/email. Unique period. |

### Relationships and invariants

    Business
    +-- Staff, ServicePoint, MenuItem, Order, Reservation
    +-- InventoryItem, Notification, EmailDelivery, WeeklyAnalystReport
    +-- logical Plan and Stripe account/subscription relationships

    ServicePoint
    +-- Order, Reservation, ServiceRequest, HousekeepingOperation
    +-- signed GuestSession capability context

    MenuItem
    +-- one MenuInventoryRecipe
    +-- optional Simple Stock InventoryItem
    +-- immutable snapshots in PendingCheckout and Order

    PendingCheckout
    +-- optional InventoryReservation
    +-- settles into Order or Reservation payment state
    +-- processed through StripeWebhookEvent

    Order
    +-- InventoryMovement, Feedback, CRM projection, GuestProfile/Journey

    Reservation
    +-- ServicePoint, PendingCheckout attempts, ReservationRefund
    +-- HousekeepingOperation, EmailDelivery, Notification

Tenant relationships use businessId rather than database foreign keys; every query must scope tenant. Inventory requires onHand >= reserved >= 0 and Available = On Hand - Reserved. InventoryMovement is append-only. Online checkout does not create a paid Order before a validated webhook. Cascades and soft deletion are service-controlled.

There is no Transaction model. Owner transaction reporting is a virtual union of paid orders and reservation transactions. Do not add a competing transaction collection without an approved architectural change.

## 9. Authentication

Onboarding creates a temporary OnboardingSession with hashed password and email verification. Completion creates the canonical Business/owner. Owner/staff invitations use random 32-byte tokens stored as hashes with expiry.

Login normalizes email, checks Business or Staff, performs a dummy bcrypt comparison when appropriate to reduce enumeration timing, verifies bcrypt, regenerates the Express session, writes identity claims, and saves it. The browser receives qs_dashboard_session. Sessions live in Redis under qs:sess:, roll for eight hours, and use HttpOnly; production Secure and SameSite=None; development SameSite=Lax.

There is no dashboard JWT refresh cycle. Auth middleware reloads Business/Staff and checks tenant, active status, email, and authVersion. Password/email/access changes rotate versions and signal revocation. Co-owner access has SSE invalidation. Logout destroys the session and clears the cookie. Session-store failure returns 503.

Forgot-password responses are generic. Reset/invite/email-change capabilities are random, hashed at rest, expiring, and consumed on success. Passwords use bcrypt.

QR guests are narrow capabilities, not authenticated users. A signed URL fragment is exchanged for GuestSession bound to business, service point, device, QR version, and expiry. Reservation action links and confirmation Checkout Session IDs are separate, least-privilege capabilities.

Platform admin uses Supabase bearer verification plus PLATFORM_ADMIN_EMAILS and a short in-memory verification cache. Internal automation uses CRON_SECRET.

No tenant-user OAuth/social login, MFA, TOTP, or passkey implementation was found. External MFA for platform admins is **Unknown / requires runtime or team confirmation**.

Primary files: contexts/AuthContext.tsx, hooks/use-auth-guard.ts, lib/axios-config.ts, src/routes/auth-route.js, src/controllers/authController.js, src/middleware/authMiddleware.js, src/config/session.js, src/config/sessionRedisClient.js, Business.js, Staff.js, and onboarding controllers/services.

## 10. Authorization and permissions

Canonical tenant roles: owner, co_owner, manager, waiter, kitchen, bartender, housekeeping. Some compatibility guards accept admin or restaurant_owner; they are not the canonical Staff enum.

Authorization layers are identity/capability, tenant derivation, role, management area, granular permission, business module, plan entitlement, and resource relationship.

| Actor | Allowed scope | Key boundary |
|---|---|---|
| QR guest | Exact tenant/SP/GuestSession journey | No dashboard or arbitrary order access |
| Reservation capability | One reservation read/action | Confirmation capability is read-only |
| Operations staff | Role queue/actions | No owner config by role alone |
| Manager | Explicit areas and permissions | Default deny |
| Co-owner | Broad access subject to restrictions | Team and sensitive billing ownership remain primary-owner-only |
| Primary owner | Tenant-wide | Still businessId scoped |
| Platform admin | /admin cross-tenant | Supabase token plus allowlist |
| Internal | Named /internal handlers | CRON_SECRET only |

Frontend helpers hide routes/navigation, but backend middleware is authoritative. Reviewed material mutations have backend enforcement. Authenticated businessId derives from canonical identity or referenced records, not security-sensitive client input. Upload folders derive from authenticated business. Public confirmation binds capability, attempt, reservation, and tenant.

The waitstaff layout is broader than some child role assumptions, which may create UX-level access confusion, but it does not create backend privilege escalation.

## 11. Data flow

### Dashboard login

Login form → Axios POST /auth/login → login limiter → authController.loginUser() → Business/Staff lookup and bcrypt → session regenerate/save in Redis → safe identity response → AuthContext refreshes /auth/me → BusinessContext derives capabilities → permitted workspace renders.

### QR guest order

QR fragment → app/q page → POST /table-session/start with device/SP/capability → signature, QR version, tenant, and SP checks → GuestSession returned to sessionStorage and fragment removed → menu page GET /menu-items → scoped Zustand cart → POST /orders for offline mode or /payments/checkout online → server validates item IDs/prices/availability/tenant → canonical records → guest status consumes API/SSE updates.

### Stripe guest checkout

Cart → POST /payments/checkout with quantities/context/idempotency → GuestSession and server menu validation → Mongo transaction creates PendingCheckout plus InventoryReservation hold → Stripe Checkout Session with connected-account/application-fee metadata → browser redirects → Stripe POST /webhook/stripe → signature and StripeWebhookEvent claim → validate exact attempt/account/amount/currency → transaction materializes paid Order and inventory state → emails/CRM/notifications queued → SSE updates UI.

### Restaurant reservation

Public slug page → availability query → restaurant availability service checks hours, slot rules, existing reservations, and reservable ServicePoints → POST /public/reservations with idempotency → Reservation created → owner/guest email/notification work → owner queue updates. A no-show is a manual staff status transition; elapsed time or reminder delivery does not create no_show automatically.

### Hotel booking

Hotel page → available rooms and pricing preview → server derives stay dates, occupancy, room inventory, taxes/fees and hasAdditionalCharges → Reservation/PendingCheckout attempt → Stripe checkout → durable webhook validates and confirms payment exactly once → confirmation page uses fragment capability header and polls briefly for convergence → arrival/check-in and later housekeeping use separate commands.

### Inventory fulfillment

Menu configuration → Simple Stock and/or recipe snapshot → checkout reserves canonical Simple Stock → provider success or offline order persists frozen allocation → kitchen/prepared-bar START consumes reserved Simple Stock once and ingredient sidecar once → InventoryMovement records before/after → short ingredient sidecar zero-floors with visible discrepancy and does not block fulfillment → cancellation/expiry releases eligible holds.

### Housekeeping

Reservation/room trigger → HousekeepingOperation → eligible staff/assignment/priority → idempotent start command → optional supply-use or no-supplies decision → inventory room usage transaction → complete command → room/operation state and SSE/notification update. Inventory failure becomes an acknowledgeable/resolvable exception.

### Co-owner revocation

Primary owner changes co-owner access → Staff restrictions/auth/access version updated → access signal published → /auth/access-events reaches AuthContext → identity/route state refreshes or session is revoked → backend immediately applies new canonical restrictions regardless of client timing.

## 12. API client and frontend/backend communication

lib/axios-config.ts uses NEXT_PUBLIC_API_BASE_URL, defaulting to http://localhost:5000, with JSON and withCredentials. Dashboard authentication is cookie-based. QR and reservation capabilities use explicit headers/body values from sessionStorage or URL fragments; the fragment is removed before navigation/referrer/analytics leakage.

The 401 interceptor broadcasts SESSION_REVOKED. Errors are otherwise handled locally and payload shapes remain endpoint-specific. No general retry policy exists. No CSRF token header exists; server Origin/Referer validation, CORS, cookie policy, and route authorization provide current defense. SSE uses native EventSource with credentials, browser-native reconnect, parsing guards, and visibility recovery.

Backend Redis response cache uses versioned tenant keys and bounded command timeouts. Public config/menu/setup reads are cached and invalidated by writes. It fails open for non-session cached content; session Redis fails closed.

Frontend directly consumes only the Chillow API, Stripe.js, Vercel Analytics, camera APIs, and QR libraries. Backend consumes MongoDB, Redis, Stripe, Resend, Cloudinary, Google Places, Supabase Auth, and Cloudflare AI.

## 13. Third-party services

| Service | Purpose and direction | Configuration and failure handling |
|---|---|---|
| Stripe Checkout/Connect | Backend creates guest sessions; Stripe calls /webhook/stripe; funds route to connected account with application fee | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET; durable attempts/events, idempotency, signature, reconciliation |
| Stripe Billing | Platform subscription, payment method, invoices, dunning, entitlements | Stripe secret and billing webhook configuration; BillingInvoice ledger and lifecycle worker |
| Resend | Transactional reservation, receipt, auth, billing, onboarding, AI mail | RESEND_API_KEY and sender variables; EmailDelivery outbox, retries, recovery |
| Cloudinary | Property, logo, menu, generic authorized images | cloud name/key/secret; memory upload, transformations, save-before-old-delete |
| Redis | Sessions, BullMQ, cache, presence, pub/sub | REDIS_URL; sessions fail closed, auxiliary features degrade/recover |
| MongoDB | Canonical application data | MONGODB_URI; API readiness depends on connection |
| Supabase Auth | Platform-admin bearer verification only | SUPABASE_URL and service-role key; allowlist and short cache |
| Google Places | Onboarding address suggestions | GOOGLE_PLACES_API_KEY; rate-limited server proxy |
| Cloudflare Workers AI | Weekly analyst report generation | account/token/model/base URL/timeouts; validated normalized output and durable report status |
| Vercel Analytics | Frontend usage analytics | Client package; hosting relationship not established |

No PayPal, Twilio/SMS, push-notification provider, Firebase, Auth0, Sentry, or external CRM integration was found.

## 14. Environment variables and configuration

Values are intentionally omitted.

### Frontend

| Variable | Purpose | Required | Scope/sensitive |
|---|---|---|---|
| NEXT_PUBLIC_API_BASE_URL | Backend base URL | Optional in local; required for deployed separation | Client; no |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | Stripe.js | Required for online payment UI | Client; publishable |
| NEXT_PUBLIC_BUSINESS_ID | Legacy/demo tenant fallback | Code-referenced, missing from .env.example | Client; no |

### Backend core/security/providers

| Variables | Purpose | Requirement/sensitivity |
|---|---|---|
| NODE_ENV, PORT | Runtime mode/listen port | Optional/defaulted; not secret |
| MONGODB_URI | Mongo connection | Production required; secret |
| REDIS_URL | Sessions/queues/cache/pub-sub | Production/worker required; secret |
| SESSION_SECRET | Cookie-session signing | Production required; secret |
| FRONTEND_BASE_URL, BACKOFFICE_BASE_URL, BACKEND_BASE_URL | CORS and generated links | Frontend required in production; backend/backoffice conditional; non-secret but security-sensitive config |
| STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_BILLING_WEBHOOK_SECRET | Payments/webhooks | Required by enabled flows; secret |
| CRON_SECRET | Internal endpoint bearer | Required for external invocation; secret |
| CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | Upload provider | Required for uploads; key/secret sensitive |
| RESEND_API_KEY | Email provider | Required when email enabled; secret |
| EMAIL_FROM_RECEIPTS, EMAIL_FROM_AUTH, EMAIL_FROM_ONBOARDING, EMAIL_FROM_BILLING, EMAIL_FROM_RESERVATIONS | Sender identities | Flow-dependent; not secret |
| GOOGLE_PLACES_API_KEY | Address lookup | Flow-dependent; secret |
| SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLATFORM_ADMIN_EMAILS | Platform admin | Required for admin; role key secret, allowlist security-sensitive |
| CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_AI_TOKEN, CLOUDFLARE_AI_MODEL, CLOUDFLARE_AI_BASE_URL, CLOUDFLARE_AI_TIMEOUT_MS, CLOUDFLARE_AI_MAX_TOKENS, CLOUDFLARE_AI_TEMPERATURE | AI reports | Entitlement/feature-dependent; token secret |
| QR_CAPABILITY_SIGNING_SECRET | QR capability signatures | Required in production; secret |
| RESERVATION_ARRIVAL_TOKEN_SECRET, RESERVATION_CANCELLATION_TOKEN_SECRET | Guest reservation action tokens | Required by actions; secret |

### Operational flags

| Variables | Purpose |
|---|---|
| BULLMQ_ENABLED and BULLMQ_DIAGNOSTIC_ENABLED | Global/diagnostic queue controls |
| BULLMQ_EMAILS_ENABLED, BULLMQ_RESERVATION_ENABLED, BULLMQ_BILLING_ENABLED, BULLMQ_POST_PAYMENT_ENABLED, BULLMQ_INVENTORY_ENABLED, BULLMQ_NOTIFICATIONS_ENABLED | Per-domain worker rollout |
| AI_ANALYST_WEEKLY_ENABLED | Weekly report schedule |
| SIMPLE_STOCK_KILL_SWITCH | Operational 503 kill switch for canonical Simple Stock |
| CACHE_COMMAND_TIMEOUT_MS | Cache command bound |
| WAITER_REQUEST_COOLDOWN_MINUTES | Guest request cooldown |
| RESTAURANT_ARRIVAL_REMINDER_TEST_DELAY_SECONDS | Non-production timing override |
| INDEX_VERIFY_STRICT | Index verification strictness |
| INVENTORY_TEST_MONGODB_URI | Mongo-backed inventory tests |
| ALLOW_TEST_EXTERNAL_PROVIDERS | Explicit test-only override; normally provider guards block external calls |

Backend .env.example documents most core/provider variables but omits at least BACKEND_BASE_URL, EMAIL_FROM_RESERVATIONS, RESERVATION_CANCELLATION_TOKEN_SECRET, SIMPLE_STOCK_KILL_SWITCH, INDEX_VERIFY_STRICT, and test-only variables. Keep examples synchronized with envValidation and process.env searches.

## 15. File uploads and storage

src/routes/upload-route.js and upload controllers use Multer memoryStorage with a 5 MB maximum. Accepted declared MIME types are JPEG, PNG, and WebP. Routes require session plus menu/service-point/business-settings/branding permissions. The server derives quickserve/<businessId>/<allowlisted-category>; clients cannot choose an arbitrary folder.

Cloudinary stores and transforms images. Dedicated property/logo/menu handlers update canonical Business/MenuItem references. Replacement saves the new reference before deleting the old asset, reducing destructive failure risk. No permanent local upload directory exists.

Concerns:

- Validation trusts declared MIME before Cloudinary parsing; add magic-byte/decoder validation for defense in depth.
- Memory buffering makes concurrent 5 MB uploads a capacity concern.
- Generic upload error handling can return provider error messages; normalize external details.
- Public/private delivery policy, signed URLs, retention, and provider backup are **Unknown / requires runtime or team confirmation**.

## 16. Payments and billing

### Guest/order payment

Stripe is the provider source of truth; backend records are the application ledger. The frontend sends item IDs and quantities, never authoritative prices. Backend validates GuestSession, tenant, menu availability, currency, connected account, commission, and fingerprint. A Mongo transaction creates PendingCheckout and inventory hold before Stripe creation. Stripe idempotency and persisted provider-request state repair ambiguous timeouts.

No paid Order is created at checkout initiation. The signed webhook claims StripeWebhookEvent, validates exact attempt/session/account/amount/currency, and materializes/settles once. Duplicate events are idempotent. Unexpected second or mismatched payments become durable reconciliation evidence; code does not invent an automatic refund.

Waiter/offline ordering creates an unpaid canonical Order with server-derived pricing. Mark-paid/reconciliation are explicit authorized transitions.

### Reservations

Hotel pricing is computed on the server from canonical room/rate/stay rules. Pending reservation checkout uses a secure token and attempt fingerprint. Webhook payment confirms exactly once. Confirmation reads require a capability bound to that attempt and return masked/minimal data. Restaurant reservations may be non-payment flows; hotel and restaurant status semantics remain distinct.

### Platform billing

Business holds plan, Stripe customer/subscription, payment method, billing status, dunning, and entitlement state. BillingInvoice is the durable invoice ledger. Owner APIs create setup intents, verify/delete a method, change plan, report offline usage, view/archive invoices, and view commission. Primary owner controls mutations.

Lifecycle jobs cover upcoming invoice, past-due day 3/5/7-style actions, restriction, recovery, and restore. Webhooks remain authoritative for paid/failed subscription state.

### Refunds and money

Reservation refunds require an explicit high-trust owner/co-owner boundary and write ReservationRefund. A dedicated granular refund permission is still a noted TODO. Provider minor units and application decimal DTOs coexist; helpers support zero-, two-, and three-decimal currencies. Any change must test conversion, commission, rounding, and legacy fields.

## 17. Real-time features

The system uses SSE, not WebSockets.

- GET /events authenticates a dashboard session or guest capability and derives allowed channels.
- Redis pub/sub channel quickserve:events distributes events across processes; local publish provides immediate same-process delivery.
- Role channels include kitchen, bar, waitstaff, reservations, housekeeping, owner/management, and guest service-point/order scope.
- Events include order changes, fulfillment, waiter-call lifecycle, reservation changes, service-point changes, housekeeping changes, notification changes, and access revocation.
- Frontend EventSource uses credentials, native reconnect, JSON parse guards, and visibility-based recovery.
- Co-owner access uses /auth/access-events. Owner notifications use /owner/notifications/events.

Payloads must remain privacy-minimized and server-filtered. Redis outage can degrade cross-instance realtime; exact operational fallback under a multi-instance outage is **Unknown / requires runtime or team confirmation**.

## 18. Background jobs and automation

BullMQ queues cover diagnostic, email, reservations, billing, post-payment, AI analyst, inventory, and notifications. Worker concurrency is intentionally low/bounded by domain, with email and notifications modestly parallel and financial/inventory work serialized or near-serialized.

Repeatable schedules found:

- reservation expiry/repair, inventory repair, and notification repair approximately every five minutes
- CRM/post-payment recovery approximately every ten minutes
- billing lifecycle hourly
- weekly AI scan/generation Monday around 06:00 UTC

Jobs use deterministic IDs, durable intent/event rows, leases/claims, and exponential retry. Typical attempts range from 3 for AI to 5–8 for critical delivery/recovery. Email jobs include reservation owner/guest/confirmation/cancellation/arrival, order receipt, refund, billing states, onboarding, and AI report. Feature flags permit staged queue rollout.

Internal endpoints execute scans/recovery but do not register repeat schedules. The worker must be deployed independently. Actual repeatable-job registration ownership in production is **Unknown / requires runtime or team confirmation**.

## 19. Email and notifications

Resend sends React Email templates under emails, including reservation request/received/confirmed/cancelled/arrival, hotel payment confirmation, refund, receipt, onboarding, auth/email-change, billing, and shared base templates.

EmailDelivery is the durable outbox/ledger. Services persist an intent before enqueue, use deterministic entity/job/version identity, claim once, record provider outcome, and expose recovery. Queue-disabled paths have controlled direct/fallback behavior depending on feature configuration. Tests block external providers unless explicitly overridden.

NotificationIntent is the in-app fan-out outbox. Workers resolve eligible recipients into Notification rows. Owner/staff read/unread APIs and SSE invalidate the UI.

No SMS, mobile push, or browser push provider was found. Delivery-domain authentication, bounce handling, and provider dashboard monitoring are **Unknown / requires runtime or team confirmation**.

## 20. SEO

Technical SEO is minimal:

- app/layout.tsx has root title/description metadata; onboarding has local metadata.
- No sitemap, robots route/file, canonical URL policy, structured data, Open Graph configuration, or Twitter card configuration was found.
- Public business and reservation pages are predominantly client-rendered, so business-specific metadata is not produced server-side.
- Root page is demo-oriented and retains QuickServe branding.
- Private dashboards lack an explicit checked-in robots strategy.
- next.config.mjs sets images.unoptimized, and several screens use raw img elements.

This is insufficient for strong public discovery. Add server-derived dynamic metadata for public business pages, canonical/alternate policy, robots, sitemap, structured hospitality data, and share cards after canonical production domains and indexing policy are confirmed. Those domains/policies are **Unknown / requires runtime or team confirmation**.

## 21. Security

No exploitation was attempted. Labels distinguish confirmed code evidence from deployment-dependent risk.

### Findings

| Severity/status | Location/evidence | Why it matters | Recommendation |
|---|---|---|---|
| Medium, CONFIRMED | Backend package-lock/npm audit: Multer 2.3.0, GHSA-3pph-fpjx-jg34 | Vulnerable dependency permits aborted-upload orphan behavior. This app uses memoryStorage, reducing the advisory’s disk-orphan path, but the affected package remains installed and upload DoS behavior needs review. | Upgrade to Multer 2.4+, rerun upload tests and npm audit. |
| Medium, LIKELY when horizontally scaled | server.js and scoped express-rate-limit uses default process memory, except auth Redis limiter | Per-instance limits can be bypassed across replicas and reset on restart. | Use a shared Redis rate-limit store for public/payment/global limits and confirm trusted proxy/IP semantics. |
| Medium, LIKELY defense gap | src/middleware/originValidation.js; production SameSite=None cookie; comment says CSRF tokens will be added | State-changing cookie routes rely on allowed Origin/Referer, but requests missing both headers are accepted for non-browser compatibility. This is not a confirmed exploit but is weaker than token binding. | Add session-bound CSRF tokens to browser mutations; retain Origin/CORS checks; explicitly scope exceptions. |
| Low, CONFIRMED hardening gap | upload middleware | Declared MIME is checked but file magic/decoded format is not checked before provider handoff. | Validate bytes/decoder output and cap dimensions/pixels. |
| Low, CONFIRMED information-handling issue | generic upload error path | External/provider error.message may reach clients. | Map to stable public error codes and log redacted details server-side. |
| Informational, CONFIRMED | next.config.mjs | typescript.ignoreBuildErrors allows production build to ignore type failures. This is a release-integrity risk more than an application vulnerability. | Remove the bypass after making CI typecheck mandatory. |
| Informational, NEEDS MANUAL VERIFICATION | local ignored .env files and production configuration | Secret quality, rotation, provider privileges, DB/Redis network ACLs, TLS, WAF, backups, and log sinks cannot be proven statically. | Review deployed secret manager and provider configurations without copying values into tickets/docs. |

### Verified protections

- **NOT VULNERABLE in reviewed path:** anonymous raw reservation ID does not expose private reservation data. Confirmation requires an exact PendingCheckout/Checkout Session capability, active/settled state, tenant/reservation binding, retention window, and strict masked DTO.
- **NOT VULNERABLE in reviewed path:** upload folder authority is server-derived from authenticated businessId and allowlisted category.
- **NOT VULNERABLE in reviewed path:** user search text uses an escaped, trimmed, length-bounded regex helper; other dynamic regex construction reviewed was escaped.
- **NOT VULNERABLE in reviewed path:** frontend price, fee, tenant, role, or payment state is not accepted as financial/authorization truth.
- Passwords and invitation/reset tokens are hashed. Sessions are HttpOnly and Redis-backed. Stripe webhook verifies raw-body signature before durable claim. Helmet and explicit credentialed CORS are enabled. Protected requests reload canonical identities. Tests block accidental external provider calls.
- A pattern search outside ignored environment/test/lock content found no committed live credential. Actual local values were not inspected.

### Additional review points

- Capability fragments avoid automatic network/referrer disclosure, but copied URLs can still share the capability. Keep expiration, record binding, masking, and revocation.
- Swagger is public in application routing. Whether a perimeter restricts production /api-docs is **Unknown / requires runtime or team confirmation**.
- Some console diagnostics can contain business identifiers or operational detail; adopt redaction and structured fields.

## 22. Error handling

Backend critical services use typed/code-bearing errors and map conflicts, validation failures, not-found, permission failures, provider uncertainty, and infrastructure outages to appropriate HTTP states. server.js has a generic final 500 handler that logs the internal error and returns only Internal Server Error. Session Redis failure is explicitly 503. Financial/provider ambiguity is persisted for repair rather than silently treated as failure or success.

Controllers are not fully uniform: response shapes and error codes vary by feature, and some catch blocks log then return generic strings. Queue processors record attempt/error state. Cache/realtime helpers often degrade intentionally, while payment/inventory paths fail closed or create exceptions.

Frontend pages generally catch Axios errors locally, show toast/inline error, and retain loading/empty states. The shared interceptor only centralizes session revocation. No root React error.tsx/global error boundary was identified across all routes. A few asynchronous effects intentionally suppress cancellation/stale errors; feature code must distinguish those from swallowed operational failure.

## 23. Logging and observability

Logging is console.log/warn/error with subsystem prefixes such as Startup, BillingRecovery, EmailDispatch, and worker names. There is no common structured logger, request/correlation ID middleware, metrics registry, tracing, Sentry, or alerting SDK.

Operational signals available:

- GET /healthz and /ready
- internal queue health and diagnostics
- durable StripeWebhookEvent, EmailDelivery, NotificationIntent, BillingInvoice, reconciliation, and exception rows
- BullMQ job state
- provider dashboards
- Vercel Analytics on frontend

To diagnose production today, an engineer would correlate platform logs with tenant/entity/provider IDs, inspect health/queue endpoints, query durable ledger/outbox rows, and inspect Stripe/Resend/Cloudinary dashboards. Without request IDs and centralized search this is slower and risks log inconsistency. Actual log retention/aggregation and alerts are **Unknown / requires runtime or team confirmation**.

## 24. Testing

### Frontend

There are 58 .test.mjs files using node:test. Most are source/contract assertions for routes, permissions, capabilities, money, reservation privacy/pricing, UI text, and architecture rather than rendered component/browser tests.

Current audit results:

- TypeScript: passed with tsc --noEmit --incremental false.
- Aggregate node --test: 376 tests; 371 passed, 5 failed.
- Two failures were ERR_UNKNOWN_FILE_EXTENSION when Node 20.11 attempted to import TypeScript; repository requires Node 24. Re-run under Node 24.
- Three hotel-room-pricing-display tests are stale source-location assertions: they expect pricing logic in reservationController.js after it moved to hotelReservationAvailabilityService.js. The current service still computes the canonical pricing summary/hasAdditionalCharges, but the suite remains red until tests follow the refactor.
- ESLint: 62 findings, including 2 prefer-const errors in lib/customer-notification-reconciliation.ts and 60 warnings dominated by raw img and hook dependency issues.
- No Playwright, Cypress, component renderer, or visual regression suite was found.

### Backend

There are 124 native Node test files covering auth, tenancy, permissions, reservation/payment idempotency, privacy, billing, webhook durability, QR capabilities, inventory/concurrency/coexistence, housekeeping, jobs, email, notification, search, and uploads. Some integration tests require INVENTORY_TEST_MONGODB_URI and skip otherwise.

Current audit results:

- Focused security/integrity set: 177 tests, 176 passed, 1 skipped, 0 failed. It covered onboarding auth hardening, public tenant resolution, reservation privacy, bounded regex, uploads, reservation payment idempotency, billing, QR capability, inventory coexistence, and lifecycle.
- Full node --test did not complete within approximately ten minutes and returned no final summary. This indicates a runner/open-handle or long-suite operational problem, not a proven test failure.
- package.json npm test intentionally exits with an error; engineers must invoke node --test or named scripts.
- No backend lint script or measured coverage percentage was found.

Major gaps: browser E2E for guest/owner workflows, accessibility automation, deployment smoke tests, full-suite runtime hygiene, current Node 24 CI, and live-but-sandboxed provider contract tests. No coverage percentage is claimed.

## 25. Development workflow

Prerequisite: Node 24.x. MongoDB and Redis are required for realistic backend operation; Stripe/Resend/Cloudinary/Google/Supabase/Cloudflare variables are required only for enabled integrations.

Frontend:

    cd C:/Users/pc/Desktop/Quick-serve-qr-menu
    npm install
    copy .env.example .env.local
    npm run dev
    npm run lint
    node --test
    npm run build
    npm start

Backend:

    cd C:/Users/pc/Desktop/Quickserve-be
    npm install
    copy .env.example .env
    npm run dev
    npm run worker
    node --test
    npm start

Use separate terminals for frontend, API, and worker. Check /healthz and /ready. Configure Stripe webhook delivery to /webhook/stripe for payment testing. Do not enable ALLOW_TEST_EXTERNAL_PROVIDERS casually.

Caveats:

- npm test in backend is intentionally nonfunctional.
- Frontend has two lockfiles; do not regenerate both until one manager is approved.
- No automatic DB migration/seed step exists. Review named scripts before execution.
- The audit did not install, build, seed, or call providers. Build writes .next and next.config currently ignores TypeScript build errors.
- Formatting command is **Unknown / requires runtime or team confirmation**; no dedicated formatter script was found.

## 26. Build and deployment

Observed flow:

    Developer
      -> Git repository
      -> unknown external CI/deployment trigger
      -> frontend: npx next build -> .next -> Netlify plugin or possible Vercel
      -> backend: npm start -> node server.js
      -> worker: npm run worker -> node src/workers/index.js
      -> configured DNS/proxy/provider services

Frontend package declares Node >=24 <25. Netlify configuration is checked in; README also contains Vercel evidence. Backend and worker deployment definitions are absent. No branch policy, environment promotion, migration gate, smoke-test gate, artifact registry, rollback automation, or blue/green strategy is represented.

Production deployment owner, canonical platforms, domains, worker replica count, scheduler singleton strategy, environment injection, release branches, and rollback process are **Unknown / requires runtime or team confirmation**.

## 27. Domains and networking

Code-visible assumptions:

- Frontend defaults to http://localhost:3000.
- Backend defaults to http://localhost:5000.
- CORS allows FRONTEND_BASE_URL, http://localhost:3001, and optional BACKOFFICE_BASE_URL with credentials.
- app trusts one proxy hop.
- Stripe webhook is BACKEND_BASE_URL/webhook/stripe or provider-configured equivalent.
- Swagger contains an api.quickserve.com example/server reference that may be stale.
- Public slug routes use countryCode/businessSlug.

Production/staging frontend, API, backoffice, CDN, DNS, TLS termination, firewall, and callback URLs are **Unknown / requires runtime or team confirmation**. Do not copy documentation examples into production config without verification.

## 28. Code conventions

- Frontend route files follow App Router page.tsx/layout.tsx; reusable UI belongs in components, behavior in hooks/lib/contexts/stores.
- Client modules that use browser APIs declare use client.
- Imports commonly use the @ alias. TypeScript is strict and ES6-targeted; avoid BigInt literal syntax.
- UI styling uses Tailwind utilities, shared Radix/shadcn primitives, and CSS modules for isolated complex layouts.
- Backend files use ESM imports, lower/camel service/controller names, PascalCase Mongoose models, and route suffix conventions.
- API paths are resource-oriented but contain legacy compatibility aliases; extend canonical paths and preserve old contracts until migration is explicit.
- businessId is the tenant key. Derive it from auth/canonical records.
- ServicePoint is the only physical table/room/booth abstraction.
- Use permission constants and management/module/entitlement middleware rather than ad hoc role checks.
- Use safe bounded search helpers for untrusted regex.
- Use integer provider minor units and tested conversion helpers.
- Critical writes require idempotency, unique indexes, transactions/optimistic versions, and durable recovery.
- Tests commonly assert architecture/source contracts in addition to behavior.

## 29. Duplication and technical debt

Confirmed:

- Legacy QuickServe/Chillow naming coexistence across UI, storage, cookies, folders, and docs.
- /orders and /businesses/:businessId/orders expose overlapping compatibility handlers.
- Current and legacy not-coming routes coexist.
- Business owner identity and Staff identity require branching in auth.
- package-lock and pnpm-lock coexist.
- next.config ignores TypeScript build errors.
- Frontend aggregate tests and lint are red as documented.
- Backend npm test intentionally exits; full direct suite exceeds ten minutes.
- Transaction reporting unifies multiple sources and must bridge decimal/cent legacy fields.
- No versioned migration framework, checked-in CI, or structured observability.
- Large owner/backend route/controller modules create coupling.
- Zero-byte root file named {console.error(e) is repository debris.
- Swagger/example branding and several documents retain older QuickServe assumptions.

Possible/requires validation:

- nodemon is a backend runtime dependency though normally development-only.
- Some component libraries may be used only by scaffolding; static manifest review alone cannot prove unused dependencies.
- Duplicate auth response properties and repeated staffId assignments are harmless but noisy.
- Circular dependencies were not proven; run a dependency-graph tool before claiming them.

Do not “clean up” legacy fields/routes based only on appearance; clients, stored records, emails, and external callbacks may depend on them.

## 30. Incomplete features

- Waitstaff past-order actions for Void, Refund, Reprint, and Manager Notes appear disabled/placeholder.
- Reservation refund authorization notes a future explicit permission; current high-trust role boundary remains.
- Inventory recipe ingredientComponents are intentionally a coexistence sidecar. Their current non-reserving/selected consumption semantics are phase boundaries, not accidental omissions.
- Business setupChecklist has deprecated/compatibility behavior.
- No-show is manual; no timer automatically marks unattended reservations.
- Public dynamic pages lack complete dynamic metadata/SEO.
- No full platform-admin frontend is present here; whether a separate backoffice repository exists is **Unknown / requires runtime or team confirmation**.
- TODO/FIXME markers also cover cleanup and rollout notes, but comments alone are not proof of unfinished runtime behavior.

## 31. Performance

Confirmed design positives:

- Mongo indexes cover tenant/date/status/provider/idempotency and operational queries.
- Owner orders, transactions, inventory, and guest views use server pagination/cursors.
- Redis caches public/stable tenant data with invalidation and bounded command timeout.
- BullMQ moves slow email, recovery, notifications, and AI work out of HTTP requests.
- Checkout/webhook paths avoid duplicate provider/database work through idempotency.

Risks:

- Most frontend pages are client components, increasing JavaScript and delaying public content/metadata.
- images.unoptimized and raw img usages bypass Next image optimization.
- No dynamic-import/lazy-loading strategy was found for large owner screens/charts/scanner dependencies.
- Large route/controller modules and some multi-model dashboards may become query-heavy; no production traces prove an N+1 today.
- Process-local rate limits/caches do not coordinate across replicas.
- Multer buffers up to 5 MB per upload in memory.
- Full backend test runtime/open handles impair feedback speed.

Bundle sizes, real endpoint latency, cache hit rate, Mongo explain plans, queue lag, and concurrency capacity are **Unknown / requires runtime or team confirmation**.

## 32. Accessibility

Positive code evidence includes Radix primitives for dialogs/menus/tabs, focus-ring styles, aria-live/status usage, labels and alt text in many flows, touch-target considerations, keyboard-capable buttons, reduced-motion handling in prominent animation, and textual chart summaries asserted by tests.

Issues/evidence:

- A clickable div in HotelTodayView has no equivalent native button/keyboard semantics.
- Multiple raw image/input implementations require screen-reader and label verification.
- No automated axe, Playwright keyboard, or screen-reader tests exist.
- Color contrast, focus order, zoom/reflow, camera permission UX, and modal focus restoration cannot be established statically.

Perform WCAG 2.2 AA keyboard, screen-reader, contrast, reduced-motion, 200% zoom, and mobile reflow review on public booking, guest ordering, owner forms, and staff queues.

## 33. Important files: read these first

1. .ai/approved/ARCHITECTURAL_CONSTITUTION.md — non-negotiable entities and invariants.
2. .ai/approved/ARCHITECTURAL_DECISIONS.md — approved structural decisions.
3. .ai/approved/PRODUCT_PHILOSOPHY.md — product boundaries.
4. .ai/approved/ARCHITECTURAL_ANALYSIS.md — cross-repository baseline.
5. Frontend package.json, tsconfig.json, next.config.mjs, netlify.toml — runtime/build constraints.
6. app/layout.tsx and authenticated layouts — provider/navigation composition.
7. contexts/AuthContext.tsx and BusinessContext.tsx — identity and tenant capability.
8. lib/axios-config.ts, lib/permissions.ts, guest/QR capability helpers, stores/cart-store.ts — client contracts.
9. Backend server.js and src/config/envValidation.js — runtime/middleware/environment.
10. src/config/session.js and src/middleware/authMiddleware.js — auth/tenant boundary.
11. src/constants/permissions.js and management access middleware — authorization.
12. src/routes/owner-route.js, public-route.js, payment-route.js, order-route.js — API surface.
13. Business.js, Staff.js, ServicePoint.js, Order.js, Reservation.js, PendingCheckout.js — core data.
14. InventoryItem.js, InventoryMovement.js, InventoryReservation.js, MenuInventoryRecipe.js — stock invariants.
15. Stripe checkout/webhook, reservation, inventory, billing, email, and housekeeping services — high-risk logic.
16. src/workers/index.js and queue configuration — asynchronous runtime.
17. Relevant tests before changing a domain — executable architecture contracts.

## 34. Feature map

| Feature | Frontend | Backend | Database | External | Status |
|---|---|---|---|---|---|
| Onboarding/auth | login/onboarding/setup/reset | auth/onboarding routes/services | Business, Staff, OnboardingSession | Resend, Redis, Google | Implemented |
| Public business | /b | public config/cache | Business, ServicePoint | Redis | Implemented |
| QR guest session | /q, /s | guest-session/signing | ServicePoint, Journey | Redis | Implemented |
| Menu/cart/order | guest and owner menu | menu/order services | MenuItem, Order | Stripe optionally | Implemented |
| Kitchen/bar/waitstaff | role dashboards | operational routes/SSE | Order, ServiceRequest | Redis | Implemented |
| Restaurant reservation | /reserve and owner | availability/reservation | Reservation, ServicePoint | Resend/Redis | Implemented |
| Hotel reservation/payment | hotel/pay/confirmation | pricing/checkout/webhook | Reservation, PendingCheckout | Stripe, Resend | Implemented |
| Owner dashboard/transactions | owner pages | dashboard/virtual reporting | Order, Reservation | Redis | Implemented |
| Service points/QR | owner config/print | SP and QR rotation | ServicePoint | None | Implemented |
| Staff/permissions/team | owner staff/settings | auth/access services | Staff, Business | Redis/Resend | Implemented |
| Inventory | owner inventory/recipes | transactional inventory services | four inventory models | Mongo transactions | Implemented, phased coexistence |
| Housekeeping | /housekeeping | operation services | HousekeepingOperation | Redis | Implemented |
| CRM/feedback | owner guests/feedback | projection/analytics | GuestProfile etc., Feedback | BullMQ | Implemented |
| Billing/Connect | owner billing | billing/Stripe services | Business, Plan, BillingInvoice | Stripe | Implemented |
| Notifications/email | UI feed/toasts | outboxes/workers/SSE | Notification/Intent, EmailDelivery | Resend/Redis | Implemented |
| AI analyst | /owner/ai | snapshot/generation worker | WeeklyAnalystReport | Cloudflare AI | Implemented/entitled |
| Platform admin | none here | /admin | Business, Staff, Plan | Supabase | Backend only |
| SEO | basic metadata | N/A | N/A | Hosting | Incomplete |
| Observability | analytics only | probes/console | durable ledgers | Provider dashboards | Partial |

## 35. Dependency audit

Frontend groups: Next/React core; Axios/Zustand state; Radix/shadcn UI; Tailwind styling; Stripe payments; Recharts visualization; Framer animation; QR/camera; date/UUID utilities; Vercel analytics; ESLint/TypeScript tooling.

Backend groups: Express/security/session; Mongoose/Mongo; Redis/BullMQ; Stripe; Resend/React Email; Cloudinary/Multer; bcrypt; Swagger; Supabase HTTP verification; utilities and nodemon.

Audit results on 2026-09-29:

- Frontend npm audit and npm audit --omit=dev: 0 vulnerabilities.
- Backend full and production audit: 1 moderate Multer advisory, upgrade available to 2.4.

Outdated does not mean vulnerable. Notable updates requiring planned compatibility testing include Next 16.3.5→16.3.7, Stripe frontend packages, Radix packages, Recharts 2→3, Vercel Analytics 1→2, Framer 12→13, React 19.2→19.3, and backend BullMQ, Cloudinary, Mongoose, Resend, Stripe 20→22, dotenv 17→18, Redis/ioredis/connect-redis major updates. Upgrade by domain, not wholesale.

Potentially unused dependencies require import-graph/bundle confirmation. The clearest manifest hygiene issue is nodemon under backend runtime dependencies and dual frontend lockfiles. No package is called unmaintained without registry evidence.

## 36. Architecture diagram

    Guest/staff/owner browser
              |
              +-- Next.js App Router client UI
              |     +-- Auth/Business contexts
              |     +-- Zustand cart and session/local storage
              |     +-- Axios with cookie/capability
              |     +-- EventSource SSE
              |
              v
    Express API modular monolith
      +-- Helmet, CORS, limits, Origin validation
      +-- Redis session auth and live Mongo identity checks
      +-- role/area/permission/module/entitlement/capability guards
      +-- controllers
      +-- domain services
      |     +-- reservations/payments/billing
      |     +-- orders/inventory/housekeeping
      |     +-- auth/email/notifications/CRM/AI
      +-- Mongoose models
      |
      +--------> MongoDB: canonical state and durable ledgers
      +--------> Redis: sessions, cache, pub/sub, presence, BullMQ
      +--------> Stripe: Checkout, Connect, Billing, webhooks
      +--------> Cloudinary: images
      +--------> Resend: email
      +--------> Google Places: addresses
      +--------> Supabase: platform-admin identity
      +--------> Cloudflare AI: weekly reports
      |
      v
    Separate BullMQ worker
      +-- repeatable scans
      +-- durable retries and recovery
      +-- notifications/email/CRM/inventory/billing/AI

## 37. Representative request lifecycle

Example: owner receives stock.

1. User submits the receive dialog on /owner/inventory/items.
2. Component validates display inputs and calls the shared Axios instance.
3. POST /owner/inventory/items/:inventoryItemId/receive sends quantity/unit/cost/reference and credentials.
4. server.js applies global middleware, session Redis, store health, Origin validation, and /owner router auth.
5. requirePermission(INVENTORY_RECEIVE) reloads canonical identity/tenant and authorizes.
6. receiveOwnerInventory controller ignores client tenant authority and passes req.auth.businessId plus normalized input.
7. Inventory service loads the tenant-scoped InventoryItem, validates unit/dimension and integer canonical quantity, opens a Mongo transaction, updates onHand with optimistic/invariant checks, and creates idempotent InventoryMovement with before/after.
8. Service invalidates affected inventory caches/publishes update as applicable.
9. Controller returns canonical item/movement DTO.
10. Frontend closes the dialog, shows success, and refetches/paginates from backend truth.

Changing this flow must preserve businessId scope, integer units, onHand/reserved invariant, append-only movement evidence, idempotency, concurrency behavior, permission, and failure rollback.

## 38. Engineering risk register

| Risk | Severity | Evidence/impact | Recommended action |
|---|---|---|---|
| Build can ignore TS errors | High release risk | next.config.mjs; broken types can ship | Make typecheck mandatory and remove bypass |
| No repository CI | High process risk | no workflow/config | Add Node 24 install, audits, typecheck, lint, tests, build, smoke gates |
| Full backend suite does not terminate promptly | Medium-high | >10 minute audit timeout | Isolate open handles/slow suites, shard, enforce per-test timeouts |
| Frontend test/lint red | Medium | 5 tests and 2 lint errors | Fix runner version and stale assertions; clear errors |
| Multer advisory | Medium security | live npm audit | Upgrade/test 2.4+ |
| Process-local rate limits | Medium scalability/security | express-rate-limit default store | Redis-backed shared store |
| CSRF tokens absent | Medium defense depth | SameSite=None and Origin-only plan | Add session-bound tokens |
| Limited observability | Medium reliability | console only, no request IDs/tracing | Structured redacted logs, correlation, metrics, alerts |
| Deployment ambiguity | Medium reliability | Netlify/Vercel evidence; no backend config | Document canonical topology and rollback |
| Manual migration model | Medium data risk | scripts without ordered runner | Migration registry, dry run, backups, idempotent tracking |
| Dual money/legacy contracts | Medium integrity | decimal and minor-unit compatibility | Centralize helpers; property/regression tests |
| Inventory phase misuse | High integrity if violated | Simple Stock plus sidecar boundaries | Preserve approved semantics; expand only via explicit phase decision |
| Client-heavy public pages/weak SEO | Medium growth/performance | client rendering and missing metadata | Server metadata/rendering plan |
| Upload memory/MIME hardening | Low-medium | 5 MB memory and declared MIME | Byte validation and concurrency limits |
| Legacy route/naming duplication | Medium maintainability | aliases and QuickServe names | Inventory consumers, deprecate with telemetry/versioning |
| Missing browser/accessibility tests | Medium UX/reliability | no E2E/axe | Add high-value journeys and WCAG automation |

## 39. What I must not break

- businessId tenant isolation on every read/write/event/cache key.
- Backend authority for price, fees, currency, roles, availability, status, inventory, and provider state.
- ServicePoint as the sole physical table/room/booth abstraction.
- Restaurant and hotel reservation semantics as distinct workflows.
- Guests as Guest/GuestSession capabilities, never dashboard-authenticated users.
- Redis HttpOnly dashboard sessions, live canonical identity checks, authVersion revocation, and fail-closed session outage.
- QR fragment bootstrap, QR version rotation, device/SP binding, and fragment removal.
- Confirmation capability binding and privacy-reduced DTO.
- Online invariant: no paid Order before validated Stripe webhook.
- Stripe raw-body middleware ordering, durable event claim, idempotency, account/amount/currency validation, and reconciliation.
- Available = On Hand - Reserved; integer canonical units; append-only movements; transaction/optimistic concurrency.
- Simple Stock and ingredient sidecar coexistence. Do not make recipes affect reservation/Stripe/automatic menu availability unless explicitly approved.
- Frozen order/recipe/inventory snapshots; later edits must not rewrite history.
- Durable EmailDelivery, NotificationIntent, webhook, and provider-recovery contracts.
- Primary-owner-only team and sensitive billing ownership.
- Legacy QuickServe routes/fields/storage/cookies until compatibility is audited.
- Separate API and worker deployment.
- No live payment, email, deployment, production mutation, commit, or push without explicit authorization.

## 40. How to add new features

### Backend pattern

1. Read approved architecture and identify the canonical entity/service.
2. Write behavior, tenancy, authorization, idempotency, concurrency, failure, migration, and compatibility requirements.
3. Extend an existing Mongoose model/service; add a model only if no canonical aggregate fits.
4. Add schema fields/indexes with backward-compatible defaults and a reviewed migration/repair script if needed.
5. Add focused validator/domain helpers.
6. Put critical invariants and transactions in a service.
7. Add a thin controller and route with requireAuth, role/area/permission/module/entitlement in the correct order.
8. Derive businessId and provider truth server-side.
9. Add cache invalidation, SSE/notification, and BullMQ/outbox only when the feature needs them.
10. Test happy path, invalid input, cross-tenant denial, permission denial, replay/idempotency, concurrency, provider ambiguity, retry, and backward compatibility.

### Frontend pattern

1. Add/update shared contract types and domain helpers under lib.
2. Reuse the shared Axios client, Auth/Business contexts, permission catalog, and capability headers.
3. Add hook/component in the closest feature boundary; integrate through App Router page/layout.
4. Use shared UI primitives, accessible labels/focus states, explicit loading/error/empty states, and business terminology/currency/timezone.
5. Keep security decisions on backend; client guards are UX.
6. Keep persisted state scoped by tenant/service point/actor and invalidate after authoritative mutations.
7. Add source/contract tests plus rendered/E2E tests where interaction matters.
8. Run Node 24 typecheck, lint, targeted tests, aggregate tests, and build.

For financial, reservation, inventory, auth, or housekeeping changes, include transaction/concurrency/recovery tests and coordinated API/worker/frontend deployment notes.

## 41. Glossary

| Term | Meaning |
|---|---|
| Business | Tenant and primary owner/billing/configuration root |
| ServicePoint | Physical operational resource: table, room, booth, or other |
| Guest | Customer/CRM identity; never a dashboard user |
| GuestSession | Narrow QR-issued capability bound to device, business, and service point |
| CustomerJourney | One guest visit/order context |
| Order | Canonical restaurant/order aggregate with snapshots, fulfillment, payment, inventory |
| Reservation | Restaurant time-slot or hotel-stay aggregate; subtype semantics differ |
| PendingCheckout | Durable provider attempt and authoritative pre-payment snapshot |
| Transaction | Virtual reporting view across paid orders/reservations; not a collection |
| Simple Stock | Direct MenuItem-to-InventoryItem stock mode |
| Recipe components | Canonical recipe mappings managed separately from Simple Stock |
| ingredientComponents | Coexistence sidecar with intentionally bounded phase behavior |
| On Hand | Physical/canonical inventory quantity |
| Reserved | Quantity held for eligible checkout/order |
| Available | On Hand minus Reserved |
| InventoryMovement | Immutable balance-change evidence |
| InventoryReservation | Durable hold/allocation state |
| HousekeepingOperation | Idempotent room-turnover workflow |
| Management area | Delegated section-level access |
| Permission | Fine-grained action grant |
| Module | Business capability such as foodService or lodging |
| Entitlement | Plan-controlled feature capability |
| Primary owner | Business owner identity with non-delegable ownership actions |
| Co-owner | Staff identity with broad but restrictable management access |
| Reconciliation | Durable resolution path when provider/application/inventory outcomes diverge |
| Outbox/intent | Persisted async work record written before queue/provider action |
| SSE | One-way server-to-browser realtime stream |

## 42. Things the Repository Cannot Tell Us

- **Unknown / requires runtime or team confirmation** — canonical product name/renaming timetable and which legacy QuickServe contracts are externally consumed.
- **Unknown / requires runtime or team confirmation** — whether production is live and which features/flags are enabled per tenant.
- **Unknown / requires runtime or team confirmation** — canonical frontend/backend/worker hosts, staging domains, CDN, DNS, WAF, TLS, and network ACLs.
- **Unknown / requires runtime or team confirmation** — whether Netlify or Vercel is authoritative and what external CI performs.
- **Unknown / requires runtime or team confirmation** — deployment ownership, release branches, environment promotion, rollback, backups, restore testing, and migration approvals.
- **Unknown / requires runtime or team confirmation** — worker replica count, repeatable-job singleton ownership, queue dashboards, and dead-letter policy.
- **Unknown / requires runtime or team confirmation** — centralized log/metric/alert storage and incident response.
- **Unknown / requires runtime or team confirmation** — production secret manager, rotation schedule, provider least privilege, and actual secret strength.
- **Unknown / requires runtime or team confirmation** — Stripe/Resend/Cloudinary/Supabase/Google/Cloudflare account ownership and sandbox/live separation.
- **Unknown / requires runtime or team confirmation** — intended SEO/indexing policy and canonical public domains.
- **Unknown / requires runtime or team confirmation** — browser/device support matrix, localization roadmap, accessibility acceptance process.
- **Unknown / requires runtime or team confirmation** — existence of a separate platform-admin frontend/backoffice repository.
- **Unknown / requires runtime or team confirmation** — retention/deletion/GDPR policies for guest PII, events, email, logs, uploads, and analytics.
- **Unknown / requires runtime or team confirmation** — target throughput/SLOs and production capacity baselines.

# PROJECT CONTEXT FOR AI FULL-STACK ENGINEER

## Product

Chillow/QuickServe is a multi-tenant restaurant and hotel operations platform. Guests discover, reserve, scan, order, pay, call staff, and manage arrival. Staff operate live role queues. Owners manage service points, menus, reservations, inventory, housekeeping, staff, CRM, analytics, branding, billing, and AI reports. Platform administrators use a separate bearer-protected API.

## Architecture

The system is two repositories: a Next.js App Router frontend and an Express/Mongoose modular-monolith backend plus a separate BullMQ worker. MongoDB is canonical state. Redis backs sessions, queues, cache, pub/sub, and presence. REST handles commands/queries; SSE handles realtime.

## Stack

Node 24; Next.js 16.3.5; React 19.2; TypeScript 5; Tailwind 4; Radix/shadcn; Axios; Zustand; Express 5; Mongoose 9/MongoDB; Redis; BullMQ 6; Stripe; Resend/React Email; Cloudinary; Supabase Auth; Google Places; Cloudflare AI.

## Repository structure

Frontend behavior is in app, components, contexts, hooks, lib, and stores. Backend behavior is in src/routes, controllers, middleware, services, models, utils, config, and workers. emails contains templates; test contains native Node suites; scripts contains manual operational/data tools. Read .ai/approved first.

## Frontend

Most pages are client-rendered. AuthContext and BusinessContext own identity and tenant capabilities. Axios sends the HttpOnly session cookie. Zustand stores a tenant/SP/actor-scoped cart. QR and reservation capabilities live in URL fragments/sessionStorage only as narrowly as possible. Navigation is filtered by role, area, permission, module, restriction, and entitlement, but backend is the security boundary.

## Backend

server.js orders raw Stripe webhook, security middleware, health, Redis session, origin validation, routes, Swagger, and final errors. Routes call middleware, controllers, services, and Mongoose. High-risk logic lives in services with idempotency, transactions, durable ledgers, and repair. Worker deployment is mandatory for async completion/recovery.

## Database

Business is tenant root; Staff is dashboard workforce identity; ServicePoint is the only physical resource; Order and Reservation are core aggregates; PendingCheckout is pre-payment truth; inventory uses InventoryItem, Movement, Reservation, and MenuInventoryRecipe; durable provider/async state uses StripeWebhookEvent, EmailDelivery, NotificationIntent/Notification, BillingInvoice, and exception/ledger models. There is no Transaction collection.

## Authentication

Owners/staff use bcrypt plus Redis-backed HttpOnly rolling sessions. Every protected request reloads canonical identity and auth/access versions. QR guests and reservation guests use narrow signed/secure capabilities, not user accounts. Platform admin uses Supabase bearer plus email allowlist. Internal automation uses CRON_SECRET.

## Authorization

Always enforce businessId plus role, area, permission, module, entitlement, restriction, and resource relationship as applicable. Managers default deny; co-owners remain restrictable; ownership/team and sensitive billing actions are primary-owner-only. Never trust client businessId, role, price, or provider state.

## API

Frontend calls the separate Express API through a shared credentialed Axios client. Endpoint DTOs are feature-specific. Redis caches public/stable reads. SSE supplies role/capability-filtered live events. Legacy order/reservation aliases remain compatibility contracts.

## External services

Stripe controls payment truth; Resend sends durable-outbox email; Cloudinary stores images; Mongo and Redis are required infrastructure; Google supplies onboarding address suggestions; Supabase validates platform admins; Cloudflare generates entitled weekly reports.

## Configuration

Frontend public variables configure API and Stripe publishable key. Backend validates database, Redis, session, provider, origin, email, signing, and feature-flag variables. Never read or print local secret values. Synchronize .env.example with code references.

## Deployment

Frontend has Netlify configuration and conflicting Vercel evidence. Backend and worker are separate Node processes. No checked-in CI/container/IaC defines production. Confirm topology, scheduler ownership, domains, environment injection, migration, backups, and rollback before release work.

## Critical workflows

Preserve QR capability exchange, Redis session login/revocation, restaurant/hotel reservation distinction, server-authoritative pricing, PendingCheckout→Stripe webhook→paid materialization, inventory reserve/consume/release ledgers, housekeeping commands/exceptions, and durable email/notification/recovery.

## Engineering conventions

Extend canonical entities/services. Scope every query by tenant. Use permission constants and existing middleware. Use integer stock and provider minor-unit helpers. Add idempotency/concurrency/recovery for critical writes. Reuse Axios/contexts/UI primitives. Preserve legacy contracts until migration is measured and approved. Use Node 24.

## Known problems

Build ignores TypeScript errors; frontend tests/lint are not fully green; full backend suite does not terminate within ten minutes; Multer has one moderate advisory; rate limits are mostly process-local; CSRF tokens are not implemented; observability and deployment documentation are weak; SEO/E2E/accessibility coverage are incomplete; dual lockfiles and legacy aliases increase drift.

## Critical warnings

Never mix restaurant and hotel state machines. Never authenticate guests as staff/users. Never create paid orders before webhook truth. Never expose raw reservation data by ID. Never compute authoritative money or stock in the client. Never violate Available = On Hand - Reserved. Do not let ingredient sidecar recipes silently replace Simple Stock or affect reservation/Stripe/automatic availability outside an approved phase. Do not deploy API without worker when queued features are enabled.

## Unknowns

Production topology, canonical deployment platform/domains, live flags, secret management, provider account ownership, CI/release/rollback process, monitoring/alerts, data retention, capacity/SLOs, SEO policy, and separate admin frontend require team confirmation.
