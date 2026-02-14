# KnockBase - Door-to-Door Sales App

## Overview
KnockBase is a mobile-first door-to-door sales tracking application built with Expo/React Native. It helps sales reps manage leads, track visits, and optimize their daily canvassing routes.

## Recent Changes
- 2026-02-14: Initial build with lead management, map view, route planning, dashboard

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **State**: AsyncStorage for local persistence, React Context for shared state
- **Styling**: StyleSheet with Inter font family, custom color theme
- **Maps**: react-native-maps v1.18.0 (Expo Go compatible)

### Key Files
- `lib/types.ts` - Lead, DailyStats types and status config
- `lib/storage.ts` - AsyncStorage CRUD operations
- `lib/leads-context.tsx` - React Context for lead state management
- `lib/useTheme.ts` - Theme hook for dark/light mode
- `app/(tabs)/index.tsx` - Map view with pins
- `app/(tabs)/leads.tsx` - Leads list with search/filter/sort
- `app/(tabs)/route.tsx` - Route optimization view
- `app/(tabs)/dashboard.tsx` - Stats dashboard
- `app/lead-detail.tsx` - Lead detail screen
- `app/lead-form.tsx` - Create/edit lead form
- `components/` - Reusable UI components

### Lead Statuses
Untouched, Not Home, Not Interested, Callback, Appointment, Sold, Follow Up

## User Preferences
- Professional sales tool aesthetic
- Dark/light mode support
- Emerald green primary accent (#10B981)
