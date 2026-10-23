# Chillow Product & Technical Evidence Audit v1.0

**Document Type:** Technical & Domain Product Evidence Audit  
**Target Platform:** Chillow Hospitality Operating Platform  
**Target Audience / Context:** Evidentiary dossier for Malta Enterprise / Malta Startup Residence Programme Application  
**Inspection Scope:** 
- Frontend Repository: `c:\Users\pc\Desktop\Quick-serve-qr-menu` (Next.js 16.0.10, React 19.2.0, Tailwind CSS v4, Zustand 5, Radix UI)
- Backend Repository: `c:\Users\pc\Desktop\Quickserve-be` (Node.js Express 5.2.1, Mongoose 9.1.3, Redis / connect-redis, BullMQ 6.0.5, Stripe 20.4.1, Cloudflare Workers AI)
**Audit Date:** September 2026  
**Auditor:** Lead Autonomous Systems & Codebase Auditor  

---

## 1. Executive Summary

This audit establishes a factual, evidence-based technical baseline for **Chillow** by directly inspecting the active production codebases.

### 1.1 Core Finding
Chillow is **not** a generic e-commerce portal, an off-the-shelf restaurant QR menu, or a superficial CRUD booking wrapper. It is a fullstack, multi-tenant hospitality operating platform architected around:
1. **A Single Physical Resource Model (`ServicePoint`)**: Unifying dining tables, hotel rooms, bar booths, counters, and cabanas under one polymorphic physical resource abstraction rather than maintaining fragmented domain silos.
2. **Business Identity Shell Dominance**: A business’s fundamental shell (`restaurant`, `hotel`, `bar_lounge`) defines its identity, while modular plugins (`foodService`, `lodging`) attach operational capabilities without corrupting identity.
3. **Frictionless Dual-Session Guest Architecture**: Customers never register or authenticate accounts. Instead, physical presence is verified via short-lived ServicePoint GuestSession proofs (`qs_gs_<servicePointId>`), cross-visit continuity is maintained via device tokens (`qs_session_id`), and customer relationship data is automatically compiled into an authoritative CRM (`GuestProfile`).
4. **Authoritative Financial Ledgering**: Client applications never compute authoritative monetary totals. The backend strictly enforces line-item calculations, multi-tier platform fees, and municipal tax rates, executing payments through multi-tenant Stripe Connect destination transfers with platform application fees.
5. **Distributed Reliability & State Coordination**: Mission-critical operations utilize BullMQ background workers, scheduled cron jobs, Redis Pub/Sub event distribution, MongoDB Change Streams / Server-Sent Events (SSE), and transactional inventory reservations with automated hold expirations.

### 1.2 Development Horizon & Maturity Overview
- **Active Engineering Timeline**: Verified Git history shows active development commencing in December 2025 (earliest backend commit `8adbf73` on Dec 16, 2025; earliest frontend commit `2b4c346` on Dec 13, 2025) and running continuously through September 2026.
- **Implemented & Functional**: End-to-end QR code bootstrapping, digital menu catalog, dynamic checkout pricing with platform fee modes, online Stripe Connect card payments, offline cash/POS workflows, kitchen display system (KDS), bar display system, waitstaff terminal with waiter call management, restaurant reservation lifecycle with automated arrival reminders and 1-click arrival confirmation, hotel reservation engine with stay-date calendar and room type filtering, hotel PMS tape chart and check-in credential verification, unified CRM profile aggregation, and Cloudflare AI-driven weekly business analyst reporting.
- **Partially Implemented / In Progress**: Recipe-based canonical inventory allocation (Phase 2–5 migration from simple stock), automated Stripe billing dunning enforcement, and localized customer hub routing.
- **Gaps & Non-Implemented Features**: Multi-lingual UI string localization (platform is currently English-only despite country code/currency abstractions), native mobile applications (web-only PWA architecture), and integrated hardware POS device drivers.

---

## 2. Repository & System Overview

### 2.1 Technology Stack Matrix

| Dimension | Frontend (`Quick-serve-qr-menu`) | Backend (`Quickserve-be`) |
| :--- | :--- | :--- |
| **Runtime / Framework** | Node.js, Next.js 16.0.10 (App Router), React 19.2.0 | Node.js (ESM), Express 5.2.1 |
| **Language** | TypeScript 5, JSX | JavaScript (Node.js ESM `type: "module"`) |
| **Primary Database** | N/A (Consumes REST/SSE APIs) | MongoDB via Mongoose 9.1.3 |
| **Cache & Session Store** | `sessionStorage` (ST token), `localStorage` (device ID) | Redis via `ioredis` 5.10.0, `connect-redis` 9.0.0 |
| **Asynchronous Queues** | N/A | BullMQ 6.0.5 backed by Redis |
| **Real-Time Transport** | Native Server-Sent Events (EventSource), Web Audio API | Express SSE stream (`sseRoute`), Redis Pub/Sub |
| **Payments & Billing** | `@stripe/stripe-js` 9.6.0, `@stripe/react-stripe-js` 6.7.0 | `stripe` 20.4.1 (Connect, Checkout, Webhooks, Billing) |
| **AI / Machine Learning** | N/A (Consumes structured JSON reports) | Cloudflare Workers AI REST API (`@cf/qwen/qwen3-30b-a3b-fp8`) |
| **Email Infrastructure** | N/A | Resend 6.12.2, Nodemailer 8.0.1, `@react-email/components` |
| **Media Storage** | N/A | Cloudinary 2.10.0 |
| **Styling & Components** | Tailwind CSS v4, Radix UI Primitives, Lucide React, Framer Motion | N/A |
| **State Management** | Zustand 5.0.9 (Cart, active sessions) | Database / Redis backed |
| **Testing Harness** | Node native test runner (`node --test`), 15 UI test suites | Node native test runner (`node --test`), 97 backend test suites |

