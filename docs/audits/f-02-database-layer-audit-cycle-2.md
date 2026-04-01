# Database Layer (F-02) — Audit Report (Cycle 2)
Date: 2026-03-31
Tasks covered: T-006, T-007, T-008, T-009, T-010

## Spec Compliance

### T-006: Implement MongoDB Connection Singleton

| Criterion | Status | Evidence |
|---|---|---|
| Importing `connectDB` does not throw at build time | **PASS** | `branch-chat/src/lib/db.ts` exports `connectDB` as async function; `npm run build` succeeds |
| Calling `connectDB()` with valid `MONGODB_URI` establishes connection | **PASS** | Uses `mongoose.connect(MONGODB_URI)` with global cache pattern |
| `npm run build` passes | **PASS** | Verified — build completes with no errors |

### T-007: Implement User Model

| Criterion | Status | Evidence |
|---|---|---|
| `User` model can be imported without errors | **PASS** | `branch-chat/src/models/User.ts` exports `User`; build passes |
| Schema has `email` (unique, lowercase, trimmed) and `hashedPassword` (required) | **PASS** | Line 12: `email: { type: String, required: true, unique: true, lowercase: true, trim: true }`, line 13: `hashedPassword: { type: String, required: true }` |
| `timestamps: true` enables `createdAt` and `updatedAt` | **PASS** | Schema options line 15: `{ timestamps: true }` |
| `npm run build` passes | **PASS** | Verified |

### T-008: Implement ApiKey Model

| Criterion | Status | Evidence |
|---|---|---|
| Compound unique index on `{ userId, provider }` | **PASS** | Line 24: `ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true })` |
| `provider` enum includes exactly `openai`, `anthropic`, `gemini` | **PASS** | Line 16: `enum: ['openai', 'anthropic', 'gemini']` |
| `npm run build` passes | **PASS** | Verified |

### T-009: Implement Conversation Model

| Criterion | Status | Evidence |
|---|---|---|
| `defaultProvider` enum includes `mock` | **PASS** | Line 17: `enum: ['openai', 'anthropic', 'gemini', 'mock']` |
| `rootNodeId` defaults to `null` | **PASS** | Line 19: `default: null` |
| `title` has `maxlength: 200` and `trim: true` | **PASS** | Line 16: `trim: true, maxlength: 200` |
| Index on `{ userId: 1, updatedAt: -1 }` | **PASS** | Line 24: `ConversationSchema.index({ userId: 1, updatedAt: -1 })` |
| `npm run build` passes | **PASS** | Verified |

### T-010: Implement Node Model

| Criterion | Status | Evidence |
|---|---|---|
| `provider` allows `null` (for user messages) | **PASS** | Line 9: `enum: ['openai', 'anthropic', 'gemini', 'mock', null], default: null` |
| `model` allows `null` (for user messages) | **PASS** | Line 10: `default: null` |
| Only `createdAt` timestamp, no `updatedAt` | **PASS** | Line 12: `timestamps: { createdAt: true, updatedAt: false }` |
| Both indexes created: `{ conversationId: 1 }` and `{ conversationId: 1, parentId: 1 }` | **PASS** | Lines 15-16 |
| `npm run build` passes | **PASS** | Verified |

## Bug Detection

### Cycle 1 BUG-01 (connection retry) — RESOLVED

**File:** `branch-chat/src/lib/db.ts`, lines 15-20
**Status:** Fixed. The `connectDB()` function now wraps `await cached.promise` in a try/catch that resets `cached.promise = null` on failure, allowing subsequent calls to retry the connection.

### Cycle 1 BUG-02 (INode not extending Document) — ACCEPTABLE DEVIATION (unchanged)

**File:** `branch-chat/src/models/Node.ts`, lines 18-27
**Status:** Still present, still acceptable. The `INode` interface is standalone to avoid the `model` field name conflict with `Document.model()`. The `Node` export on line 29 uses `model('Node', NodeSchema)` without the `<INode>` generic, meaning consumers won't get typed query results without casting. This is a minor ergonomic issue that will be naturally addressed when consumers are implemented. No action required.

### No new bugs found

All four model files and the connection singleton were re-reviewed line by line. No logic errors, no missing null checks, no unhandled exceptions beyond what was already noted.

## Security

No security issues found. This feature consists solely of:
- A connection singleton (no auth, no user input)
- Schema definitions (no query logic, no user-facing endpoints)

Security assessment remains not applicable for pure model definitions. Security will be relevant when API routes consume these models (F-03 and beyond).

## Architecture Alignment

| Aspect | Spec | Implementation | Status |
|---|---|---|---|
| File: `src/lib/db.ts` | Mongoose 9 connection singleton | Exact match with improved error handling | **Aligned** |
| File: `src/models/User.ts` | IUser + UserSchema + User export | Exact match (omits `_id: string` — see note) | **Aligned** |
| File: `src/models/ApiKey.ts` | IApiKey + ApiKeySchema + ApiKey export | Exact match (omits `_id: string` — see note) | **Aligned** |
| File: `src/models/Conversation.ts` | IConversation + ConversationSchema + Conversation export | Exact match (omits `_id: string` — see note) | **Aligned** |
| File: `src/models/Node.ts` | INode + NodeSchema + Node export | Structural match, interface standalone with `_id: Types.ObjectId` | **Acceptable deviation** |
| Mongoose version | 9.3.3 | `^9.3.3` in package.json | **Aligned** |
| All indexes | As specified in CLAUDE.md | All present and correct | **Aligned** |
| Folder location | `src/models/` | `branch-chat/src/models/` | **Aligned** |

### Known deviation: `_id` field in interfaces

The Architecture Document specifies `_id: string` in all interfaces. User, ApiKey, and Conversation omit `_id` (relying on Mongoose `Document`'s built-in `_id`). Node declares `_id: Types.ObjectId`. This was documented in cycle 1 as an acceptable deviation due to Mongoose 9 type conflicts. No change needed.

## Forward Compatibility

All assessments from cycle 1 remain valid:

| ID | Assessment | Status |
|---|---|---|
| FC-01 | Connection singleton ready for all downstream features | **Compatible** |
| FC-02 | User model supports F-03 (Authentication) | **Compatible** |
| FC-03 | ApiKey model supports F-05 (API Key Management) | **Compatible** |
| FC-04 | Conversation model supports F-06 (Conversation Management) | **Compatible** |
| FC-05 | Node model supports F-07 (Chat/Branching) | **Compatible** |
| FC-06 | `defaultProvider` enum vs string — acceptable strictness | **Compatible** |
| FC-07 | BUG-01 connection retry — now fixed | **Resolved** |

No new forward compatibility concerns identified.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 1 (INode standalone interface — acceptable deviation, no action required)
- Recommendation: **VERIFIED**

All cycle 1 findings have been addressed. BUG-01 (connection retry) is fixed. All acceptance criteria pass. The build succeeds. The feature is ready to proceed.
