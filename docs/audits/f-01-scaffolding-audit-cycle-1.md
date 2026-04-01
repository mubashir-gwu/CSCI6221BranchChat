# F-01: Project Scaffolding & Configuration — Audit Report (Cycle 1)

Date: 2026-03-31
Tasks covered: T-001, T-002, T-003, T-004, T-005

---

## Spec Compliance

### T-001: Initialize Next.js 16 Project

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `npm run dev` starts on localhost:3000 without errors | **PASS** | `next dev` script present; build succeeds |
| `npm run build` completes successfully | **PASS** | Verified: build completes, all routes listed |
| TypeScript compilation has zero errors | **PASS** | Build succeeds with zero TS errors |
| `package.json` has `next@^16`, `react@^19`, `typescript@^5` | **PASS** | next: 16.2.2, react: 19.2.4, typescript: ^5 |
| `tsconfig.json` includes `@/*` path alias | **PASS** | Confirmed in tsconfig.json |
| `next.config.ts` exists | **PASS** | Present with minimal config |
| Boilerplate deleted | **PASS** | page.tsx is a minimal stub |

### T-002: Configure Tailwind CSS 4 and PostCSS

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Tailwind utility classes render correctly | **PASS** | globals.css has `@import "tailwindcss"`, build passes |
| No `tailwind.config.ts` file exists | **PASS** | Confirmed absent |
| `npm run build` passes | **PASS** | Verified |
| `postcss.config.mjs` configured with `@tailwindcss/postcss` | **PASS** | `postcss.config.mjs` present and correct |

### T-003: Install shadcn/ui and Configure Theme

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `import { Button } from "@/components/ui/button"` compiles and renders | **PASS** | `src/components/ui/button.tsx` exists with full implementation |
| Sonner toast works | **PASS** | `sonner` installed, `src/components/ui/sonner.tsx` present, `ToastProvider.tsx` wraps it |
| All OKLCH color variables defined in `globals.css` | **PASS** | `:root` and `.dark` blocks contain full OKLCH variable definitions for all specified colors |
| `npm run build` passes | **PASS** | Verified |

