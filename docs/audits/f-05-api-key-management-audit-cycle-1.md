# API Key Management — Audit Report (Cycle 1)
Date: 2026-03-31
Tasks covered: T-024, T-025, T-026, T-027

## Spec Compliance

### T-024: Implement AES-256-GCM Encryption Utilities

| Criterion | Verdict | Evidence |
|---|---|---|
| `encrypt("test-key")` returns `{ encryptedKey, iv, authTag }` with non-empty hex strings | **PASS** | `src/lib/encryption.ts:9-16` — returns three hex strings. Test `encryption.test.ts:10-25` confirms non-empty hex format via regex `/^[0-9a-f]+$/`. |
| `decrypt(encrypt("test-key"))` returns `"test-key"` | **PASS** | `src/lib/encryption.ts:18-24`. Test `encryption.test.ts:10-25` does round-trip assertion. |
| Tampering with authTag causes decryption to throw | **PASS** | Test `encryption.test.ts:43-47` replaces authTag with all-`a` string and asserts `.toThrow()`. |
| `maskKey("sk-abc123xyz")` returns `"sk-...xyz"` | **PASS** | `src/lib/encryption.ts:26-29`. Test `encryption.test.ts:57-59` asserts exact output. |
| `npm run build` passes | **PASS** | Build completes successfully with all routes recognized. |

### T-025: Implement API Key API Routes

| Criterion | Verdict | Evidence |
|---|---|---|
| `GET /api/settings/api-keys` returns masked keys (FR-005) | **PASS** | `src/app/api/settings/api-keys/route.ts:16-24` — queries by `userId`, decrypts, masks, returns `{ keys: [{ provider, maskedKey, updatedAt }] }`. |
| `PUT /api/settings/api-keys/openai` with `{ apiKey: "sk-test" }` stores encrypted key (FR-005) | **PASS** | `src/app/api/settings/api-keys/[provider]/route.ts:37-44` — encrypts with AES-256-GCM and upserts. |
| Subsequent `GET` shows masked version of stored key | **PASS** | GET decrypts stored key and returns `maskKey()` result. Test `api-keys.test.ts:70-91` verifies masked output. |
| `PUT` again replaces the key (FR-006) | **PASS** | Uses `findOneAndUpdate` with `upsert: true` on `{ userId, provider }` compound key — subsequent PUTs overwrite. |
| `DELETE /api/settings/api-keys/openai` removes the key (FR-006) | **PASS** | `[provider]/route.ts:74` — `ApiKey.deleteOne({ userId, provider })`. Test `api-keys.test.ts:153-166` verifies. |
| Invalid provider returns 400 | **PASS** | `[provider]/route.ts:20-22` — validates against `ALLOWED_PROVIDERS`. Test `api-keys.test.ts:101-104` verifies. |
| `npm run build` passes | **PASS** | Build completes successfully. |

### T-026: Implement Settings Page UI

| Criterion | Verdict | Evidence |
|---|---|---|
| Settings page shows forms for OpenAI, Anthropic, Gemini (FR-005) | **PASS** | `ApiKeyList.tsx:13-15` maps `["openai", "anthropic", "gemini"]` from `PROVIDERS` constant, renders one `ApiKeyForm` per provider. Mock provider excluded. |
| Entering and saving a key shows masked version (FR-005) | **PASS** | `ApiKeyForm.tsx:32-52` — `handleSave` calls PUT, on success triggers `onSave` which re-fetches keys. `ApiKeyList.tsx:50` passes `fetchKeys` as `onSave`. Masked key shown in `CardTitle` (line 82-84). |
| Updating a key replaces the old one (FR-006) | **PASS** | PUT route uses `findOneAndUpdate` with `upsert: true`. Placeholder text changes to "Enter new key to replace" when a key exists (`ApiKeyForm.tsx:97`). |
| Deleting a key removes it (FR-006) | **PASS** | `ApiKeyForm.tsx:55-71` — `handleDelete` calls DELETE, triggers `onDelete` → re-fetch. Delete button only shown when `currentMaskedKey` exists (line 105). |
| Toast confirms save/delete actions | **PASS** | `ApiKeyForm.tsx:45` — `toast.success()` on save; line 65 — `toast.success()` on delete. Error toasts on failure (lines 49, 69). Uses `sonner` per spec. |
| `npm run build` passes | **PASS** | Build completes successfully. Settings page rendered as static. |

### T-027: Write Tests for Encryption and API Key Routes

| Criterion | Verdict | Evidence |
|---|---|---|
| All tests pass via `npm test` | **PASS** | 18/18 tests pass (8 encryption + 10 API key route tests). |
| Encryption tests verify integrity (tamper detection) | **PASS** | `encryption.test.ts:42-54` — tests tampered authTag and tampered ciphertext both throw. |

## Bug Detection

No critical or medium bugs found. Minor observations:

1. **GET decryption failure is not fault-tolerant** — `api-keys/route.ts:20`: If any stored key has corrupted encryption data, `decrypt()` will throw and the entire GET request returns 500. The user would be unable to view or manage any of their keys. **Severity: Low.** A per-key try/catch could gracefully skip corrupted entries, but this is an edge case that only occurs with data corruption.

