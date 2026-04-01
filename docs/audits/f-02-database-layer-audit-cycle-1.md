# Database Layer (F-02) — Audit Report (Cycle 1)
Date: 2026-03-31
Tasks covered: T-006, T-007, T-008, T-009, T-010

## Spec Compliance

### T-006: Implement MongoDB Connection Singleton

| Criterion | Status | Evidence |
|---|---|---|
| Importing `connectDB` does not throw at build time | **PASS** | `npm run build` succeeds; `branch-chat/src/lib/db.ts` exports `connectDB` as async function |
| Calling `connectDB()` with valid `MONGODB_URI` establishes connection | **PASS** | Implementation uses `mongoose.connect(MONGODB_URI)` with global cache pattern; execution log confirms `npm run dev` starts cleanly |
| `npm run build` passes | **PASS** | Verified — build completes with no errors |

### T-007: Implement User Model

| Criterion | Status | Evidence |
|---|---|---|
| `User` model can be imported without errors | **PASS** | `branch-chat/src/models/User.ts` exports `User`; build passes |
| Schema has `email` (unique, lowercase, trimmed) and `hashedPassword` (required) | **PASS** | `email: { type: String, required: true, unique: true, lowercase: true, trim: true }`, `hashedPassword: { type: String, required: true }` |
| `timestamps: true` enables `createdAt` and `updatedAt` | **PASS** | Schema options: `{ timestamps: true }` |
| `npm run build` passes | **PASS** | Verified |

### T-008: Implement ApiKey Model

| Criterion | Status | Evidence |
|---|---|---|
| Compound unique index on `{ userId, provider }` | **PASS** | `ApiKeySchema.index({ userId: 1, provider: 1 }, { unique: true })` at line 24 |
| `provider` enum includes exactly `openai`, `anthropic`, `gemini` | **PASS** | `enum: ['openai', 'anthropic', 'gemini']` at line 16 |
| `npm run build` passes | **PASS** | Verified |

### T-009: Implement Conversation Model

| Criterion | Status | Evidence |
|---|---|---|
| `defaultProvider` enum includes `mock` | **PASS** | `enum: ['openai', 'anthropic', 'gemini', 'mock']` at line 17 |
| `rootNodeId` defaults to `null` | **PASS** | `default: null` at line 19 |
| `title` has `maxlength: 200` and `trim: true` | **PASS** | `trim: true, maxlength: 200` at line 16 |
| Index on `{ userId: 1, updatedAt: -1 }` | **PASS** | `ConversationSchema.index({ userId: 1, updatedAt: -1 })` at line 24 |
| `npm run build` passes | **PASS** | Verified |

### T-010: Implement Node Model

| Criterion | Status | Evidence |
|---|---|---|
| `provider` allows `null` (for user messages) | **PASS** | `enum: ['openai', 'anthropic', 'gemini', 'mock', null], default: null` at line 9 |
| `model` allows `null` (for user messages) | **PASS** | `default: null` at line 10 |
| Only `createdAt` timestamp, no `updatedAt` | **PASS** | `timestamps: { createdAt: true, updatedAt: false }` at line 12 |
| Both indexes created: `{ conversationId: 1 }` and `{ conversationId: 1, parentId: 1 }` | **PASS** | Lines 15-16 |
| `npm run build` passes | **PASS** | Verified |

## Bug Detection

### BUG-01: `connectDB` fails to reset `cached.promise` on connection failure

**File:** `branch-chat/src/lib/db.ts`, `connectDB()` function (lines 10-17)
**Severity:** Medium

If `mongoose.connect()` rejects (e.g., MongoDB is down at startup), the rejected promise is cached. All subsequent calls to `connectDB()` will return the same rejected promise forever — the app cannot recover without a full process restart.

**Expected:** On connection failure, `cached.promise` should be reset to `null` so the next call retries.

```typescript
// Current (problematic):
cached.conn = await cached.promise;

// Should be:
try {
  cached.conn = await cached.promise;
} catch (err) {
  cached.promise = null;
  throw err;
}
```

### BUG-02: Node model `INode` interface not extending `Document`

**File:** `branch-chat/src/models/Node.ts`, lines 18-27
**Severity:** Low