### 2.2 System Component Topology

```
+-----------------------------------------------------------------------------------------+
|                                     CLIENT ACTORS                                       |
|  [Guest / Customer Phone]         [Kitchen / Bar Staff]        [Waitstaff / Manager]    |
|   (QR Scan, Mobile Menu,           (Kitchen & Bar KDS,          (Waiter Terminal, PMS,  |
|    Dine-In/Takeaway, Reserve)       Touch Station Display)       Host Stand, Table Ops) |
+-----------------------------------------------------------------------------------------+
                                             |
                                             v
+-----------------------------------------------------------------------------------------+
|                                  FRONTEND LAYER (Next.js 16)                            |
|  - Public Routes: /q/:biz/:servicePoint (Bootstrap), /s/:servicePoint/*, /b/:country/:biz, /reserve/... |
|  - Staff / Owner Routes: /kitchen, /bar, /waitstaff, /owner/* (Auth Guarded)            |
|  - Client State: Zustand Cart, HttpOnly Auth Cookies, Table Session Proofs              |
+-----------------------------------------------------------------------------------------+
                                             |  REST (Axios) / SSE Streams
                                             v
+-----------------------------------------------------------------------------------------+
|                                  BACKEND API (Express 5)                                |
|  - Security & Routing: Helmet CSP, Rate Limiting, Origin Allowlisting, Session Redis    |
|  - Core Controllers: Orders, Reservations, ServicePoints, Payments, Billing, CRM        |
|  - Middleware: requireAuth, requireRole, requirePermission, capabilityEnforcement       |
+-----------------------------------------------------------------------------------------+
        |                         |                         |                    |
        v                         v                         v                    v
+---------------+         +---------------+         +---------------+    +---------------+
|   DATABASE    |         |  REDIS LAYER  |         | QUEUE WORKERS |    | EXTERNAL SVCS |
| MongoDB 9.1   |         | - Session DB  |         | BullMQ 6.0.5  |    | - Stripe      |
| (ACID Session |         | - Pub/Sub Bus |         | - Email jobs  |    |   Connect     |
|  Transactions |         | - Response    |         | - Expiry scan |    | - Cloudflare  |
|  & Aggregate  |         |   Cache       |         | - AI Analyst  |    |   Workers AI  |
|  Pipelines)   |         | - Rate limits |         | - Post-Payment|    | - Cloudinary  |
+---------------+         +---------------+         +---------------+    +---------------+
```

---

## 3. Architecture

