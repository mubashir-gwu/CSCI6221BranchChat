# API Key Management — Audit Report (Cycle 2)
Date: 2026-04-01
Tasks covered: T-024, T-025, T-026, T-027

## Cycle 1 Issue Resolution

| # | Issue | Verdict | Evidence |
|---|---|---|---|
| 1 | GET route has no per-key error handling — single corrupted key causes 500 | **RESOLVED** | `src/app/api/settings/api-keys/route.ts:18-32` — `.map()` now wraps each decrypt+mask in try/catch. On failure, returns `{ provider, maskedKey: "[error]", updatedAt }` with a `console.error` for observability. Users can still view and delete other keys. |
| 2 | `ALLOWED_PROVIDERS` hardcoded duplication in route handler | **RESOLVED** | `src/app/api/settings/api-keys/[provider]/route.ts:4` — now imports `API_KEY_PROVIDERS` from `@/models/ApiKey`. Used at lines 18 and 65. Single source of truth for the provider list. |

## Spec Compliance

### T-024: Implement AES-256-GCM Encryption Utilities

| Criterion | Verdict | Evidence |
|---|---|---|
| `encrypt("test-key")` returns `{ encryptedKey, iv, authTag }` with non-empty hex strings | **PASS** | `src/lib/encryption.ts:9-16`. Test `encryption.test.ts:10-25` confirms non-empty hex via `/^[0-9a-f]+$/`. |
| `decrypt(encrypt("test-key"))` returns `"test-key"` | **PASS** | `src/lib/encryption.ts:18-24`. Test `encryption.test.ts:10-25` round-trip assertion. |
| Tampering with authTag causes decryption to throw | **PASS** | Test `encryption.test.ts:43-47` replaces authTag and asserts `.toThrow()`. |
| `maskKey("sk-abc123xyz")` returns `"sk-...xyz"` | **PASS** | `src/lib/encryption.ts:26-29`. Test `encryption.test.ts:57-59` asserts exact output. |
| `npm run build` passes | **PASS** | Build completes successfully. |

### T-025: Implement API Key API Routes

| Criterion | Verdict | Evidence |
|---|---|---|
| `GET /api/settings/api-keys` returns masked keys (FR-005) | **PASS** | `src/app/api/settings/api-keys/route.ts:16-33` — queries by `userId`, decrypts, masks, returns `{ keys: [{ provider, maskedKey, updatedAt }] }`. Now with per-key error handling. |
| `PUT /api/settings/api-keys/openai` with `{ apiKey: "sk-test" }` stores encrypted key (FR-005) | **PASS** | `src/app/api/settings/api-keys/[provider]/route.ts:35-43` — encrypts with AES-256-GCM and upserts. |
| Subsequent `GET` shows masked version of stored key | **PASS** | GET decrypts stored key and returns `maskKey()` result. Test `api-keys.test.ts:70-92` verifies. |
| `PUT` again replaces the key (FR-006) | **PASS** | Uses `findOneAndUpdate` with `upsert: true` on `{ userId, provider }` compound key. |
| `DELETE /api/settings/api-keys/openai` removes the key (FR-006) | **PASS** | `[provider]/route.ts:72` — `ApiKey.deleteOne({ userId, provider })`. Test `api-keys.test.ts:153-167` verifies. |
| Invalid provider returns 400 | **PASS** | `[provider]/route.ts:18-20` — validates against `API_KEY_PROVIDERS` imported from model. Test `api-keys.test.ts:101-106` verifies. |
| `npm run build` passes | **PASS** | Build completes successfully. |

### T-026: Implement Settings Page UI

| Criterion | Verdict | Evidence |
|---|---|---|
| Settings page shows forms for OpenAI, Anthropic, Gemini (FR-005) | **PASS** | `ApiKeyList.tsx:13-15` maps `["openai", "anthropic", "gemini"]` from `PROVIDERS` constant. Renders one `ApiKeyForm` per provider. Mock excluded. |
| Entering and saving a key shows masked version (FR-005) | **PASS** | `ApiKeyForm.tsx:32-52` — `handleSave` calls PUT, on success triggers `onSave` → re-fetch. Masked key shown in `CardTitle` (lines 81-84). |
| Updating a key replaces the old one (FR-006) | **PASS** | PUT route uses `findOneAndUpdate` with `upsert: true`. Placeholder changes to "Enter new key to replace" when key exists (`ApiKeyForm.tsx:97`). |
| Deleting a key removes it (FR-006) | **PASS** | `ApiKeyForm.tsx:55-71` — `handleDelete` calls DELETE, triggers `onDelete` → re-fetch. Delete button only shown when `currentMaskedKey` exists (line 105). |
| Toast confirms save/delete actions | **PASS** | `ApiKeyForm.tsx:45` — `toast.success()` on save; line 65 — `toast.success()` on delete. Error toasts on failure (lines 49, 69). Uses `sonner`. |
| `npm run build` passes | **PASS** | Build completes successfully. Settings page rendered as static. |

### T-027: Write Tests for Encryption and API Key Routes

| Criterion | Verdict | Evidence |
|---|---|---|
| All tests pass via `npm test` | **PASS** | 39/39 tests pass (8 encryption + 10 API key route + 21 other). All 4 test files pass. |
| Encryption tests verify integrity (tamper detection) | **PASS** | `encryption.test.ts:42-54` — tests tampered authTag and tampered ciphertext both throw. |

## Bug Detection

All source files re-read line by line. No bugs found.

