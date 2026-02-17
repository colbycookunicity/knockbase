# KnockBase - Door-to-Door Sales App

## Overview
KnockBase is a mobile-first door-to-door sales tracking application built with Expo/React Native with a server-backed PostgreSQL database. It helps sales reps manage leads, track visits, and optimize their daily canvassing routes. Features multi-user authentication with role-based access control.

## Recent Changes
- 2026-02-17: Removed password-based login entirely, OTP-only authentication via Hydra
- 2026-02-17: Users created without passwords, login only via email OTP verification
- 2026-02-17: Admin panel no longer has password field for user creation/editing
- 2026-02-17: Fixed SPA catch-all to serve from dist/ (Expo web export output)
- 2026-02-14: Added 3-tier role hierarchy (admin > manager > sales_rep) with managerId FK
- 2026-02-14: Managers can create/manage their own sales reps, see team leads
- 2026-02-14: Admin panel updated with role selector, manager assignment for reps, grouped display
- 2026-02-14: Added multi-user auth system (login/logout, session-based)
- 2026-02-14: Added admin panel for user management (create/edit/delete users, toggle active, change roles)
- 2026-02-14: Migrated data storage from AsyncStorage to PostgreSQL (leads, territories, users)
- 2026-02-14: Added role-based access: admin sees all leads, sales_rep sees only own leads
- 2026-02-14: Added territory mapping (draw polygon boundaries, assign reps, color-coded overlays)
- 2026-02-14: Added map picker for selecting house locations by tapping the map when creating leads
- 2026-02-14: Added lead-to-lead navigation (prev/next arrows) on the map preview card
- 2026-02-14: Added territory toggle button on map to show/hide territory overlays
- 2026-02-14: Initial build with lead management, map view, route planning, dashboard

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **Backend**: Express.js on port 5000 with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Auth**: OTP-only via Hydra API, session-based with connect-pg-simple store (no passwords)
- **State**: React Context for shared state, React Query for server state
- **Styling**: StyleSheet with Inter font family, custom color theme
- **Maps**: react-native-maps v1.18.0 (Expo Go compatible)

### Default Owner Account
- Email: colby.cook@unicity.com (login via OTP, created on first server start)

### Database Schema (shared/schema.ts)
- `users` - id (uuid), username, fullName, role (owner/admin/rep), managerId (nullable FK to users), email (unique, used for OTP login), phone, isActive
- `leads` - id (uuid), userId (FK to users), firstName, lastName, phone, email, address, lat/lng, status, notes, tags, dates
- `territories` - id (uuid), name, color, points (jsonb polygon), assignedRep

### API Routes (server/routes.ts)
- **Auth**: POST /api/auth/login, POST /api/auth/logout, GET /api/auth/me
- **Users** (admin or manager): GET/POST /api/users, PUT/DELETE /api/users/:id
- **Leads** (auth required): GET/POST /api/leads, PUT/DELETE /api/leads/:id
- **Territories** (auth required): GET/POST /api/territories, PUT/DELETE /api/territories/:id

### Key Files
- `shared/schema.ts` - Drizzle ORM schema for users, leads, territories
- `server/routes.ts` - Express API routes with auth middleware
- `server/storage.ts` - Database CRUD operations
- `server/db.ts` - Drizzle/Neon database connection
- `lib/auth-context.tsx` - React Context for auth state (login/logout/user)
- `lib/storage.ts` - API client functions for leads and territories
- `lib/leads-context.tsx` - React Context for lead state management
- `lib/territories-context.tsx` - React Context for territory state management
- `lib/query-client.ts` - React Query client with API helpers
- `lib/useTheme.ts` - Theme hook for dark/light mode
- `app/_layout.tsx` - Root layout with auth gate (login vs main app)
- `app/login.tsx` - Login screen
- `app/admin.tsx` - Admin user management panel
- `app/(tabs)/index.tsx` - Map view with pins, territory overlays, lead navigation
- `app/(tabs)/leads.tsx` - Leads list with search/filter/sort
- `app/(tabs)/route.tsx` - Route optimization view
- `app/(tabs)/dashboard.tsx` - Stats dashboard with logout and admin access
- `app/lead-detail.tsx` - Lead detail screen
- `app/lead-form.tsx` - Create/edit lead form (with "Pick on Map" button)
- `app/map-picker.tsx` - Full-screen map to tap and select a house location
- `app/territory-editor.tsx` - Draw territory polygons, name them, assign reps
- `components/NativeMap.tsx` / `.web.tsx` - Platform-specific map with territory overlays
- `components/MapPickerNative.tsx` / `.web.tsx` - Platform-specific map picker
- `components/TerritoryEditorNative.tsx` / `.web.tsx` - Platform-specific territory editor
- `components/` - Reusable UI components

### Platform Pattern
- `react-native-maps` is native-only. All map components have `.web.tsx` variants that render fallbacks.
- Route files (e.g. `map-picker.tsx`) check `Platform.OS === "web"` and delegate to platform-specific component imports.

### Lead Statuses
Untouched, Not Home, Not Interested, Callback, Appointment, Sold, Follow Up

### Roles (3-tier hierarchy)
- **admin**: Can see all leads, manage all users (any role), full access
- **manager**: Can see own + team leads, create/manage sales_reps under their team, has managerId=null
- **sales_rep**: Can only see own leads, no user management access, has managerId linking to their manager

## User Preferences
- Professional sales tool aesthetic
- Dark/light mode support
- Deep navy primary accent (#0f192f)