### 3.1 Domain Model & Object Invariants
As specified in [ARCHITECTURAL_CONSTITUTION.md](file:///c:/Users/pc/Desktop/Quick-serve-qr-menu/.ai/approved/ARCHITECTURAL_CONSTITUTION.md) and enforced across models in `src/models/`:
- **`Business`** (`models/Business.js`): Root multi-tenant boundary. Enforces business identity shell (`restaurant`, `bar_lounge`, `hotel`), enabled functional modules (`foodService`, `lodging`), municipal tax rates, platform fee rules, and localization defaults (currency, country, timezone).
- **`ServicePoint`** (`models/ServicePoint.js`): Canonical physical resource model. Represents dining tables, bar booths, hotel rooms, and cabanas. No parallel `Room` or `Table` collections exist. Stay attributes (`pricePerNight`, `beds`, `amenities`) attach as conditional facets.
- **`GuestProfile`** (`models/GuestProfile.js`): Zero-friction unified guest identity scoped by `(businessId, email)`. Aggregates lifetime orders, room stays, tip metrics, favorite items, and consent without guest account registration.
- **`Order`** (`models/order.js`): Stateful request for food/drinks. Maintains kitchen/bar fulfillment stations, prep times, itemized taxes, tips, and inventory deduction linkages.
- **`Reservation`** (`models/Reservation.js`): Time-bounded allocation of a `ServicePoint`. Operates in either `timeslot` mode (dining) or `stay` mode (hotel booking).
- **`Transaction`** (`services/ownerTransactionsReadService.js`): Virtual reporting abstraction unifying completed `Order` and `Reservation` records into a single accounting ledger.

### 3.2 Dual-Session Identity Model
Chillow solves the physical fraud and impersonation problem inherent in QR ordering via a dual identity architecture:
1. **Device Identity (`qs_session_id`)**: Stored in `localStorage`. Tracks historical orders across browser visits without authentication.
2. **ServicePoint Presence Proof (`qs_gs_<servicePointId>`)**: Acquired strictly by scanning physical QR codes pointing to the frontend `/q/:businessId/:servicePointId` bootstrap. The backend validates the QR capability and creates a short-lived GuestSession token stored exclusively in `sessionStorage`. Orders cannot be dispatched without a valid presence token.

---

## 4. Product Capability Inventory

The following table summarizes Chillow’s functional surface:

| Functional Area | Key Capabilities Verified in Code | Primary Implementation Files |
| :--- | :--- | :--- |
| **Business Management** | Multi-step onboarding, country/currency/timezone mapping, business shell selection, module toggling, Google Places integration. | `onboardingController.js`, `businessController.js`, `businessCapabilityService.js` |
| **Menu & Catalog** | Menu categories, items, dietary tags, preparation times, simple stock tracking, linked inventory recipes, Cloudinary image upload. | `menuController.js`, `menuItem.js`, `MenuInventoryRecipe.js` |
| **Restaurant Operations** | Dynamic QR table ordering, dine-in vs takeaway, waiter call requests, real-time KDS (kitchen), bar KDS, waitstaff order management. | `orderController.js`, `kitchenController.js`, `waitstaffOrdersController.js`, `serviceRequestController.js` |
| **Hotel / Accommodation** | Multi-night stay booking, room type availability calculation, guest check-in PIN code verification, PMS calendar tape chart, daily house status. | `reservationController.js`, `hotelCheckInController.js`, `HotelReservationsDashboard.tsx`, `HotelCalendarTapeChart.tsx` |
| **Reservations Engine** | Dining timeslot reservations, guest arrival tokens, automated arrival reminders, not-coming releases, table capacity validation. | `reservationCreationService.js`, `reservationArrivalService.js`, `restaurantReservationAvailabilityService.js` |
| **Payments & Billing** | Stripe Connect split payments, application fee deduction, webhook idempotency, SaaS subscription billing, automated dunning. | `paymentController.js`, `webhookController.js`, `billingController.js`, `billingLifecycleService.js` |
| **Staff & Access Control** | Role-based access control (RBAC), fine-grained permission flags, invite token issuance, Redis session cookies. | `authController.js`, `authMiddleware.js`, `Staff.js`, `permissions.js` |
| **CRM & Guest Analytics** | Automated guest profile compilation, visit counting, customer journey funnel tracking, dormant customer identification. | `guestProfileService.js`, `customerJourneyService.js`, `crmAnalyticsService.js` |
| **AI Business Analyst** | Weekly operational data aggregation, deterministic signal analysis, Cloudflare Workers AI narrative generation with structured schema. | `aiAnalystProcessor.js`, `weeklyAnalystGenerationService.js`, `cloudflareProvider.js` |

---

## 5. Restaurant Platform

### 5.1 QR Ordering & Service-Point Customer Experience
- **QR Bootstrap Flow**: Customer scans a QR code resolving to the frontend `/q/:businessId/:servicePointId` route (`app/q/[businessId]/[servicePointId]/page.tsx`). The page initiates `POST /table-session/start`, stores the presence token `qs_gs_<servicePointId>` in `sessionStorage`, and replaces the bootstrap URL with the canonical menu URL (`/s/:servicePointId/menu?businessId=...`).
- **Cart & Checkout State**: Managed via Zustand store (`store/cart-store.ts`). Supports item notes, ingredient customizations, allergy flags, and tip selections.
- **Client Pricing Display**: Utilizes `calculateCheckoutEstimate()` (`lib/checkout-pricing.ts`) purely as an estimation display. Authoritative pricing is computed exclusively on the backend upon order creation.

### 5.2 Kitchen & Bar Display Systems (KDS)
- **Station Dispatch**: Line items in `models/order.js` contain an operational classification: `type: "food"` routes to `/kitchen` (`app/kitchen/page.tsx`), while `type: "drinks"` routes to `/bar` (`app/bar/page.tsx`).
- **Real-Time Audio & Visual Cues**: When new orders arrive via SSE (`order_created`), Web Audio API triggers acoustic chimes (`/sounds/bell-sound-1.mp3`), and cards highlight in amber/green.
- **Batch Cooking View**: KDS supports toggling between standard ticket cards and aggregated batch view, displaying total quantities of specific items requiring preparation across all open tickets.

### 5.3 Waitstaff Terminal & Call Management
- **Order Lifecycle Controls**: Waiters monitor order progress through `placed` -> `in_progress` -> `ready` -> `completed`. Waiters can record offline cash or POS card payments directly (`waitstaffOrdersController.js`).
- **Service Request Classification**: Customers trigger service calls from mobile menus (`POST /table-session/call-waiter`). Requests are classified into categories (e.g., "Bill Please", "Need Cutlery", "Water", "Assistance") and appear on the waitstaff terminal. Waiters claim calls (`claimedBy`), transition them to `acknowledged`, and mark them `resolved`.

---

## 6. Hotel Platform

### 6.1 Stay Reservation Flow
- **Stay Mode Architecture**: When a business shell is `hotel`, `app/reserve/[countryCode]/[businessSlug]/page.tsx` renders the specialized `HotelReservationFlow` (`components/reservations/hotel/HotelReservationFlow.tsx`).
- **Stay Date Selection**: Uses `HotelStayDatePicker` to select check-in and check-out dates. Availability is dynamically queried via `GET /public/reservations/available-rooms` with query params `checkInDate`, `checkOutDate`, and `guestCount`.
- **Pricing & Fee Snapshots**: Room rates are snapped from `ServicePoint.pricePerNight`. Taxes and platform fees are calculated by the backend and displayed via `HotelPricingBreakdown.tsx`.

### 6.2 Property Management System (PMS) Features
- **Hotel Calendar Tape Chart** (`HotelCalendarTapeChart.tsx`): A multi-room occupancy calendar providing horizontal timeline visualization. Renders reservations using UTC-safe interval geometry `[checkInDate, checkOutDate)`. Checked-in guests are color-coded in green, confirmed in blue, and pending in amber.
- **Today's House Status** (`HotelTodayView.tsx`): Displays categorized operational lists: Today’s Arrivals, In-House Guests, and Today’s Departures.
- **Secure PIN Check-In System** (`hotelCheckInService.js`, `checkInCode.js`): Upon payment, the system generates a 6-digit numeric check-in verification PIN hashed with SHA-256 (`checkInCodeHash`). Guests present the PIN at reception. The front desk enters the PIN into the dashboard dialog (`HotelReservationsDashboard.tsx`), which validates the hash, checks expiration and rate limits (locks after 5 failed attempts), records `checkedInAt`, and updates room status to `checked_in`.

---

## 7. Reservations Architecture

Chillow maintains a bifurcated reservation engine based on business type:

```
                          [RESERVATION SYSTEM]
                                   |
         +-------------------------+-------------------------+
         |                                                   |
 [RESTAURANT TIMESLOT MODE]                          [HOTEL STAY MODE]
 - Table / Area allocation                           - Room ServicePoint allocation
 - Fixed timeslot & duration                         - Multi-night date interval
 - Automated arrival reminder (BullMQ)               - Instant Stripe payment checkout
 - Signed email arrival / not-coming links           - SHA-256 check-in PIN generation
 - Host stand seating transition                     - Reception PIN verification & checkout
```

### 7.1 Detailed Lifecycle Comparison

| Lifecycle Phase | Restaurant Timeslot Mode | Hotel Stay Mode |
| :--- | :--- | :--- |
| **Creation** | `POST /public/reservations` (`restaurantReservationAvailabilityService.js`) | `POST /public/reservations` (`hotelReservationFlow.js`) |
| **Availability Model** | Table seating capacity & interval collision detection. | Room date interval overlap: `[checkIn, checkOut)`. |
| **Payment Binding** | Typically unpaid at booking (pay after dining). | Upfront card payment via Stripe Checkout session. |
| **State Transitions** | `pending` -> `confirmed` -> `arrived` -> `seated` -> `completed` (or `cancelled` / `no_show`). | `pending_approval` -> `accepted_awaiting_payment` -> `confirmed` -> `checked_in` -> `checked_out` (or `expired` / `cancelled`). |
| **Arrival / Check-In** | Signed token email sent 10 min prior; guest taps "I've Arrived" or staff seats them. | Guest receives secure PIN; reception verifies PIN via `POST /owner/reservations/:id/check-in`. |
| **Cancellation & Refund** | Guest clicks signed "Not Coming" link or staff cancels; tables immediately released. | Staff initiates cancellation; backend computes refundable amount and triggers Stripe refund API. |

---

## 8. Hospitality Operations

Specific architectural implementations proving hospitality domain engineering:
1. **Physical Table Collision Prevention**: `ServiceRequest.js` enforces a partial unique index on `activeScopeKey`. If multiple guests at Table 4 press "Call Waiter" simultaneously, requests coalesce into a single row rather than spamming staff.
2. **Order Timing Delay**: `Business.orderingPreferences.orderStartAssistanceDelayMinutes` prevents immediate waiter intervention when guests sit down, allowing them a customizable window to browse menus before automated assistance prompts trigger.
3. **Food vs Drink Station Splitting**: Orders containing both food and wine split transparently across kitchen and bar KDS stations while maintaining unified billing under a single `orderId`.
4. **Allergy Propagation**: Order line items store explicit allergy arrays (`allergies: [String]`) highlighted in high-contrast red tags across KDS displays.

---

## 9. Payments & Transactions

### 9.1 Stripe Connect & Split Payment Architecture
- **Multi-Tenant Account Linking**: Businesses onboard via Stripe Connect Express (`stripeConnectController.js`). Accounts track `stripeChargesEnabled` and `stripePayoutsEnabled`.
- **Payment Processing Model**: Checkout sessions utilize Stripe Destination Charges:
  ```javascript
  // controllers/paymentController.js lines 672-675
  payment_intent_data: {
      application_fee_amount: reservation.commissionAmountCents,
      transfer_data: { destination: business.stripeAccountId },
  }
  ```
- **Fee Modes**: Configured via `Business.platformFeeMode`:
  - `business_absorbs`: Platform commission deducted from business payout.
  - `customer_pays`: Surcharge added to guest checkout total.
  - `split`: Proportional sharing between business and guest.

### 9.2 Webhook Handling & Idempotency
- **Event Deduplication**: Webhooks (`/webhook/stripe`) verify raw signatures before JSON parsing. Events are recorded and claimed atomically in `StripeWebhookEvent` (`claimEvent()`), ensuring identical events sent by Stripe are processed exactly once.
- **Financial Validation**: Webhook fulfillment verifies that `session.amount_total` matches internal database minor-unit totals before transitioning order or reservation entities to `paid`.

---

## 10. Owner & Staff Operations

### 10.1 Role-Based Access Control (RBAC)
Staff accounts (`models/Staff.js`) operate under 5 distinct roles:
1. `owner`: Full operational, billing, and credential authority.
2. `co_owner`: Broad operational access with optional configurable area restrictions (`coOwnerRestrictions`).
3. `manager`: Operational management across modules, gated by granular permission flags (`PERMISSIONS`).
4. `waiter`: Restricted to table service, order placement, order status updates, and service calls.
5. `kitchen` / `bartender`: Restricted strictly to station KDS displays.

### 10.2 Permission Catalog (`constants/permissions.js`)
23 distinct permissions control dashboard UI and API routing, including:
`dashboard.view`, `orders.view`, `orders.manage`, `menu.manage`, `inventory.view`, `inventory.manage`, `servicePoints.manage`, `staff.manage`, `analytics.view`, `crm.view`, and `aiAnalyst.view`.

---

## 11. Analytics & Reporting

### 11.1 Authoritative Metrics
Chillow calculates metrics on-demand using MongoDB Aggregation Pipelines:
- **Shared Financial Metrics**: Gross revenue, net business revenue, collected tips, cash vs online payment splits (`sharedAnalyticsService.js`).
- **Lodging Performance**:
  - **Occupancy Rate**: $\text{Occupancy \%} = \frac{\text{Occupied Room Nights}}{\text{Available Room Nights}} \times 100$ (calculated using exact calendar interval intersection).
  - **ADR (Average Daily Rate)**: $\text{ADR} = \frac{\text{Total Room Revenue}}{\text{Paid Room Nights Sold}}$.
  - **RevPAR (Revenue Per Available Room)**: $\text{RevPAR} = \frac{\text{Total Room Revenue}}{\text{Total Available Rooms} \times \text{Days in Period}}$.
- **Food Service Metrics**: Hourly order volume distribution, average kitchen prep times, table turnaround metrics.
- **CRM Conversion Funnel**: QR scans $\rightarrow$ active cart sessions $\rightarrow$ placed orders $\rightarrow$ completed payments $\rightarrow$ identified CRM profiles.

---

## 12. Multi-Tenant Architecture

- **Tenant Scoping Invariant**: Every primary model (`Business`, `ServicePoint`, `Order`, `Reservation`, `GuestProfile`, `InventoryItem`, `BillingInvoice`, `Notification`) possesses an indexed `businessId: String` attribute.
- **API Isolation**: Dashboard API routes validate `req.session.user.businessId` via `authMiddleware.js`. Cross-tenant data retrieval is structurally rejected at the query level.
- **Legacy Migrations**: Historic references to `restaurantId` have been unified to `businessId` with automated migration scripts (`scripts/migrate-collection-names.js`).

---

## 13. Internationalisation & Multi-Market Capability

### 13.1 Implemented & Functional
- **Multi-Currency Support**: Currency minor-unit representation across EUR, USD, GBP, etc.
- **Country & Timezone Resolution**: Automated mapping from ISO country codes to default currencies and IANA timezones via `lib/country-metadata.ts`. Default business configuration targets Malta (`currency: "EUR"`, `countryCode: "mt"`, `timezone: "Europe/Malta"`).
- **International Routing**: Public URLs incorporate country codes (`/b/[countryCode]/[businessSlug]` and `/reserve/[countryCode]/[businessSlug]`).
- **Configurable Tax Rates**: Municipal tax rates (`taxRate`) apply dynamically per business.

### 13.2 Architecture Ready But Not Fully Implemented
- **Multi-Lingual Localization**: The database model stores `language: { type: String, default: "en" }`, but UI strings across the frontend are hardcoded in English. Translation catalogs (gettext, react-intl) are **not found**.

---

## 14. Reliability & Distributed-System Infrastructure

### 14.1 BullMQ & Distributed Queues
Backed by Redis, Chillow runs dedicated queues and processors in `src/queues/` and `src/workers/processors/`:
- `emailQueue`: Transactional email delivery with retry backoff.
- `reservationQueue`: Runs scheduled scan every 5 minutes (`RESERVATION_REPAIR_SCHEDULER_ID`) to expire abandoned reservations and release service points.
- `inventoryQueue`: Runs hold repair scan every 5 minutes (`INVENTORY_HOLD_REPAIR_SCHEDULER_ID`) to release reserved stock from abandoned checkouts.
- `billingQueue`: Runs hourly billing lifecycle scan (`BILLING_LIFECYCLE_SCHEDULER_ID`) for invoice creation and subscription dunning.
- `postPaymentQueue`: Runs CRM order repair scan every 10 minutes to link unidentified payments to customer profiles.
- `aiAnalystQueue`: Runs weekly Monday 06:00 UTC cron (`AI_ANALYST_WEEKLY_SCHEDULER_ID`) to generate AI analyst reports.

### 14.2 Idempotency & Recovery
- **Durable Email Outbox**: `models/EmailDelivery.js` enforces a compound unique index on `(businessId, jobName, entityId, deliveryVersion)`. Prevents duplicate email dispatches during worker retries.
- **ACID Transactions**: Inventory mutations utilize MongoDB multi-document session transactions (`withCanonicalInventoryTransaction`) preventing race conditions during concurrent stock reservations.

---

## 15. Real-Time Architecture

- **Server-Sent Events (SSE)**: Express route `GET /events` (`sseRoute.js`) maintains persistent HTTP connections.
- **Role & Scope Filtering**: Clients subscribe only to authorized event channels derived from their authenticated session role.
- **Distributed Redis Pub/Sub**: `realtimeBus.js` subscribes to Redis channel `quickserve_realtime_bus`. When an order or call status changes on one API instance, it publishes an envelope forwarded across all server instances, filtering duplicate local echoes via `REALTIME_INSTANCE_ID`.

---

## 16. Authentication, Roles & Permissions

- **Session Security**: Staff and owner dashboard authentication relies strictly on HttpOnly, Redis-backed session cookies (`express-session` with `connect-redis`). No JWTs or sensitive tokens are stored in browser `localStorage`.
- **Permission Enforcement**: Layered middleware verifies:
  1. `requireAuth`: Session validity.
  2. `requireRole`: Broad role category match.
  3. `requirePermission`: Fine-grained permission flag check.

---

## 17. Notification & Communication Architecture

- **Centralized Notification Engine**: `models/Notification.js` records in-app alerts categorized into `reservations`, `inventory`, `feedback`, and `billing`. Expired alerts purge automatically via MongoDB TTL index (`expiresAt`).
- **Transactional Emails**: Built using React Email (`emails/` directory) and delivered via Resend or Nodemailer. Covers:
  - Hotel booking confirmations with check-in PIN credentials.
  - Restaurant booking confirmations and arrival reminder emails.
  - Itemized customer order receipts with tax and platform fee breakdowns.
  - Billing invoices and dunning notices.

---

## 18. Technical Engineering Substance

Concrete technical evidence demonstrating advanced software engineering:
1. **High-Concurrency Inventory Reservation**: Multi-phase stock reservation engine (`inventoryReservationService.js`, 1,778 lines) that places temporary locks on inventory items during customer checkouts, with automated Stripe webhook release triggers and worker cron reconciliations.
2. **Formula-Driven PMS Geometry**: Calendar tape chart geometry that accurately computes date-span overlaps and multi-day bookings across daylight savings and timezone boundaries without date-drift bugs.
3. **Automated CRM Funnel Assembly**: Event-driven background aggregation transforming anonymous QR device sessions into longitudinal customer profiles with lifetime spend metrics and favorite menu selections.

---

## 19. Innovation Candidates

| Capability | Technical Reality | Hospitality Problem Addressed | Distinctive Aspect | Evidence | Confidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Frictionless QR Check-In & Seating** | Cryptographic 1-click arrival tokens in scheduled emails trigger real-time host notifications. | Guests waiting in lobby queues; hosts unaware reservations have arrived. | No customer app or login required; instant table dispatch. | `reservationArrivalService.js`, `reservationArrivalTokenService.js` | **High** |
| **Unified Resource (`ServicePoint`)** | Single collection and abstraction for rooms, tables, and booths. | Fragmentation between F&B POS and Hotel PMS systems. | Seamlessly allows hotels to offer restaurant dining without duplicate software. | `ServicePoint.js`, `Business.js`, `ARCHITECTURAL_CONSTITUTION.md` | **High** |
| **Autonomous AI Business Analyst** | Cloudflare Workers AI evaluates weekly metrics against deterministic rules to generate executive briefing reports. | Independent restaurant/hotel operators lack data analysts to spot menu waste or service bottlenecks. | Combines rigid deterministic metric validation with generative natural language narratives. | `aiAnalystProcessor.js`, `weeklyAnalystGenerationService.js` | **Medium** |

---

## 20. Integrated Product Flows

### Flow A: The Dine-In Food Service Journey
```
Guest Scans Physical QR Code
        |
        v
POST /table-session/start  --> Stores qs_st Session Token in sessionStorage
        |
        v
Browse Menu & Select Items  --> Zustand Cart calculates client estimate
        |
        v
Checkout (Card via Stripe Connect or Offline Cash/POS)
        |
        +---> If Online: Stripe Webhook confirms payment & creates Order
        |
        v
Order Lines Dispatched via SSE:
  - Food items --> Kitchen KDS (Ticket & Batch view)
  - Drink items --> Bar KDS
        |
        v
Line Cooks mark "Ready" --> Waitstaff Terminal alerts server
        |
        v
Server marks "Served" / "Completed"
        |
        v
Background Queue triggers CrmOrderProjectionLedger --> Updates GuestProfile CRM
```

### Flow B: The Hotel Lodging Journey
```
Guest visits /reserve/:country/:slug
        |
        v
Selects Check-In / Check-Out dates  --> System queries available rooms
        |
        v
Stripe Checkout Session created with platform commission split
        |
        v
Stripe Webhook fires checkout.session.completed:
  - Sets paymentStatus: "paid"
  - Generates SHA-256 Check-In PIN Code
  - Queues HotelPaymentConfirmationEmail via BullMQ
        |
        v
Guest arrives at Hotel --> Reception inputs PIN into Hotel Dashboard
        |
        v
System validates PIN --> Marks reservation "checked_in"
        |
        v
PMS Tape Chart updates room status to active in-house guest
```

---

## 21. Product Maturity Matrix

| Capability | Maturity Classification | Notes / Evidence |
| :--- | :--- | :--- |
| **QR Session Bootstrap & Verification** | `IMPLEMENTED` | Dual identity tokens, automated expiration. |
| **Restaurant Ordering (Dine-in & Takeaway)** | `IMPLEMENTED` | Tested end-to-end; KDS integration active. |
| **Kitchen & Bar Display Systems** | `IMPLEMENTED` | Real-time SSE, audio alerts, batch mode. |
| **Waitstaff Call & Assistance System** | `IMPLEMENTED` | Call categorization, claim/resolve cycle. |
| **Restaurant Reservations Lifecycle** | `IMPLEMENTED` | Arrival reminder emails, arrival tokens, seating. |
| **Hotel Stay Booking Engine** | `IMPLEMENTED` | Date interval selection, pricing snapshots. |
| **Hotel PMS Tape Chart & Today View** | `IMPLEMENTED` | Visual calendar chart, arrivals/departures tabs. |
| **Hotel Check-In PIN Verification** | `IMPLEMENTED` | SHA-256 hashed codes, rate limiting, audit logs. |
| **Stripe Connect Split Payments** | `IMPLEMENTED` | Destination charges, application fee deduction. |
| **Unified Guest CRM Profiles** | `IMPLEMENTED` | Automatic profile aggregation, spend tracking. |
| **AI Business Analyst** | `IMPLEMENTED / NEEDS PRODUCTION VERIFICATION` | Code complete; relies on Cloudflare AI credentials. |
| **Recipe-Linked Inventory System** | `PARTIALLY IMPLEMENTED` | Advanced models & tests exist; UI rollout in progress. |
| **Multi-Lingual Localization** | `FOUNDATION ONLY` | DB field exists; UI strings hardcoded in English. |
| **Native iOS / Android Apps** | `NOT FOUND` | Web application architecture only. |
| **Hardware Thermal Printer Drivers** | `NOT FOUND` | Digital receipts and screens only. |

---

## 22. Development Evidence

- **Repository Activity**:
  - Frontend: 15+ automated test suites verifying UI states, routing, and pricing displays.
  - Backend: 97 automated test suites verifying capabilities, billing, inventory, BullMQ, and PMS logic.
- **Git Milestones**:
  - Dec 2025: Initial repository establishment and QR menu scaffolding.
  - Q1 2026: Stripe Connect integration, reservation architecture overhaul.
  - Q2 2026: Multi-tenant PMS tape chart, hotel check-in PIN system, BullMQ queues.
  - Q3 2026 (Recent): Recipe-linked inventory engine, Cloudflare AI Business Analyst v5.

---

## 23. Technical Risks & Gaps

| Issue | Severity | Impact Area | Details |
| :--- | :--- | :--- | :--- |
| **UI Localization Gap** | **Medium** | International Expansion | Frontend strings are in English; requires i18n translation framework before non-English European market launch. |
| **Cloudflare AI API Dependency** | **Medium** | Operations | Weekly analyst report depends on external Cloudflare Workers AI token availability; fallback deterministic reports mitigate this. |
| **Inventory System Coexistence** | **Medium** | Maintainability | Dual-mode code supports both simple stock and canonical recipe inventory while migration finishes. |
| **Duplicate Schema Index Warning** | **Low** | Performance | MongoDB console logs a duplicate index warning on `ownerEmail: 1` in `Business.js`. |

---

## 24. Verified Product Claims

Statements directly verifiable from current code:
1. *Chillow has implemented a zero-friction customer model where guests order and book without account registration.*
2. *Chillow implements a single physical location abstraction (`ServicePoint`) that supports both restaurant tables and hotel rooms.*
3. *Chillow executes multi-tenant payment splits using Stripe Connect destination charges and platform application fees.*
4. *Chillow includes real-time kitchen and bar display systems that split food and beverage tickets to distinct stations via Server-Sent Events.*
5. *Chillow includes a property management tape chart and an SHA-256 hashed 6-digit PIN verification check-in system for hotels.*
6. *Chillow implements an automated guest CRM that aggregates customer visit counts, lifetime spend, and favorite items across all modules.*
7. *Chillow utilizes distributed BullMQ workers backed by Redis for scheduled reservation maintenance, hold releases, and email delivery.*

---

## 25. Claims Requiring Qualification

Claims that must be qualified when writing the application:
1. *"Chillow features an AI Business Analyst"* $\rightarrow$ **Must qualify**: Operates as a scheduled weekly briefing service combining deterministic data aggregation with Cloudflare Workers AI structured generation; it is not an interactive conversational chatbot.
2. *"Chillow supports international hospitality"* $\rightarrow$ **Must qualify**: Platform architecture supports international currencies, timezones, and country codes, but the user interface is currently English-only.
3. *"Chillow features inventory management"* $\rightarrow$ **Must qualify**: Core inventory tracking and reservation hold mechanics are implemented; recipe-based automatic ingredient deduction is in active phased deployment.

---

## 26. Claims We Should Not Make

Claims **unsupported** by the current codebase that should **NOT** be made:
1. *Do NOT claim Chillow has native mobile apps in the Apple App Store or Google Play Store (it is a mobile-responsive web platform).*
2. *Do NOT claim Chillow has direct ESC/POS hardware thermal printer integrations or cash drawer kick triggers.*
3. *Do NOT claim Chillow is multi-lingual or localized into Italian, Maltese, German, or French today.*
4. *Do NOT claim Chillow has two-way OTA synchronization (Channel Manager) with Booking.com or Airbnb.*

---

## 27. Evidence Index

Key verified file references:

- **Single ServicePoint Model**: Backend: `src/models/ServicePoint.js` (`servicePointType`, `pricePerNight`, `beds`). Frontend: `types/service-point.ts`.
- **QR Presence Token Security**: Backend: `src/routes/guest-session-route.js`, `src/controllers/guestSessionController.js`. Frontend: `app/q/[businessId]/[servicePointId]/page.tsx`, `lib/guest-session.ts`.
- **Stripe Connect Split Checkout**: Backend: `src/controllers/paymentController.js` (`createReservationCheckoutSession()`, `createOrderCheckoutSession()`).
- **Webhook Deduplication & Verification**: Backend: `src/controllers/webhookController.js` (`handleStripeWebhook()`, `claimEvent()`).
- **Hotel Check-In PIN Verification**: Backend: `src/services/hotelCheckInService.js` (`verifyHotelCheckInCode()`). Frontend: `components/reservations/HotelReservationsDashboard.tsx`.
- **PMS Calendar Tape Chart**: Frontend: `components/reservations/dashboard/hotel/HotelCalendarTapeChart.tsx`. Backend tests: `test/pmsTapeChart.test.js`.
- **BullMQ Distributed Worker Runtime**: Backend: `src/workers/workerRuntime.js`, `src/workers/registerSchedulers.js`, `src/queues/`.
- **Real-Time Redis Pub/Sub Bus**: Backend: `src/utils/realtimeBus.js`, `src/utils/sseManager.js`. Frontend: `hooks/use-event-source.ts`.
- **AI Business Analyst**: Backend: `src/services/ai/weeklyAnalystGenerationService.js`, `src/services/ai/cloudflareProvider.js`. Frontend: `app/owner/ai-business-analyst/`.
- **Unified CRM Engine**: Backend: `src/models/GuestProfile.js`, `src/services/crmAnalyticsService.js`. Frontend: `app/owner/guests/page.tsx`.

---

## 28. Executive Technical Assessment

### A. What is Chillow today based purely on the code?
Chillow is a functional, highly integrated hospitality operating platform engineered to run restaurants, bars, and boutique hotels from a single software foundation. It combines customer self-service (QR ordering and online booking) with back-of-house operations (KDS displays, waitstaff terminals, PMS calendar tape charts) and administrative management (analytics, CRM, billing, and AI briefings).

### B. How mature is the product?
The core product is mature and feature-complete across its primary operational paths. It possesses deep error handling, transactional safeguards, automated background repair schedulers, and comprehensive automated test suites. It is far past the conceptual or MVP prototype phase and represents production-ready architecture.

### C. What are the strongest technically substantive parts?
1. The polymorphic `ServicePoint` abstraction eliminating domain duplication between lodging and dining.
2. The distributed BullMQ background infrastructure ensuring eventual consistency across payments, inventory holds, and communications.
3. The dual-session QR presence architecture preventing location spoofing.
4. The authoritative backend financial ledger isolating multi-tenant Stripe Connect payouts.

### D. What demonstrates hospitality-specific domain knowledge?
1. The separation of kitchen and bar fulfillment stations with batch prep aggregation.
2. The waiter call collision prevention system using partial unique indexes.
3. The hotel PIN check-in mechanism replacing complex guest accounts.
4. The integration of hotel RevPAR and ADR metrics alongside restaurant food prep durations.

### E. What demonstrates potential for international scalability?
1. Comprehensive currency minor-unit modeling.
2. Dynamic timezone and operational day boundary handling using Luxon.
3. Automated ISO country metadata resolution.
4. Country-scoped URL routing structures.

### F. What could support an innovation argument?
The unification of food service operations and hotel lodging onto one shared real-time event bus and single resource model, coupled with zero-friction guest profile generation and automated AI-driven weekly operational analysis.

### G. What still needs development?
Frontend multi-language internationalization (i18n string catalog), completion of the recipe-based inventory migration, and formal OTA channel management integrations.

### H. What should an external evaluator understand about the amount of product already built?
An external evaluator should recognize that Chillow represents over nine months of intensive, sophisticated software engineering. It is not an unstyled prototype or template, but a complex, resilient, distributed hospitality operating system comprising tens of thousands of lines of tested, production-grade code.

### I. What claims would be misleading based on the current implementation?
Claiming native mobile app availability, external OTA two-way synchronization, physical hardware printing support, or full multi-language UI translation would be unsupported by the current code and should be avoided.
