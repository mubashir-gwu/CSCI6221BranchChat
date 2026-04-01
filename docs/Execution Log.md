# Execution Log

## F-01: Project Scaffolding & Configuration

**Status:** Complete  
**Date:** 2026-03-31

### T-001: Initialize Next.js 16 Project
- Scaffolded Next.js 16.2.2 with TypeScript, Tailwind, App Router, `src/` directory
- Cleaned boilerplate pages/components
- `npm run build` passes, `npm run dev` starts on localhost:3000

### T-002: Configure Tailwind CSS 4 and PostCSS
- Simplified `postcss.config.mjs` to match spec exactly
- `globals.css` uses `@import "tailwindcss"` (CSS-first, no `tailwind.config.ts`)
- Build passes

### T-003: Install shadcn/ui and Configure Theme
- Deliberation conducted and saved to `docs/decisions/scaffolding/T-003-*`
- Initialized shadcn/ui with new-york style, OKLCH colors, tw-animate-css
- Installed 11 base components: button, input, label, dialog, dropdown-menu, sonner, card, badge, separator, scroll-area, tooltip
- `globals.css` has full OKLCH `--color-*` and `--radius-*` variables in `@theme inline {}` block
- No `tailwind.config.ts` created — pure CSS-first config
- Build passes

### T-004: Create Folder Structure and Placeholder Files
- Created 71 files across all directories specified in Architecture Document §3
- All page routes, API routes, components, contexts, hooks, lib, models, types, and constants have valid TypeScript stubs
- Middleware stub uses passthrough (NextAuth integration deferred to F-02)
- `npm run build` passes with all routes recognized

### T-005: Configure Vitest, Docker Compose, and Environment Templates
- Installed vitest@4, @vitejs/plugin-react, jsdom, @testing-library/react@16, @testing-library/dom, @testing-library/jest-dom
- Created `vitest.config.ts` with jsdom environment, globals, tsconfigPaths
- Added `test` and `test:watch` scripts to package.json
- Created `docker-compose.yml` with MongoDB 7
- Created `.env.example` with all 4 required variables
- `.gitignore` covers `.env*`, `node_modules`, `.next`
- `npm test` exits 0 (no test files yet)
- Build passes

### Revision Pass (2026-03-31)

**Fixes applied: 2/2**

1. **vitest.config.ts path resolution** — Replaced invalid `resolve: { tsconfigPaths: true }` block with `vite-tsconfig-paths` plugin in the plugins array. Config now correctly uses the installed package.
2. **Pin devDependency versions to CLAUDE.md spec** — Updated `@tailwindcss/postcss` from `^4` to `4.2.2`, `tailwindcss` from `^4` to `4.2.2`, `@vitejs/plugin-react` from `^6.0.1` to `^4`, `jsdom` from `^29.0.1` to `^25`, `vite-tsconfig-paths` from `^6.1.1` to `^5`. `npm install`, `npm run build`, and `npm test` all pass.

**Fixes that couldn't be applied:** None

**New concerns noticed:** None

---

## F-02: Database Layer

**Status:** Complete  
**Date:** 2026-03-31

### T-006: Implement MongoDB Connection Singleton
- Installed `mongoose@9.3.3`
- Implemented `src/lib/db.ts` with global cache pattern to prevent multiple connections during Next.js hot-reload
- Reads `MONGODB_URI` from environment, throws if undefined
- `npm run build` passes

### T-007: Implement User Model
- Implemented `src/models/User.ts` with `IUser` interface and Mongoose schema
- Fields: `email` (unique, lowercase, trimmed), `hashedPassword` (required), `timestamps: true`
- Note: Removed explicit `_id: string` from interface — Mongoose 9's `Document` type already provides `_id` as `ObjectId`, and overriding to `string` causes a type conflict
- `npm run build` passes

### T-008: Implement ApiKey Model
- Implemented `src/models/ApiKey.ts` with `IApiKey` interface
- Fields: `userId` (ref User), `provider` (enum: openai/anthropic/gemini), `encryptedKey`, `iv`, `authTag`
- Compound unique index on `{ userId: 1, provider: 1 }`
- `npm run build` passes

### T-009: Implement Conversation Model
- Implemented `src/models/Conversation.ts` with `IConversation` interface
- Fields: `userId`, `title` (maxlength 200, trimmed), `defaultProvider` (enum includes mock), `defaultModel`, `rootNodeId` (default null)
- Index on `{ userId: 1, updatedAt: -1 }`
- `npm run build` passes

### T-010: Implement Node Model
- Implemented `src/models/Node.ts` with `INode` interface
- Fields: `conversationId`, `parentId` (default null), `role` (user/assistant/system), `content`, `provider` (nullable), `model` (nullable)
- `timestamps: { createdAt: true, updatedAt: false }` — nodes are immutable
- Two indexes: `{ conversationId: 1 }` and `{ conversationId: 1, parentId: 1 }`
- Note: `model` field name conflicts with Mongoose `Document.model()` method. Fixed by using a standalone `INode` interface (not extending `Document`) and untyped `model()` call. Schema field name remains `model` as specified.
- `npm run build` passes

### Revision Pass (2026-03-31)

**Fixes applied: 1/1**

1. **db.ts rejected promise caching** — Wrapped `cached.conn = await cached.promise` in a try/catch. On failure, `cached.promise` is set to `null` and the error re-thrown, allowing subsequent `connectDB()` calls to retry instead of permanently returning a rejected promise.

**Fixes that couldn't be applied:** None

**New concerns noticed:** None

### Final Verification
- `npm run build` passes with no errors
- `npm run dev` starts cleanly on localhost:3000
