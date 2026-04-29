# UNINMS Mobile — Claude Code Guidelines

## Project Overview
React Native / Expo SDK 54 app for the UNINMS academic platform.
Roles: **student**, **lecturer**, **researcher** — each has a tailored dashboard and tab layout.

**Stack:** Expo Router v6 · React Query v5 · Zustand · TypeScript · Inline StyleSheet (no NativeWind)

---

## UI/UX Design Intelligence — UI/UX Pro Max Skill

A design intelligence database is available at `./ui-ux-pro-max-skill/`.
**Before making any UI decision** (style, color, layout, component design, typography, UX pattern),
query it first to get data-backed recommendations.

### How to query

```bash
# From the uninms-mobile directory:
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain> -n 3

# With React Native stack-specific guidelines:
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "<query>" --stack react-native -n 3
```

### Domains
| Domain | Use for |
|--------|---------|
| `product` | App type recommendations (educational, SaaS, dashboard) |
| `style` | UI style selection (glassmorphism, claymorphism, flat, etc.) |
| `color` | Color palette selection by product type |
| `typography` | Font pairing and text scale recommendations |
| `ux` | Interaction patterns, accessibility, navigation, forms |
| `chart` | Data visualisation types |
| `landing` | Page structure and conversion patterns |

### When to query (mandatory)
- Designing or redesigning any screen or component
- Choosing or changing color scheme / theme
- Deciding on spacing, padding, card style, shadow depth
- Building forms, modals, bottom sheets
- Adding animations or transitions
- Improving accessibility or touch targets
- Picking icon style or typography scale

### Quick examples
```bash
# What style fits an academic platform?
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "university academic platform" --domain product -n 3

# Best color palette for education app
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "education university" --domain color -n 3

# Mobile tab navigation UX rules
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "bottom tab navigation mobile" --domain ux -n 3

# Card component style for a dashboard
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "dashboard stat cards KPI" --domain style -n 3

# Form and input UX
python3 ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "form input validation modal" --domain ux -n 3
```

---

## Project Conventions

### File structure
```
app/
  _layout.tsx          — root layout: GestureHandlerRootView > QueryClientProvider > ThemeProvider > ToastProvider
  auth/login.tsx       — login screen
  (tabs)/
    _layout.tsx        — role-based tab bar (student/lecturer/researcher)
    home.tsx           — role-specific dashboards (StudentHome, LecturerHome, ResearcherHome)
    courses.tsx        — lecturer/student course management
    research.tsx       — researcher/lecturer research module
    repository/        — document repository (index + [id])
    forums/            — discussion forums (index + [id])
    notifications.tsx  — notifications with swipe-to-dismiss
    profile.tsx        — profile edit, photo upload, password change
    logout.tsx         — dummy screen (logout handled in tab bar)
src/
  lib/api.ts           — Axios client + all API endpoint groups
  lib/queryClient.ts   — React Query config (staleTime 2min, gcTime 10min)
  stores/authStore.ts  — Zustand auth store with mapUser()
  theme/               — ThemeContext, colors (4 presets: blue/green/purple/orange)
  components/
    Skeleton.tsx       — shimmer skeleton components (SkeletonDocCard, SkeletonThreadCard, etc.)
    Toast.tsx          — toast notification system (useToast hook + ToastProvider)
  utils/
    timeAgo.ts         — relative timestamp formatter
```

### Key patterns
- **Response unwrapping**: backend returns `{ success, data: {...} }` — always unwrap with `res?.data ?? res`
- **Role check**: `const role = user?.role ?? 'student'` — roles are `student`, `lecturer`, `researcher`
- **Theme access**: `const { colors } = useTheme()` — never hardcode hex values, always use `colors.*`
- **Toast over Alert**: use `useToast()` for success/error feedback, reserve `Alert.alert` for destructive confirmations only
- **Skeletons over spinners**: use `Skeleton*` components from `src/components/Skeleton.tsx` during loading
- **Timestamps**: use `timeAgo()` from `src/utils/timeAgo.ts` for all date display
- **Touch targets**: minimum 44×44pt per Apple HIG (enforced by UX Pro Max rules)

### API base URL
Set in `.env`:
```
EXPO_PUBLIC_API_URL=http://<wifi-ip>:3000/api/v1
```

---

## Design Baseline (from UI/UX Pro Max)
For an **educational/university platform** the recommended profile is:
- **Style**: Claymorphism + Micro-interactions (primary), Flat Design (secondary)
- **Colors**: Structured palette with clear hierarchy — primary brand + neutral greys + semantic (success/error/warning)
- **Dashboard**: Executive-style KPI cards (max 4–6), at-a-glance stats, trend indicators
- **UX**: Bottom nav ≤ 5 items, min 44×44pt touch targets, loading feedback on all async actions, visible focus states
- **Typography**: Base 16px body, 1.5 line-height, semantic size scale (not raw px)
- **Animation**: 150–300ms duration, spring for modals/sheets, no decorative-only animations