The `INode` interface is a standalone interface rather than extending `Document` as specified in the Architecture Document (§4.4). The execution log notes this was intentional to avoid a `model` field name conflict with `Document.model()`. This is an acceptable deviation — the standalone interface avoids the naming collision while preserving all required fields. The `model()` export on line 29 is untyped (`model('Node', NodeSchema)` without `<INode>`) which means consumers won't get typed query results without casting, but this will be addressed when consumers are implemented.

**Note:** This is flagged for awareness but is an **acceptable deviation** given the Mongoose `Document.model()` conflict.

## Security

No security issues found in this feature. The database layer consists only of:
- A connection singleton (no auth, no user input)
- Schema definitions (no query logic, no user-facing endpoints)

Security assessment is not applicable for pure model definitions. Security will be relevant when API routes consume these models (F-03 and beyond).

## Architecture Alignment

| Aspect | Spec | Implementation | Status |
|---|---|---|---|
| File: `src/lib/db.ts` | Mongoose 9 connection singleton | Exact match | **Aligned** |
| File: `src/models/User.ts` | IUser + UserSchema + User export | Exact match (minus `_id: string` in interface — see below) | **Aligned** |
| File: `src/models/ApiKey.ts` | IApiKey + ApiKeySchema + ApiKey export | Exact match | **Aligned** |
| File: `src/models/Conversation.ts` | IConversation + ConversationSchema + Conversation export | Exact match | **Aligned** |
| File: `src/models/Node.ts` | INode + NodeSchema + Node export | Structural match, interface doesn't extend Document | **Acceptable deviation** |
| mongoose version | 9.3.3 | `^9.3.3` in package.json | **Aligned** |
| All indexes | As specified in CLAUDE.md | All present and correct | **Aligned** |
| Folder location | `src/models/` | `branch-chat/src/models/` | **Aligned** (under `branch-chat/` project root) |

### Deviation: IUser and IApiKey omit `_id: string`

The Architecture Document specifies `_id: string` in the `IUser`, `IApiKey`, `IConversation`, and `INode` interfaces. The implementation omits `_id` from `IUser`, `IApiKey`, and `IConversation` (relying on Mongoose `Document`'s built-in `_id`), and declares `_id: Types.ObjectId` in `INode`. The execution log explains this was due to a Mongoose 9 type conflict. This is an **acceptable deviation** — Mongoose `Document` already provides `_id`, and manually declaring it as `string` causes type errors in Mongoose 9.

## Forward Compatibility

### FC-01: Connection singleton is ready for all downstream features
The `connectDB()` function will be called by every API route handler. The caching pattern is correct for Next.js hot-reload. **Compatible.**

### FC-02: User model supports F-03 (Authentication)
F-03 needs `User.findOne({ email })` and `User.create({ email, hashedPassword })`. The schema supports both. The `unique` index on `email` ensures the 409 conflict check works. **Compatible.**

### FC-03: ApiKey model supports F-05 (API Key Management)
F-05 needs CRUD on API keys with `userId` + `provider` lookup. The compound unique index enables upsert behavior for `PUT /api/settings/api-keys/[provider]`. **Compatible.**

### FC-04: Conversation model supports F-06 (Conversation Management)
All fields needed for `GET /api/conversations`, `POST /api/conversations`, `PATCH /api/conversations/[id]`, and `DELETE /api/conversations/[id]` are present. **Compatible.**

### FC-05: Node model supports F-07 (Chat/Branching)
The parent-pointer tree structure with `conversationId`, `parentId`, `role`, `content`, `provider`, and `model` supports all tree operations specified in CLAUDE.md (getPathToRoot, buildChildrenMap, findDescendants). **Compatible.**

### FC-06: `defaultProvider` type is `string` in CLAUDE.md but enum in implementation
CLAUDE.md specifies `defaultProvider: string` in the IConversation interface, but the Task Breakdown and Architecture Document specify an enum. The enum is stricter and correct — if a new provider is added later, the enum must be updated. This is a minor rigidity but acceptable since provider additions are a planned schema change anyway.

### FC-07: BUG-01 (connection retry) affects all downstream features
If BUG-01 is not fixed, any transient MongoDB outage during cold start will permanently break the app until restarted. This affects every feature that calls `connectDB()`.

## Summary
- Critical issues: 0
- Medium issues: 1 (BUG-01: connection retry)
- Low issues: 1 (BUG-02: INode not extending Document — acceptable deviation)
- Recommendation: **REQUIRES_REVISION**

The single medium issue (BUG-01) is a straightforward fix in `src/lib/db.ts` — add error handling to reset the cached promise on failure.
