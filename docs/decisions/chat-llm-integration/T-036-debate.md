# T-036 Deliberation: LLM Chat Orchestration Endpoint

## PROPOSER

I propose implementing `src/app/api/llm/chat/route.ts` following the 12-step orchestration from Architecture Document §5.4:

### Implementation Approach

**File:** `src/app/api/llm/chat/route.ts`

**Steps:**
1. Parse `{ conversationId, parentNodeId, content, provider, model }` from request body
2. Validate: provider against PROVIDERS constant keys, model against MODELS[provider] entries, content non-empty
3. `auth()` check — 401 if no session
4. Load conversation by ID, verify `userId === session.user.id` — 403 if wrong owner
5. Decrypt API key: `ApiKey.findOne({ userId, provider })` → `decrypt()` — 422 if missing. **Exception:** mock provider skips key lookup entirely when `NODE_ENV === 'development'`
6. Load all nodes: `Node.find({ conversationId }).lean()`
7. Build `nodesMap` (Map<string, TreeNode>), get model context limit from MODELS constant, call `buildContext(parentNodeId, content, nodesMap, contextLimit)`
8. Insert user node: `Node.create({ conversationId, parentId: parentNodeId, role: 'user', content, provider: null, model: null })`
9. If `parentNodeId === null` (first message), update `conversation.rootNodeId = userNode._id`
10. Call `getProvider(provider).sendMessage(messages, model, decryptedKey)`
11. On success: insert assistant node with `parentId = userNode._id, role: 'assistant', provider, model`, return `{ userNode, assistantNode }` with 201
12. On failure: keep user node (already saved), classify error:
    - Rate limit (429 from upstream) → 429
    - Invalid API key → 502 with "Invalid API key"
    - Timeout → 504
    - Other → 502 with "[provider] API error"

**Error classification strategy:** Each provider SDK throws different error types:
- OpenAI: `APIError` with `status` property
- Anthropic: `APIError` with `status` property
- Gemini: Generic errors with message strings
- I'll check for `status === 429` for rate limiting, `status === 401` for invalid key, and use a generic catch for everything else.

**Node response format:** Convert Mongoose docs to match `NodeResponse` interface: `{ id: _id.toString(), parentId: parentId?.toString() ?? null, role, content, provider, model, createdAt: createdAt.toISOString() }`.

## CRITIC

**Concern 1: Provider validation is too strict.** The task says validate provider against "allowed list" and model against MODELS constant. But the `mock` provider should only be valid when `NODE_ENV === 'development'`. The Proposer mentions mock exception for key lookup but doesn't explicitly filter mock from validation in production. 

**Concern 2: Error classification needs refinement.** The Proposer's approach of checking `status === 429` and `status === 401` is reasonable for OpenAI and Anthropic (both use `APIError` with status codes), but Gemini's `@google/genai` SDK may throw different error shapes. We should wrap the entire LLM call in try/catch and use a pattern that handles all three SDKs.

**Concern 3: CastError handling.** If `conversationId` or `parentNodeId` are invalid ObjectIds, Mongoose will throw `CastError`. The existing API routes handle this pattern — we need it here too.

**Concern 4: Race condition on rootNodeId.** If two requests for the same conversation arrive simultaneously with `parentNodeId === null`, both would try to set `rootNodeId`. This is unlikely in practice (UI prevents it) but worth noting. Since we're not doing transactions, we accept this minor risk.

**Concern 5: Node serialization helper.** Multiple places will need to convert Mongoose node docs to `NodeResponse`. Should we create a shared helper? No — this is the only route that returns `NodeResponse` in this format. The existing nodes GET route already does its own serialization. Keep it inline to avoid premature abstraction.

## MEDIATOR

The Proposer's approach is sound and follows the architecture precisely. Incorporating the Critic's valid concerns:

1. **Mock provider validation:** Add a check — if `provider === 'mock'` and `NODE_ENV !== 'development'`, return 400.
2. **Error handling:** Use a generic try/catch around the LLM call. Check for `status` property on error objects (works for OpenAI and Anthropic). For errors without status, default to 502.
3. **CastError handling:** Wrap the entire handler in try/catch with CastError check (return 400), matching the pattern used in other API routes.
4. **Race condition:** Accept the minor risk. No transaction needed.
5. **Serialization:** Inline, no shared helper.

### FINAL IMPLEMENTATION PLAN

See `T-036-plan.md`.
