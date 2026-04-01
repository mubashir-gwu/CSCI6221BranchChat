# Export & Import — Audit Report (Cycle 1)
Date: 2026-04-01
Tasks covered: T-054, T-055, T-056, T-057, T-058

## Spec Compliance

### T-054: Implement Export API Route

| Criterion | Status | Evidence |
|-----------|--------|----------|
| `GET /api/conversations/:id/export` returns JSON with `Content-Disposition: attachment` (FR-032) | **PASS** | `src/app/api/conversations/[id]/export/route.ts:63-68` — returns `NextResponse` with `Content-Disposition: attachment` header and `application/json` content type. |
| Exported JSON contains all nodes with correct parentId, childrenIds, provider, model, timestamps (FR-032) | **PASS** | Lines 45-59 — maps each node to include `id`, `parentId`, `childrenIds` (computed from childrenMap), `role`, `content`, `provider`, `model`, `createdAt`. |
| `version: 1` field present | **PASS** | Line 46 — `version: 1` is set in the exported tree. |
| `npm run build` passes | **PASS** | Build succeeds with route listed as `ƒ /api/conversations/[id]/export`. |

### T-055: Implement Import Validation

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Valid trees pass validation | **PASS** | `src/lib/tree.ts:68-106` — `validateTreeIntegrity` implements all three checks. Test confirms valid tree passes. |
| Multiple roots → error | **PASS** | Line 71 — filters for `parentId === null`, throws if count ≠ 1. Test `returns 400 for multiple roots` confirms. |
| Orphaned parentIds → error | **PASS** | Lines 74-81 — checks all non-null parentIds exist in the id set. Test `returns 400 for orphaned parentId references` confirms. |
| Disconnected nodes → error | **PASS** | Lines 83-105 — BFS from root, checks `reachable.size !== nodes.length`. Test `returns 400 for disconnected tree` confirms. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-056: Implement Import API Route

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Valid JSON import creates a new conversation with all nodes (FR-033) | **PASS** | `src/app/api/import/route.ts:60-101` — creates conversation via `Conversation.create`, inserts remapped nodes via `Node.insertMany`, returns 201 with `conversationId`, `title`, `nodeCount`. |
| All IDs are regenerated (no conflicts with existing data) | **PASS** | Lines 63-65 — creates `idMap` with new `Types.ObjectId()` for every node. Test `regenerates all IDs` confirms no original IDs appear in inserted nodes. |
| Parent-child relationships preserved after ID remapping | **PASS** | Lines 82-91 — `parentId` is remapped via `idMap.get(node.parentId)`. Test `preserves parent-child relationships after ID remapping` verifies root→user→assistant chain. |
| Invalid JSON returns 400 with error message (FR-033) | **PASS** | Lines 18-25 — catches JSON parse failure, returns 400. Lines 29-33 — checks for missing `jsonData`. |
| Malformed tree returns 400 (FR-033) | **PASS** | Lines 51-58 — catches `validateTreeIntegrity` error and returns 400 with error message. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-057: Wire Export/Import Buttons in UI

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Export button downloads a `.json` file (FR-032) | **PASS** | `src/app/(protected)/chat/[conversationId]/page.tsx:233-254` — `handleExport` fetches export endpoint, creates blob URL, triggers `<a>` click download with filename from `Content-Disposition` header. Button rendered at line 297-299. |
| Import button opens file picker, processes JSON, creates conversation (FR-033) | **PASS** | `src/components/sidebar/ConversationList.tsx:27-74` — hidden `<input type="file" accept=".json">` triggered by Import button. `handleImport` reads file, parses JSON, POSTs to `/api/import`, dispatches `ADD_CONVERSATION`, navigates to new conversation. |
| Import errors show descriptive toast (FR-033) | **PASS** | Lines 37-39 — invalid JSON shows `"Invalid JSON file"` toast. Lines 47-50 — API errors show server error message via toast. Line 69 — network errors show generic toast. |
| After import, user can navigate and branch from imported tree (FR-033) | **PASS** | Line 67 — `router.push(/chat/${data.conversationId})` navigates to the imported conversation, which loads nodes normally via the chat page's `useEffect`. |
| `npm run build` passes | **PASS** | Confirmed. |