- **Per-key error handling** (cycle 1 issue #1): Now properly handled with try/catch inside `.map()`. Corrupted keys return `"[error]"` mask without blocking other keys.
- **Provider validation** uses single source `API_KEY_PROVIDERS` (cycle 1 issue #2): Eliminated divergence risk.
- **Unhandled promise rejections**: All async operations in route handlers are wrapped in try/catch. UI components use try/catch in `handleSave` and `handleDelete` with `finally` blocks for state cleanup.
- **React state issues**: `fetchKeys` is wrapped in `useCallback` with empty deps (stable reference). `useEffect` dependency on `fetchKeys` is correct.
- **Missing cleanup**: `useEffect` in `ApiKeyList` only runs on mount (stable callback), no interval or subscription to clean up.
- **Race conditions**: Save/delete buttons are disabled during their respective operations (`saving`, `deleting` state), preventing double-submit.

No bugs identified.

## Security

| Check | Result | Evidence |
|---|---|---|
| Auth enforcement on all routes | **PASS** | All three handlers (`GET`, `PUT`, `DELETE`) check `session?.user?.id` and return 401. |
| Data isolation (user scoping) | **PASS** | GET filters by `userId`. PUT upserts with `userId` in filter. DELETE filters by `userId`. No cross-user access. |
| Middleware protection | **PASS** | `middleware.ts:10` includes `/api/settings/:path*` in matcher — double-layered auth. |
| Provider validation | **PASS** | PUT and DELETE validate against `API_KEY_PROVIDERS` imported from model. Invalid provider → 400. |
| Input validation | **PASS** | PUT validates `apiKey` is present, is a string, and is non-empty after trim (`[provider]/route.ts:31`). Request body parse failure caught (`[provider]/route.ts:24-28`). |
| No encrypted data in response | **PASS** | GET returns only `{ provider, maskedKey, updatedAt }`. No `encryptedKey`, `iv`, or `authTag` in any response. |
| No API keys in client-side code | **PASS** | `ENCRYPTION_KEY` only accessed server-side in `src/lib/encryption.ts`. All operations are server-side route handlers. |
| Mongoose injection protection | **PASS** | Provider validated against allowlist before query. `userId` from session, not user input. `apiKey` only passed to `encrypt()`. |
| Graceful error handling | **PASS** | Per-key decrypt failures don't expose error details to client. `console.error` server-side only. Client sees `"[error]"` mask. |

No security issues found.

## Architecture Alignment

| Aspect | Specified | Implemented | Verdict |
|---|---|---|---|
| File: `src/lib/encryption.ts` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/app/api/settings/api-keys/route.ts` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/app/api/settings/api-keys/[provider]/route.ts` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/components/settings/ApiKeyForm.tsx` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/components/settings/ApiKeyList.tsx` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/app/(protected)/settings/page.tsx` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `src/models/ApiKey.ts` | Per CLAUDE.md | Exists at correct path | **Match** |
| File: `__tests__/lib/encryption.test.ts` | Per T-027 | Exists at correct path | **Match** |
| File: `__tests__/api/api-keys.test.ts` | Per T-027 | Exists at correct path | **Match** |
| ApiKey schema fields | `userId, provider, encryptedKey, iv, authTag` + timestamps | All fields present, types correct, `{ timestamps: true }` | **Match** |
| ApiKey index | `{ userId: 1, provider: 1 }` unique compound | `ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true })` | **Match** |
| Provider enum | `"openai" \| "anthropic" \| "gemini"` | Schema enum matches, route uses same constant | **Match** |
| GET response shape | `{ keys: { provider, maskedKey, updatedAt }[] }` | Matches exactly | **Match** |
| PUT request/response | `{ apiKey }` → 200 with upsert | Matches exactly | **Match** |
| DELETE response | 200 | Matches exactly | **Match** |
| Settings page | Renders `ApiKeyList`, title "API Key Settings" | `settings/page.tsx` renders `ApiKeyList` with `<h1>API Key Settings</h1>` | **Match** |

**Acceptable deviations (unchanged from cycle 1):**

1. **`getKeyBuffer()` function instead of module-level constant** — Better for serverless environments. Provides clear error if `ENCRYPTION_KEY` missing. **Acceptable — strictly better than spec.**

2. **ApiKeyForm extra props** (`displayName`, `color`) — Required for provider badge rendering per acceptance criteria. **Acceptable — additive.**

3. **GET route decrypts to produce mask** — Necessary because schema does not store pre-computed `maskedKey`. Plaintext never reaches client. **Acceptable — implementation necessity.**

## Forward Compatibility

| Concern | Current Code | Future Need | Assessment |
|---|---|---|---|
| LLM Chat route (F-08) needs key decryption | `decrypt()` exported from `src/lib/encryption.ts` | F-08 will call `decrypt()` to get plaintext key for LLM API calls | **Compatible** |
| Provider constants shared across features | `PROVIDERS` in `constants/providers.ts`, `API_KEY_PROVIDERS` in model | `ModelSelector` (F-08) will use `PROVIDERS` for color coding | **Compatible** |
| Provider list single source of truth | `API_KEY_PROVIDERS` exported from model, imported in route | Adding a provider means updating model enum — route picks it up automatically | **Compatible** (improved from cycle 1) |
| ApiKey model schema | Self-contained, no foreign keys to other collections | No future feature extends this schema | **Compatible** |
| Encryption key rotation | Single `ENCRYPTION_KEY`, no versioning | Architecture Document §11 acknowledges this tradeoff | **Known limitation — out of scope** |

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**

Both medium issues from cycle 1 have been resolved. All acceptance criteria pass. No bugs, security issues, or architecture deviations found. Build and all 39 tests pass.
