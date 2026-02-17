# CLAUDE.md - KnockBase

## Project Overview

KnockBase is a mobile-first door-to-door sales tracking application. Sales reps use it to manage leads, track visits on an interactive map, draw territory boundaries, plan routes, view performance dashboards, and browse/sell Shopify products in the field.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React Native 0.81.5 + Expo ~54.0.27 |
| Routing | Expo Router v6 (file-based) |
| Backend | Express v5 on port 5000 |
| Database | PostgreSQL with Drizzle ORM v0.39 |
| Auth | Session-based (bcryptjs + express-session + connect-pg-simple, 30-day expiry) |
| State | React Context (auth, leads, territories) + React Query v5 (server state) |
| Maps | react-native-maps v1.18 (native only, web gets fallback components) |
| Shopify | Storefront API v2024-10 (GraphQL) |
| Language | TypeScript ~5.9 |
| Styling | React Native StyleSheet, Inter font, emerald green (#10B981) accent |

## Quick Start

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Start backend (dev)
npm run server:dev

# Start Expo frontend (dev, separate terminal)
npm run expo:dev

# Lint
npm run lint
npm run lint:fix
```

**Default admin credentials:** `admin` / `admin123` (created on first server start)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SHOPIFY_STORE_DOMAIN` | For shop features | e.g. `your-store.myshopify.com` |
| `SHOPIFY_STOREFRONT_ACCESS_TOKEN` | For shop features | Shopify Storefront API token |
| `SESSION_SECRET` | Recommended | Session encryption key (defaults to `knockbase-dev-secret`) |
| `PORT` | No | Server port (defaults to 5000) |
| `NODE_ENV` | No | `development` or `production` |
| `REPLIT_DEV_DOMAIN` | Replit only | Dev domain for proxy |
| `REPLIT_DOMAINS` | Replit only | Comma-separated domains for CORS |
| `EXPO_PUBLIC_DOMAIN` | Replit only | Public domain for Expo |

## Project Structure

```
knockbase/
├── app/                        # Expo Router screens (file-based routing)
│   ├── _layout.tsx             # Root layout with auth gate + providers
│   ├── login.tsx               # Login screen
│   ├── admin.tsx               # Admin/manager user management
│   ├── lead-detail.tsx         # Lead details view
│   ├── lead-form.tsx           # Create/edit lead form
│   ├── map-picker.tsx          # Full-screen location picker
│   ├── territory-editor.tsx    # Territory polygon drawing
│   ├── product-detail.tsx      # Shopify product detail
│   └── (tabs)/                 # Tab navigation
│       ├── _layout.tsx         # Tab bar config
│       ├── index.tsx           # Map view (primary tab)
│       ├── leads.tsx           # Leads list
│       ├── route.tsx           # Route planner
│       ├── dashboard.tsx       # Stats dashboard
│       └── shop.tsx            # Shopify product catalog
├── components/                 # Reusable UI components
│   ├── NativeMap.tsx/.web.tsx  # Platform-specific map
│   ├── MapPickerNative.tsx/.web.tsx
│   ├── TerritoryEditorNative.tsx/.web.tsx
│   ├── DispositionSheet.tsx    # Quick lead status update
│   ├── LeadCard.tsx            # Lead list item
│   ├── SwipeableRow.tsx        # Swipe actions
│   ├── StatusBadge.tsx         # Status indicator
│   ├── StatCard.tsx            # Dashboard metric card
│   ├── MapPinMarker.tsx        # Custom map pin
│   └── ErrorBoundary.tsx       # Error boundary
├── lib/                        # Client utilities & state
│   ├── auth-context.tsx        # Auth provider (login/logout/user/roles)
│   ├── leads-context.tsx       # Leads state management
│   ├── territories-context.tsx # Territories state management
│   ├── query-client.ts         # React Query setup + API request helper
│   ├── storage.ts              # API client functions (getLeads, saveLead, etc.)
│   ├── types.ts                # TS types (Lead statuses, coordinates, DailyStats)
│   └── useTheme.ts             # Dark/light theme hook
├── server/                     # Express backend
│   ├── index.ts                # Express app setup, CORS, static serving
│   ├── routes.ts               # All API endpoint handlers
│   ├── db.ts                   # Drizzle ORM + DB connection
│   ├── storage.ts              # Database CRUD operations (role-filtered)
│   ├── shopify.ts              # Shopify GraphQL API client
│   └── templates/
│       └── landing-page.html   # Web landing page template
├── shared/                     # Shared between client & server
│   └── schema.ts               # Drizzle ORM schema + Zod validators
├── constants/
│   └── colors.ts               # Color palette (light/dark themes, status colors)
├── scripts/
│   └── build.js                # Expo static build script
├── migrations/                 # Drizzle schema migrations
├── patches/                    # patch-package patches
├── docs/
│   └── README.md               # Comprehensive feature documentation
└── assets/images/              # App icons, splash screens
```

## Database Schema (shared/schema.ts)

**users** - `id` (uuid PK), `username` (unique), `password` (bcrypt), `fullName`, `role` (admin/manager/sales_rep), `managerId` (FK to users, nullable), `email`, `phone`, `isActive` (string "true"/"false"), `createdAt`, `updatedAt`

**leads** - `id` (uuid PK), `userId` (FK to users), `firstName`, `lastName`, `phone`, `email`, `address`, `latitude`/`longitude` (double), `status` (enum string), `notes`, `tags` (jsonb array), `followUpDate`, `appointmentDate`, `knockedAt`, `createdAt`, `updatedAt`

**territories** - `id` (uuid PK), `name`, `color` (hex), `points` (jsonb array of {latitude, longitude}), `assignedRep`, `createdAt`, `updatedAt`

## API Endpoints (server/routes.ts)

### Auth
- `POST /api/auth/login` - Login (username/password)
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Current user

### Users (admin/manager only)
- `GET /api/users` - List visible users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

### Leads (auth required)
- `GET /api/leads` - Get leads (role-filtered)
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead

### Territories (auth required)
- `GET /api/territories` - List territories
- `POST /api/territories` - Create territory
- `PUT /api/territories/:id` - Update territory
- `DELETE /api/territories/:id` - Delete territory

### Shopify
- `GET /api/shopify/products` - List products (pagination via `first`, `after` query params)
- `GET /api/shopify/products/:id` - Get product by ID
- `GET /api/shopify/search?q=term` - Search products
- `POST /api/shopify/checkout` - Create checkout (body: `{ lineItems: [{variantId, quantity}] }`)
- `GET /api/shopify/shop` - Get shop info

## User Roles (3-Tier Hierarchy)

| Role | Leads Access | User Management | Admin Panel |
|------|-------------|-----------------|-------------|
| **admin** | All leads | Create/edit/delete any user | Full access |
| **manager** | Own + team leads | Create/manage sales_reps on team | Limited access |
| **sales_rep** | Own leads only | None | No access |

## Lead Statuses

| Status | Key | Color | Icon |
|--------|-----|-------|------|
| Untouched | `untouched` | #94A3B8 (gray) | map-pin |
| Not Home | `not_home` | #F59E0B (amber) | home |
| Not Interested | `not_interested` | #EF4444 (red) | x-circle |
| Callback | `callback` | #3B82F6 (blue) | phone-call |
| Appointment | `appointment` | #8B5CF6 (purple) | calendar |
| Sold | `sold` | #10B981 (emerald) | check-circle |
| Follow Up | `follow_up` | #06B6D4 (cyan) | refresh-cw |

## Platform Pattern

`react-native-maps` is native-only. All map-dependent components have `.web.tsx` variants that render web-compatible fallbacks. Route files check `Platform.OS === "web"` to delegate to the correct component.

- `NativeMap.tsx` (native) / `NativeMap.web.tsx` (web fallback)
- `MapPickerNative.tsx` (native) / `MapPickerNative.web.tsx` (web fallback)
- `TerritoryEditorNative.tsx` (native) / `TerritoryEditorNative.web.tsx` (web fallback)

## Shopify Integration (server/shopify.ts)

Uses Shopify Storefront API v2024-10 via GraphQL. Requires `SHOPIFY_STORE_DOMAIN` and `SHOPIFY_STOREFRONT_ACCESS_TOKEN` environment variables.

### Pilot Store (Unicity Door-to-Door)

- **Store:** `unicity-international-2.myshopify.com` (Shopify Plus)
- **Sales channels:** Headless/Storefront API (active), POS (active), Online Store (hidden/password-protected)
- **Pilot region:** Mississippi, USA (1 manager + 10 distributors)
- **Pilot products (4):** Balance Natural Orange, Balance Mixed Berry, Unimate Lemon Ginger, Diamond Bottle 500ml
- **Pricing strategy:** `price` field = wholesale amount, `compareAtPrice` field = retail amount
- **Payments:** Shopify Payments (charge, capture, refund confirmed working)
- **Customer sync:** Shopify customer email -> Unicity customer_ID written back to Shopify metafield (`custom.customer_id`)
- **Order flow:** Shopify order -> daily sync to Unicity Portal (manual Phase 1, automated webhook Phase 2)

### Architecture

**Three Shopify sales channels:**
1. **Online Store** - Hidden (password protected), not used for pilot
2. **Headless/Storefront API** - KnockBase app reads products and creates checkouts via this channel
3. **POS** - Distributors use Shopify POS app with tap-to-pay card readers for in-person sales

**Data flow:**
- KnockBase -> Storefront API -> products/checkout
- Shopify -> Unicity: Order data (SKU, quantity, price, customer email, POS staff) for commission/PV/BV
- Unicity -> Shopify: customer_ID written to Shopify customer metafield for relationship mapping

### Server Functions (server/shopify.ts)
- `getProducts(first, after)` - Paginated product listing with compareAtPrice
- `getProduct(id)` - Single product by ID with full variant/pricing data
- `searchProducts(query, first)` - Full-text product search
- `createCheckout(lineItems)` - Create cart and return Shopify checkout URL
- `getShopInfo()` - Get shop name and description

### Frontend Flow
Shop tab (`app/(tabs)/shop.tsx`) lists products with wholesale/retail pricing -> tap opens product detail (`app/product-detail.tsx`) with image gallery, variant selection, quantity picker -> "Buy Now" creates a Shopify cart and opens the hosted checkout URL.

### Pricing Display
- **Product cards:** Show wholesale price prominently (emerald), retail price as strikethrough
- **Product detail:** Wholesale price labeled "Wholesale", compareAtPrice labeled "Retail" with strikethrough

## Build & Deploy

```bash
# Production build
npm run expo:static:build    # Static Expo web build
npm run server:build         # Bundle server with esbuild -> server_dist/

# Production run
npm run server:prod          # Serves API + static assets

# Database
npm run db:push              # Push Drizzle schema to PostgreSQL
```

Deployed on Replit targeting Google Cloud Run. Server listens on `0.0.0.0:5000`.

## Key Conventions

- **TypeScript** throughout (strict mode enabled)
- **Path aliases:** `@/*` -> root, `@shared/*` -> `shared/`
- **Validation:** Zod schemas derived from Drizzle schema via `drizzle-zod`
- **API client:** All API calls go through `apiRequest()` helper in `lib/query-client.ts`
- **State pattern:** React Context for local state, React Query for server-synced state
- **Styling:** No CSS framework - uses React Native `StyleSheet.create()` with theme colors from `constants/colors.ts`
- **Font:** Inter (loaded via `@expo-google-fonts/inter`)
- **Dark/light mode:** Supported via `useTheme()` hook
- **ESLint:** Expo preset with flat config
- **Babel:** Expo preset + experimental React Compiler plugin
- **Patches:** `patch-package` runs on `postinstall`
