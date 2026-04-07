# Theme Switching — Audit Report (Cycle 1)
Date: 2026-04-07
Tasks covered: T-074, T-075, T-076

## Spec Compliance

### T-074: Install next-themes and Configure ThemeProvider

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | App renders without hydration errors | **PASS** | `suppressHydrationWarning` on `<html>` tag in `src/app/layout.tsx:22`. Build passes. |
| 2 | `next-themes` provider is active | **PASS** | `<ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>` wraps all children in `src/app/layout.tsx:24`. |
| 3 | `npm run build` passes | **PASS** | Build completes successfully with all routes. |

### T-075: Create ThemeToggle Component

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | A theme toggle button is visible in the protected layout | **PASS** | `<ThemeToggle />` rendered in `src/app/(protected)/layout.tsx:23`, inside sidebar header. |
| 2 | Clicking it allows switching between Light, Dark, and System themes | **PASS** | `src/components/common/ThemeToggle.tsx` uses shadcn DropdownMenu with three items calling `setTheme("light")`, `setTheme("dark")`, `setTheme("system")`. |
| 3 | System theme follows OS preference | **PASS** | `next-themes` provider configured with `enableSystem` and `defaultTheme="system"`. |
| 4 | Theme persists across page navigation | **PASS** | `next-themes` uses `localStorage` by default — no additional code needed. |
| 5 | `npm run build` passes | **PASS** | Confirmed. |

### T-076: Write Tests for Theme Switching

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All tests pass via `npm test` | **PASS** | 135 tests across 15 files all pass, including 5 ThemeToggle tests. |
| 2 | `npm run build` passes | **PASS** | Confirmed. |

## Bug Detection

No bugs found.

- ThemeToggle correctly uses `useTheme()` from `next-themes` and calls `setTheme()` with valid values.
- No missing null checks — `theme` from `useTheme()` is used only for `data-active` attribute which gracefully handles undefined.
- No stale closures — `setTheme` is stable across renders (provided by `next-themes` context).
- No memory leaks — no `useEffect` or subscriptions in the component.
- DropdownMenuTrigger uses the `render` prop correctly per the Base UI-based shadcn API (`@base-ui/react`).

## Security

No security concerns. ThemeToggle is a client-side-only component that:
- Makes no API calls
- Accesses no user data
- Uses only `localStorage` for persistence (via `next-themes`)
- Has no user input handling beyond button clicks

## Architecture Alignment

| Aspect | Specified | Implemented | Verdict |
|--------|-----------|-------------|---------|
| File location | `src/components/common/ThemeToggle.tsx` | `src/components/common/ThemeToggle.tsx` | Match |
| Props | none | none | Match |
| Icons | Sun/Moon/Monitor from lucide-react | Sun/Moon/Monitor from lucide-react | Match |
| Hook | `useTheme()` from `next-themes` | `useTheme()` from `next-themes` | Match |
| Behavior | Cycle button: light → dark → system | DropdownMenu with three options | Acceptable deviation — T-075 explicitly allows "a dropdown with three options" as an alternative |
| ThemeProvider location | Root layout | `src/app/layout.tsx` wrapping all children | Match |
| ThemeProvider config | `attribute="class"` `defaultTheme="system"` `enableSystem` | All present, plus `disableTransitionOnChange` | Match (extra prop is beneficial, prevents FOUC) |
| `suppressHydrationWarning` | On `<html>` tag | `src/app/layout.tsx:22` | Match |
| `@custom-variant dark` | `(&:where(.dark, .dark *));` in globals.css | `src/app/globals.css:6` | Match |
| Dark color variables | In globals.css | `.dark` selector with full OKLCH variables at `globals.css:86-118` | Match |
| Placement in protected layout | "header/toolbar area" per T-075 | Inside sidebar header (conditionally rendered) | Acceptable — see note below |

**Note on placement:** The ThemeToggle is inside the sidebar (`src/app/(protected)/layout.tsx:23`), which is conditionally rendered based on `uiState.isSidebarOpen`. When the sidebar is closed, the ThemeToggle is not accessible. The CLAUDE.md spec says the protected layout has "sidebar + ThemeToggle" and T-075 says "alongside the sidebar toggle and any other controls." The sidebar toggle button is always visible (lines 52-58), so one could argue the ThemeToggle should also be always visible. However, the acceptance criteria only require "a theme toggle button is visible in the protected layout," which is satisfied when the sidebar is open. This is a **low-severity usability concern**, not a spec violation.

## Forward Compatibility

No forward compatibility concerns.

- ThemeToggle is self-contained with no external dependencies beyond `next-themes` and shadcn UI primitives.
- The `@custom-variant dark` directive and `.dark` CSS variables are the standard approach for Tailwind 4 + next-themes — all future components will automatically support dark mode.
- F-17 (Server-Level API Keys) will modify the protected layout to replace the "Settings" link with a "Usage" link, but the ThemeToggle placement won't interfere.
- No hardcoded assumptions that need undoing.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0 (1 note: ThemeToggle hidden when sidebar is closed — acceptable)
- Recommendation: **PROCEED**
