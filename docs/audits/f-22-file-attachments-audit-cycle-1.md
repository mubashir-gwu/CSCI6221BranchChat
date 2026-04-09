# File Attachments (F-22) — Audit Report (Cycle 1)
Date: 2026-04-09
Tasks covered: T-108, T-109, T-110, T-111, T-112, T-113, T-114, T-115, T-116

## Spec Compliance

### T-108: Add Attachment Schema to Node Model and Update Types
- **PASS:** Node schema has `attachments` subdocument array with `{filename, mimeType, data, size, _id: false}` — `src/models/Node.ts:11-17`.
- **PASS:** `Attachment` interface defined in `src/models/Node.ts:25-30` and `DBAttachment` in `src/types/database.ts:20-25`.
- **PASS:** `DBNode` includes `attachments?: DBAttachment[]` — `src/types/database.ts:35`.
- **PASS:** `LLMChatRequest` includes `attachments?` — `src/types/api.ts:75`.
- **PASS:** `ExportedTree` nodes include `attachments?` — `src/types/export.ts:13`.
- **PASS:** No index changes made.

### T-109: Create Attachment Formatter Utility
- **PASS:** `formatAttachmentsForProvider` exported from `src/lib/providers/attachmentFormatter.ts:71-86`.
- **PASS:** Anthropic format correct — images as `type: 'image'`, PDFs as `type: 'document'`, text as `type: 'text'` with decoded content.
- **PASS:** OpenAI format correct — images as `image_url` with data URI, PDFs as `file` with `file_data` data URI, text inline.
- **PASS:** Gemini format correct — images/PDFs as `inlineData`, text inline.
- **PASS:** Mock returns empty array.
- **PASS:** Text files decoded from base64 to UTF-8 via `Buffer.from(base64, 'base64').toString('utf-8')`.
- **PASS:** Both `text/plain` and `text/markdown` handled as text files.

### T-110: Update Context Builder to Include Attachments
- **PASS:** Attachments from all path nodes included in message array — `src/lib/contextBuilder.ts:39-45`.
- **PASS:** `LLMMessage.attachments` populated from `node.attachments`.
- **PARTIAL:** Token estimation calls `att.size` (line 8), but the mapping at lines 40-44 drops the `size` field. See Bug #1 below.

### T-111: Add Attachment Validation and Integration in Chat Route
- **PASS:** Body size check rejects >20MB with 413 — `src/app/api/llm/chat/route.ts:83-87`.
- **PASS:** File count ≤5 validated — line 147.
- **PASS:** Per-file ≤5MB validated — line 156.
- **PASS:** Total ≤10MB validated — line 165.
- **PASS:** MIME type allowlist correct (8 types) — lines 140-144.
- **PASS:** Attachments saved on user node — line 257.
- **PASS:** Providers use `formatAttachmentsForProvider` — confirmed in openai.ts:9, anthropic.ts:13, gemini.ts:20/29/70.
- **PASS:** Anthropic cache_control applied after attachment content blocks — `src/lib/providers/anthropic.ts:26-40`.

### T-112: Update Mock Provider to Acknowledge Attachments
- **PASS:** `getAttachmentPrefix` extracts filenames — `src/lib/providers/mock.ts:14-21`.
- **PASS:** Both `sendMessage` (line 32) and `streamMessage` (line 55) use prefix.
- **PASS:** Format: `"I see you've attached: [filenames]. "`.

### T-113: Create FileUploadArea Component and Integrate into ChatInput
- **PASS:** Props match spec — `src/components/chat/FileUploadArea.tsx:18-22`.
- **PASS:** Paperclip icon button opens hidden file input — lines 112-122.
- **PASS:** Drag-and-drop supported — `onDragOver`/`onDrop` handlers, lines 86-97.
- **PASS:** Preview chips shown with remove button — lines 124-154 (images: thumbnail, PDFs: FileText icon, text: generic icon).
- **PASS:** Client-side validation: 5 files (line 47), 5MB/file (line 55), 10MB total (line 59), extensions (line 51), toast on errors.
- **PASS:** Files read as base64 via `readAsDataURL` with prefix stripping — `ChatInput.tsx:28-40`.
- **PASS:** Files cleared after send — `ChatInput.tsx:93`.
- **PASS:** Disabled during streaming — `ChatInput.tsx:70, 109`.

### T-114: Update ChatMessage to Display Attachment Previews
- **PASS:** Image attachments render as thumbnails with `max-h-48 rounded` — `ChatMessage.tsx:204-209`.
- **PASS:** Images clickable to open full size in new tab — wrapped in `<a target="_blank">`.
- **PASS:** PDF attachments render as clickable chips with FileText icon — lines 213-228.
- **PASS:** Text attachments render as expandable chips with `atob()` decoding — lines 230-258.
- **PASS:** No attachment UI when empty/undefined — conditional at line 127.