### T-058: Write Tests for Export and Import

| Criterion | Status | Evidence |
|-----------|--------|----------|
| All tests pass via `npm test` | **PASS** | 16/16 tests pass in `__tests__/api/import-export.test.ts`. |
| Round-trip integrity verified (NFR-009) | **PASS** | Test `produces identical tree structure (NFR-009)` at line 425 — exports, imports, verifies same node count, same content, same tree shape. |

## Bug Detection

No bugs found. Specific checks performed:

- **Null/undefined handling**: Export route correctly handles `n.parentId?.toString() || null` (line 51) and `n.provider ?? null` (line 56). Import route handles `node.parentId ? idMap.get(node.parentId)! : null` (line 85) and `node.createdAt ? new Date(node.createdAt) : new Date()` (line 90).
- **CastError handling**: Export route catches Mongoose CastError for invalid ID formats (lines 71-73).
- **JSON parse safety**: Import route wraps `request.json()` in try/catch (lines 18-25).
- **Empty nodes array**: Import validates `nodes.length === 0` (lines 43-48).
- **File input cleanup**: ConversationList resets `fileInputRef.current.value = ""` after import (line 72).
- **Blob URL cleanup**: Chat page calls `URL.revokeObjectURL(url)` after download (line 250).

## Security

No issues found. Specific checks performed:

- **Auth enforcement**: Both export (`route.ts:12-15`) and import (`route.ts:11-14`) check `session?.user?.id` and return 401 if missing.
- **Data isolation**: Export route filters by `userId: session.user.id` (line 22-25). Import creates conversation owned by `session.user.id` (line 74).
- **No secret exposure**: No API keys or secrets appear in client-side code or export data.
- **Input validation**: Import validates version, tree structure, and JSON format before database operations.
- **Mongoose injection**: Import route only uses validated data for database inserts. No raw user input is passed directly to query selectors.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| Export route path | `src/app/api/conversations/[id]/export/route.ts` | Same | **Match** |
| Import route path | `src/app/api/import/route.ts` | Same | **Match** |
| Validation function location | `src/lib/tree.ts` | Same | **Match** |
| Export type definition | `src/types/export.ts` | Same | **Match** |
| Test file | `__tests__/api/import-export.test.ts` | Same | **Match** |
| Export button location | Chat page header/toolbar | Chat page header bar (line 297-299) | **Match** |
| Import button location | ConversationList | ConversationList sidebar header (line 115-121) | **Match** |
| ExportedTree interface | `{ version: 1, exportedAt, title, nodes[] }` | Matches exactly | **Match** |
| Import response | `201 { conversationId, title, nodeCount }` | Matches (line 95-101) | **Match** |
| Export response | JSON with `Content-Disposition: attachment` | Matches (line 63-68) | **Match** |

**Acceptable deviation**: The import route hardcodes `defaultProvider: "openai"` and `defaultModel: "gpt-4o"` (line 76-77) for newly created conversations. The spec says "user's default provider/model" but there is no user-level default setting in the data model — only conversation-level defaults. Hardcoding OpenAI is a reasonable fallback consistent with how the "New Conversation" dialog works.

## Forward Compatibility

| Concern | Assessment |
|---------|-----------|
| **F-12: Error Handling & Polish** | Export and import routes already have comprehensive error handling with try/catch, appropriate status codes, and descriptive error messages. No changes needed for F-12. |
| **ExportedTree versioning** | `version: 1` field allows future format evolution. Import validates `version === 1` and rejects others. Forward-compatible. |
| **validateTreeIntegrity reusability** | Function accepts `ExportedTree['nodes']` — could be reused for any tree validation scenario. Well-isolated in `src/lib/tree.ts`. |

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- Recommendation: **PROCEED**