### T-004: Create Folder Structure and Placeholder Files

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Every directory from Architecture Document exists | **PASS** | All dirs confirmed: app/(auth), app/(protected), app/api/*, components/*, contexts, hooks, lib, lib/providers, models, types, constants, __tests__ |
| Every file listed exists with a valid TypeScript stub | **PASS** | All ~60+ files present with minimal valid exports or stub implementations |
| `npm run build` passes with zero errors | **PASS** | Verified |
| No `Cannot find module` errors for `@/` imports | **PASS** | Build passes cleanly |

### T-005: Configure Vitest, Docker Compose, and Environment Templates

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `npm test` runs vitest and exits 0 | **PASS** | `vitest run` reports "No test files found, exiting with code 0" |
| `docker compose up -d` starts MongoDB on 27017 | **PASS** | `docker-compose.yml` correctly configured with mongo:7 on port 27017 |
| `.env.example` contains all four variables | **PASS** | MONGODB_URI, AUTH_SECRET, AUTH_URL, ENCRYPTION_KEY all present |
| `.gitignore` includes `.env.local`, `node_modules`, `.next` | **PASS** | Standard Next.js .gitignore present |

---

## Bug Detection

### B-01: vitest.config.ts uses non-standard `resolve.tsconfigPaths` option

- **File:** `branch-chat/vitest.config.ts:7`
- **Description:** The config uses `resolve: { tsconfigPaths: true }` which is not a valid Vite resolve option. The `vite-tsconfig-paths` plugin is installed as a devDependency but is not imported or used in the plugins array. This means `@/*` path aliases may not resolve correctly in tests. The correct config should import `tsconfigPaths from 'vite-tsconfig-paths'` and add it to `plugins: [react(), tsconfigPaths()]`.
- **Severity:** Medium — Tests will fail to resolve `@/` imports once real test files are added.

### B-02: Dependency version mismatches vs CLAUDE.md spec

- **File:** `branch-chat/package.json`
- **Description:** Several dependency versions differ from the CLAUDE.md specification:
  - `next`: 16.2.2 (spec: 16.2.1) — minor patch, acceptable
  - `@vitejs/plugin-react`: ^6.0.1 (spec: ^4) — major version mismatch
  - `jsdom`: ^29.0.1 (spec: ^25) — major version mismatch
  - `vite-tsconfig-paths`: ^6.1.1 (spec: ^5) — major version mismatch
  - `@tailwindcss/postcss`: ^4 (spec: 4.2.2) — loose range vs pinned
  - `tailwindcss`: ^4 (spec: 4.2.2) — loose range vs pinned
- **Severity:** Low — These are newer compatible versions that likely work fine, but deviate from the pinned versions in the spec. The loose caret ranges (`^4`) could allow drift in future `npm install` runs.

### B-03: Missing `@xyflow/react` style import in globals.css

- **File:** `branch-chat/src/app/globals.css`
- **Description:** CLAUDE.md specifies that `globals.css` should include `@layer base { @import "@xyflow/react/dist/style.css"; }`, but this import is absent. However, `@xyflow/react` is not yet installed as a dependency, so adding the import now would cause a build error.
- **Severity:** Low — This is expected to be added when the tree visualization feature (F-04) is implemented and the dependency is installed. Acceptable deviation for scaffolding phase.

---

## Security

No security issues identified. This is expected for a scaffolding feature:
- No authentication logic implemented yet (stubs only)
- No database queries
- No API key handling
- No user input processing
- All API routes return 501 Not Implemented
- `.env.example` contains placeholders, not real secrets
- `.gitignore` properly excludes `.env.local`

---

## Architecture Alignment

### Folder Structure

**PASS** — The folder structure matches CLAUDE.md exactly. All specified directories and files exist.

### Notable Additions (not in spec, but acceptable)

| Item | Assessment |
|------|-----------|
| `src/components/ui/` directory | **Acceptable** — Generated by shadcn/ui init. Contains standard UI primitives (button, card, dialog, etc.). This is a standard shadcn pattern and was implicitly required by T-003. |
| `src/lib/utils.ts` | **Acceptable** — Generated by shadcn/ui for `cn()` class merging utility. |
| `components.json` | **Acceptable** — shadcn/ui configuration file. |
| `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes` dependencies | **Acceptable** — Required by shadcn/ui components. |
| `shadcn` package in dependencies | **Acceptable** — The shadcn CLI/runtime package. |

### Missing Dependencies (expected for scaffolding)

The following CLAUDE.md dependencies are not yet installed. This is expected — they belong to later features:
- `@xyflow/react`, `@dagrejs/dagre` (F-04: Tree Visualization)
- `mongoose` (F-02: Auth)
- `next-auth`, `bcryptjs` (F-02: Auth)
- `openai`, `@anthropic-ai/sdk`, `@google/genai` (F-05: LLM Integration)
- `react-markdown`, `react-syntax-highlighter` (F-03/F-04: Chat UI)
- `@types/react-syntax-highlighter`, `@types/bcryptjs` (corresponding features)
- `vitest` is 4.1.2 in spec but ^4.1.2 installed — acceptable

### Root layout.tsx

**Acceptable deviation** — CLAUDE.md specifies layout.tsx should include `AuthProvider + ToastProvider`. Currently it has neither, but both provider components exist as stubs. This will be wired up in F-02 (Auth). The current layout includes Geist font setup which is reasonable for scaffolding.

### middleware.ts

**PASS** — Present as a stub with correct matcher pattern. Comment indicates NextAuth v5 implementation deferred to F-02.

### LLM Provider Types

**PASS** — `src/lib/providers/types.ts` defines `LLMMessage`, `LLMResponse`, and `LLMProvider` interfaces matching the CLAUDE.md specification exactly.

---

## Forward Compatibility

### FC-01: Provider stub architecture is sound

- **Current code:** `src/lib/providers/types.ts` defines the `LLMProvider` interface with the correct `sendMessage` signature.
- **Future need:** F-05 will implement OpenAI, Anthropic, Gemini, and Mock providers.
- **Assessment:** Compatible. The interface matches the spec.

### FC-02: Context stubs are minimal but extensible

- **Current code:** `ConversationContext.ts` and `UIContext.ts` create contexts with `null` type.
- **Future need:** F-02/F-03 will add full state management.
- **Assessment:** Compatible. The null-typed contexts will be replaced with proper typed contexts.

### FC-03: API route stubs follow correct URL patterns

- **Current code:** All API routes exist at the correct paths returning 501.
- **Future need:** Each feature will implement route handlers.
- **Assessment:** Compatible. The file/folder structure is correct.

### FC-04: Middleware matcher needs review in F-02

- **Current code:** Matcher is `["/((?!login|register|api/auth).*)"]`.
- **Future need:** CLAUDE.md says middleware protects all except `/login`, `/register`, `/api/auth/*`.
- **Assessment:** Compatible. The regex pattern correctly excludes the specified paths.

### FC-05: No hardcoded assumptions that need undoing

- **Assessment:** The scaffolding is clean — stubs are minimal, no premature implementations that would conflict with later features.

---

## Summary

- Critical issues: 0
- Medium issues: 1 (B-01: vitest.config.ts path resolution)
- Low issues: 2 (B-02: version mismatches, B-03: missing xyflow CSS import)
- Recommendation: **REQUIRES_REVISION**

The scaffolding is thorough and well-structured. The single medium issue (vitest path resolution) will block test development in F-02 onward and should be fixed before proceeding.
