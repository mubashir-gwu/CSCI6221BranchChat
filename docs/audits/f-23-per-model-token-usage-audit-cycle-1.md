# Per-Model Token Usage — Audit Report (Cycle 1)
Date: 2026-04-09
Tasks covered: T-117, T-118, T-119, T-120

## Spec Compliance

### T-117: Update TokenUsage Schema for Per-Model Tracking

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Schema has `model` field with unique compound index `{ userId, model }` | **PASS** | `src/models/TokenUsage.ts:7` — `model: string` field; line 26 — `{ userId: 1, model: 1 }` unique index |
| `provider` field kept as non-unique indexed metadata | **PASS** | `src/models/TokenUsage.ts:27` — `{ userId: 1, provider: 1 }` non-unique index |
| Interface updated | **PASS** | `src/models/TokenUsage.ts:1-12` — `ITokenUsage` includes `model: string` |
| Old data migration documented (drop collection) | **PASS** | Documented in Task Breakdown Document. No runtime migration code needed — acceptable per spec ("loss is acceptable") |
| `npm run build` passes | **PASS** | Build succeeds |

### T-118: Update Token Recording Logic in Chat Route

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Token usage keyed by `{ userId, model }` not `{ userId, provider }` | **PASS** | `src/app/api/llm/chat/route.ts:279` — filter is `{ userId, model }` |
| `$set: { provider }` ensures provider metadata is present | **PASS** | `src/app/api/llm/chat/route.ts:286` — `$set: { provider }` in update |
| Auto-title token recording also updated | **PASS** | `src/app/api/llm/chat/route.ts:44-55` — `generateTitle()` uses `{ userId, model }` filter with `$set: { provider }` |
| `npm run build` passes | **PASS** | Build succeeds |

### T-119: Update Token Usage API Route and Usage Page

| Criterion | Status | Evidence |
|-----------|--------|----------|
| API returns `model` and `provider` per usage entry | **PASS** | `src/app/api/token-usage/route.ts:28-34` — response maps include `model` and `provider` |
| TokenUsageCard groups by provider with per-model breakdown | **PASS** | `src/components/dashboard/TokenUsageCard.tsx:47-56` — groups by provider; lines 98-116 — renders per-model rows |
| Empty state handled | **PASS** | `src/components/dashboard/TokenUsageCard.tsx:94-95` — "No usage data" shown when no entries |
| `npm run build` passes | **PASS** | Build succeeds |

### T-120: Write Tests for Per-Model Token Usage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Token recording test uses per-model key | **PASS** | `__tests__/api/llm-chat.test.ts:257-273` — verifies `findOneAndUpdate` called with `{ userId: "user-1", model: "gpt-4o" }` and `$set: { provider: "openai" }` |
| API response shape tested | **PASS** | `__tests__/api/usage.test.ts:40-78` — verifies response includes `model` and `provider` fields |
| All tests pass | **PASS** | 30/30 tests pass in llm-chat.test.ts; 3/3 tests pass in usage.test.ts |
| `npm run build` passes | **PASS** | Build succeeds |

## Bug Detection

No bugs found.

- Token recording in the stream `done` handler correctly uses `{ userId, model }` as filter and `$set: { provider }` — consistent with the schema's unique index.
- Auto-title token recording follows the same pattern.
- Token tracking failure is silently caught (line 290) to avoid breaking the stream — correct behavior.
- `process.env.NODE_ENV` on `TokenUsageCard.tsx:68` is safe — Next.js inlines this at build time even in client components.
- All null/undefined checks are appropriate.

## Security

No security issues found.

- **Auth:** `GET /api/token-usage` checks `auth()` session before proceeding (line 15-19). Returns 401 if unauthenticated.
- **Data isolation:** Query filters by `session.user.id` (line 24). User A cannot access User B's token usage.
- **No API key exposure:** Token usage data contains only aggregate counts, no sensitive information.
- **Input validation:** Token usage route is read-only (GET), no user input to sanitize.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| TokenUsage schema `model` field | Required string field | `model: { type: String, required: true }` | **Match** |
| Unique index `{ userId, model }` | Unique compound | `TokenUsageSchema.index({ userId: 1, model: 1 }, { unique: true })` | **Match** |
| Non-unique index `{ userId, provider }` | Non-unique for aggregation | `TokenUsageSchema.index({ userId: 1, provider: 1 })` | **Match** |
| Token recording filter | `{ userId, model }` with `$set: { provider }` | Implemented exactly | **Match** |
| API response shape | `{ model, provider, inputTokens, outputTokens, callCount }` | Matches exactly | **Match** |
| TokenUsageCard grouping | Group by provider, per-model rows | Implemented with provider cards and indented model rows | **Match** |
| File locations | All in specified paths | All files in correct locations | **Match** |

Architecture delta specifies `ITokenUsage extends Document` but implementation uses a plain interface with explicit `_id: Types.ObjectId`. This is an acceptable deviation — avoids tight coupling to Mongoose Document type and is consistent with all other models in the codebase.

## Forward Compatibility

No concerns. The per-model keying is the final form specified in the architecture. The `provider` field is preserved as metadata, enabling any future provider-level aggregation queries via the non-unique index.

## CLAUDE.md Updates

Two updates made to `CLAUDE.md`:

1. **TokenUsage data model section**: Added `model: string` field, changed unique index from `{ userId: 1, provider: 1 }` to `{ userId: 1, model: 1 }`, added non-unique `{ userId: 1, provider: 1 }` index, updated upsert description to show `{ userId, model }` filter with `$set: { provider }`.

2. **GET `/api/token-usage` API contract**: Updated response shape to include `model` field and added note about per-model keying with provider as metadata.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- CLAUDE.md updates: 2
- Recommendation: **PROCEED**