### T-115: Update Export and Import to Include Attachments
- **PASS:** Export includes `attachments` field — `export/route.ts:66`.
- **PASS:** Import restores `attachments` — `import/route.ts:114`.

### T-116: Write Tests for File Attachments
- **PASS:** `__tests__/lib/providers/attachmentFormatter.test.ts` exists — covers all provider formats and text decoding.
- **PASS:** `__tests__/api/llm-chat.test.ts` has attachment validation tests — valid save, >5 files, >5MB, >10MB total, invalid MIME, >20MB body.
- **PASS:** `__tests__/api/import-export.test.ts` has attachment round-trip tests.

## Bug Detection

### Bug #1: `size` field dropped in context builder attachment mapping (Medium)
**File:** `src/lib/contextBuilder.ts:40-44`
**Description:** When mapping historical node attachments to `LLMAttachment`, the `size` field is omitted:
```typescript
msg.attachments = n.attachments.map((att) => ({
  filename: att.filename,
  mimeType: att.mimeType,
  data: att.data,
  // MISSING: size: att.size
}));
```
The `estimateMessageTokens` function (line 8) reads `att.size` to estimate attachment token cost. Without `size`, `Math.ceil(undefined / 4)` produces `NaN`, which propagates through `totalTokens`, causing the truncation `while` loop condition (`totalTokens > effectiveLimit`) to always evaluate `false` (since `NaN > N` is `false`). This effectively disables context truncation for any conversation that has attachments in its history.

**Same issue in chat route:** `src/app/api/llm/chat/route.ts:208-213` also drops `size` when mapping request attachments to `llmAttachments` passed as `newAttachments` to `buildContext`.

**Impact:** Context window overflow possible for conversations with many/large attachments.

### Bug #2: `URL.createObjectURL` memory leak in FileUploadArea (Low)
**File:** `src/components/chat/FileUploadArea.tsx:133`
**Description:** `URL.createObjectURL(file)` is called on every render for image thumbnails but `URL.revokeObjectURL` is never called. Blob URLs accumulate in memory during a session. Low severity — typical usage with ≤5 files means negligible impact.

## Security

- **Auth:** Chat route correctly calls `auth()` and checks `session.user.id` (line 99-103). Conversation ownership verified (line 177). Export and import routes also check auth and ownership. No bypass found.
- **Data isolation:** All queries filter by `userId` or verify ownership. No cross-user access possible.
- **API key exposure:** No secrets in client-side code. Provider API keys read from `process.env` server-side only.
- **Input validation:** Attachment MIME types validated server-side (lines 140-144, 159). File sizes validated server-side (lines 156, 165). Content-Length checked (lines 83-87). Attachment fields validated for presence (line 153).
- **File upload validation:** Both client-side (FileUploadArea) and server-side (chat route) validation present. MIME types, file sizes, and file counts validated on both sides.
- **No issues found.**

## Architecture Alignment

- **Folder structure:** `attachmentFormatter.ts` in `src/lib/providers/` — matches spec.
- **FileUploadArea** in `src/components/chat/` — matches spec.
- **Node schema:** Matches spec exactly (`attachments` subdocument array, `_id: false`).
- **API contracts:** Request shape matches (attachments in POST body). Validation error codes match (400 for validation, 413 for body size).
- **Provider integration:** All four providers (OpenAI, Anthropic, Gemini, Mock) correctly use `formatAttachmentsForProvider`. Anthropic's `cache_control` applied after attachment blocks.
- **Data flow:** Client → base64 encoding → POST body → server validation → save on user node → context builder includes in path → providers format per-provider. Correct.
- **No unexpected files or missing files.**

## Forward Compatibility

- **LLMAttachment interface** has `size` field which is flexible for future use.
- **formatAttachmentsForProvider** is cleanly separated — new providers just need a new case.
- **Base64 storage in MongoDB** is a known tradeoff documented in architecture decisions. No hardcoded assumptions that would need undoing.
- **No forward compatibility concerns identified.**

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate. The file attachment feature is documented in the Node data model (attachments not stored per spec since they're optional), and the component table already lists ChatMessage with its behavior. The folder structure correctly shows `attachmentFormatter.ts` is not listed individually but falls under the providers directory which is correct for the level of detail in CLAUDE.md.

## Summary
- Critical issues: 0
- Medium issues: 1 (Bug #1: `size` field dropped in context builder, breaking token estimation for attachments)
- Low issues: 1 (Bug #2: `URL.createObjectURL` memory leak in FileUploadArea)
- CLAUDE.md updates: 0
- Recommendation: **FIX FIRST**