2. **No rate limiting on PUT** — A user could theoretically spam the PUT endpoint to repeatedly encrypt/store keys. This is acknowledged in Architecture Document §11 (tradeoff #4) as a known limitation not in scope. **Severity: Low.**

## Security

| Check | Result | Evidence |
|---|---|---|
| Auth enforcement on all routes | **PASS** | All three handlers (`GET`, `PUT`, `DELETE`) check `session?.user?.id` and return 401 if missing. |
| Data isolation (user scoping) | **PASS** | GET filters by `userId: session.user.id`. PUT upserts with `userId` in filter. DELETE filters by `userId`. No cross-user access possible. |
| Middleware protection | **PASS** | `middleware.ts:8` includes `/api/settings/:path*` in matcher — double-layered auth. |
| Provider validation | **PASS** | PUT and DELETE validate provider against `ALLOWED_PROVIDERS = ["openai", "anthropic", "gemini"]`. Invalid provider returns 400. |
| Input validation | **PASS** | PUT validates `apiKey` is present, is a string, and is non-empty after trimming (`[provider]/route.ts:33`). Request body parse failure caught (`[provider]/route.ts:26-30`). |
| No encrypted data in response | **PASS** | GET returns only `{ provider, maskedKey, updatedAt }`. No `encryptedKey`, `iv`, or `authTag` in any response. |
| No API keys in client-side code | **PASS** | `ENCRYPTION_KEY` only accessed server-side in `src/lib/encryption.ts`. All API key operations are server-side route handlers. |
| Mongoose injection protection | **PASS** | Provider validated against allowlist before query. `userId` comes from authenticated session, not user input. `apiKey` is only passed to `encrypt()`, never to a query. |

No security issues found.

## Architecture Alignment

| Aspect | Specified | Implemented | Verdict |
|---|---|---|---|
| File: `src/lib/encryption.ts` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/app/api/settings/api-keys/route.ts` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/app/api/settings/api-keys/[provider]/route.ts` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/components/settings/ApiKeyForm.tsx` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/components/settings/ApiKeyList.tsx` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/app/(protected)/settings/page.tsx` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `src/models/ApiKey.ts` | Per CLAUDE.md folder structure | Exists at correct path | **Match** |
| File: `__tests__/lib/encryption.test.ts` | Per T-027 spec | Exists at correct path | **Match** |
| File: `__tests__/api/api-keys.test.ts` | Per T-027 spec | Exists at correct path | **Match** |
| ApiKey schema fields | `userId, provider, encryptedKey, iv, authTag` + timestamps | All fields present, types correct, `{ timestamps: true }` | **Match** |
| ApiKey index | `{ userId: 1, provider: 1 }` unique compound | `ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true })` | **Match** |
| Provider enum | `"openai" \| "anthropic" \| "gemini"` | Schema enum + route allowlist both match | **Match** |
| GET response shape | `{ keys: { provider, maskedKey, updatedAt }[] }` | Matches exactly | **Match** |
| PUT request/response | `{ apiKey }` → 200 with upsert | Matches exactly | **Match** |
| DELETE response | 200 | Matches exactly | **Match** |
| Settings page | Renders `ApiKeyList`, title "API Key Settings" | `settings/page.tsx` renders `ApiKeyList` with `<h1>API Key Settings</h1>` | **Match** |

**Acceptable deviations:**

1. **`getKeyBuffer()` function instead of module-level constant** — T-024 spec shows `ENCRYPTION_KEY` and `KEY_BUFFER` as module-level constants. Implementation wraps in `getKeyBuffer()` function. This is better for serverless environments where env vars may not be available at module load time. Also provides a clear error message if `ENCRYPTION_KEY` is missing. **Acceptable — strictly better than spec.**

2. **ApiKeyForm extra props** — T-026 spec says `Props: provider, currentMaskedKey, onSave, onDelete`. Implementation adds `displayName` and `color` for the provider badge. These are additive props needed for the color-coded badge display mentioned in the acceptance criteria ("Provider name and color badge displayed"). **Acceptable — required for badge rendering.**

3. **GET route decrypts to produce mask** — Architecture Document §10 says "Decryption only server-side in LLM route." The GET route also calls `decrypt()` server-side to compute the mask. This is necessary because the schema does not store a pre-computed `maskedKey` field. The plaintext key never reaches the client. **Acceptable — implementation necessity consistent with the schema spec.**

## Forward Compatibility

| Concern | Current Code | Future Need | Assessment |
|---|---|---|---|
| LLM Chat route (F-08) needs key decryption | `decrypt()` exported from `src/lib/encryption.ts` | F-08 will call `decrypt()` to get plaintext key for LLM API calls | **Compatible** — function is exported and ready to use. |
| Provider constants shared across features | `PROVIDERS` in `constants/providers.ts` used by `ApiKeyList` | `ModelSelector` (F-08) will also use `PROVIDERS` for color coding | **Compatible** — constant is already structured for reuse. |
| `ALLOWED_PROVIDERS` duplicated in route handler | `["openai", "anthropic", "gemini"]` hardcoded in `[provider]/route.ts` | Adding a new provider requires updating both the model enum and the route allowlist | **Low concern** — minor duplication, but adding providers is a deliberate change that should touch both. |
| ApiKey model schema | Self-contained, no foreign key to Conversation or Node | No future feature needs to extend this schema | **Compatible** — no conflicts. |
| Encryption key rotation | Single `ENCRYPTION_KEY`, no versioning | Architecture Document §11 tradeoff #2 acknowledges this | **Known limitation** — out of scope per spec. |

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 2
- Recommendation: **PROCEED**

Low issues (informational only):
1. GET route has no per-key error handling — a corrupted key causes the entire listing to fail with 500.
2. `ALLOWED_PROVIDERS` list in the route handler is a minor duplication of the model's enum.
