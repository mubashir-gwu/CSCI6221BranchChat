# File Attachments (F-22) — Audit Report (Cycle 3)
Date: 2026-04-09
Tasks covered: T-108, T-109, T-110, T-111, T-112, T-113, T-114, T-115, T-116

## Cycle 2 Fix Verification

Both low-severity issues from Cycle 2 have been fixed:

1. **Bug #2 FIXED:** `FileUploadArea.tsx` now uses `useMemo` (lines 102-110) to create blob URLs keyed by `File` object, and `useEffect` (lines 112-118) to revoke all URLs on cleanup. No more blob URL leaks.
2. **Bug #3 FIXED:** All `LLMAttachment` test fixtures in `__tests__/lib/providers/attachmentFormatter.test.ts` now include the `size` field — `imageAttachment` (1024), `pdfAttachment` (2048), `textAttachment` (11), `markdownAttachment` (11), `csvAttachment` (11), and the inline fixture at line 146 (33).

## Spec Compliance

### T-108: Add Attachment Schema to Node Model and Update Types
- **PASS:** Node schema has `attachments` subdocument array with `{filename, mimeType, data, size, _id: false}` — `src/models/Node.ts:11-17`.
- **PASS:** `Attachment` interface defined in `src/models/Node.ts:25-30` and `DBAttachment` in `src/types/database.ts:20-25`.
- **PASS:** `DBNode` includes `attachments?: DBAttachment[]` — `src/types/database.ts:35`.
- **PASS:** `LLMChatRequest` includes `attachments?` — `src/types/api.ts:75`.
- **PASS:** `ExportedTree` nodes include `attachments?` — `src/types/export.ts:13`.
- **PASS:** `TreeNode` type includes `attachments?` — `src/types/tree.ts:8`.
- **PASS:** No index changes made.

### T-109: Create Attachment Formatter Utility
- **PASS:** `formatAttachmentsForProvider` exported from `src/lib/providers/attachmentFormatter.ts:71-86`.
- **PASS:** Anthropic format correct — images as `type: 'image'` with base64 source, PDFs as `type: 'document'` with base64 source, text as `type: 'text'` with decoded content.
- **PASS:** OpenAI format correct — images as `image_url` with data URI, PDFs as `file` with `file_data` data URI, text inline.
- **PASS:** Gemini format correct — images/PDFs as `inlineData`, text inline with decoded content.
- **PASS:** Mock returns empty array.
- **PASS:** Text files decoded from base64 to UTF-8 via `Buffer.from(base64, 'base64').toString('utf-8')`.
- **PASS:** Both `text/plain` and `text/markdown` handled as text files.

### T-110: Update Context Builder to Include Attachments
- **PASS:** Attachments from all path nodes included in message array — `src/lib/contextBuilder.ts:39-46`.
- **PASS:** `LLMMessage.attachments` populated from `node.attachments` with all fields including `size`.
- **PASS:** Token estimation accounts for attachment size — `estimateMessageTokens` reads `att.size` at line 8.

### T-111: Add Attachment Validation and Integration in Chat Route
- **PASS:** Body size check rejects >20MB with 413 — `src/app/api/llm/chat/route.ts:83-87`.
- **PASS:** File count ≤5 validated — line 147.
- **PASS:** Per-file ≤5MB validated — line 156.
- **PASS:** Total ≤10MB validated — line 165.
- **PASS:** MIME type allowlist correct (8 types) — lines 140-144.
- **PASS:** Attachments saved on user node — line 258.
- **PASS:** All providers use `formatAttachmentsForProvider` — confirmed in `openai.ts:9`, `anthropic.ts:13`, `gemini.ts:20/29/70`.
- **PASS:** Anthropic cache_control applied after attachment content blocks — `src/lib/providers/anthropic.ts:26-40`.

### T-112: Update Mock Provider to Acknowledge Attachments
- **PASS:** `getAttachmentPrefix` extracts filenames — `src/lib/providers/mock.ts:14-21`.
- **PASS:** Both `sendMessage` (line 32) and `streamMessage` (line 55) use prefix.
- **PASS:** Format: `"I see you've attached: [filenames]. "`.

### T-113: Create FileUploadArea Component and Integrate into ChatInput
- **PASS:** Props match spec — `src/components/chat/FileUploadArea.tsx:18-22`.
- **PASS:** Paperclip icon button opens hidden file input — lines 131-141.
- **PASS:** Drag-and-drop supported — `onDragOver`/`onDrop` handlers, lines 86-97.
- **PASS:** Preview chips shown with remove button — lines 143-172 (images: thumbnail from memoized blob URL, PDFs: FileText icon, text: generic icon).
- **PASS:** Client-side validation: 5 files (line 47), 5MB/file (line 55), 10MB total (line 59), extensions (line 51), toast on errors.
- **PASS:** Files read as base64 via `readAsDataURL` with prefix stripping — `ChatInput.tsx:28-40`.
- **PASS:** Files cleared after send — `ChatInput.tsx:93`.
- **PASS:** Disabled during streaming — `ChatInput.tsx:70, 109`.
- **PASS:** Blob URLs properly managed with `useMemo` + `useEffect` cleanup — lines 102-118.

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
- **PASS:** `__tests__/lib/providers/attachmentFormatter.test.ts` exists — covers all provider formats, text decoding, markdown/CSV handling, and all fixtures include `size` field.
- **PASS:** `__tests__/api/llm-chat.test.ts` has attachment validation tests — valid save, >5 files, >5MB, >10MB total, invalid MIME, >20MB body.
- **PASS:** `__tests__/api/import-export.test.ts` has attachment round-trip tests (export includes, import restores).
- **PASS:** All 61 tests pass across all 3 test files.

## Bug Detection

### Bug #2 (Cycle 1/2) — RESOLVED
Blob URLs are now properly managed via `useMemo` for creation and `useEffect` for cleanup. No memory leak.

### Bug #3 (Cycle 2) — RESOLVED
All test fixtures now include the `size` field, matching the `LLMAttachment` interface contract.

**No new bugs found.**

## Security

- **Auth:** Chat route correctly calls `auth()` and checks `session.user.id` (line 99-103). Conversation ownership verified (line 177). Export and import routes also check auth and ownership. No bypass found.
- **Data isolation:** All queries filter by `userId` or verify ownership. No cross-user access possible.
- **API key exposure:** No secrets in client-side code. Provider API keys read from `process.env` server-side only.
- **Input validation:** Attachment MIME types validated server-side (lines 140-144, 159). File sizes validated server-side (lines 156, 165). Content-Length checked (lines 83-87). Attachment fields validated for presence (line 153).
- **File upload validation:** Both client-side (FileUploadArea) and server-side (chat route) validation present. MIME types, file sizes, and file counts validated on both sides.
- **No issues found.**

## Architecture Alignment

- **Folder structure:** `attachmentFormatter.ts` in `src/lib/providers/` — matches Architecture Delta §6.
- **FileUploadArea** in `src/components/chat/` — matches Architecture Delta §5/§6.
- **Node schema:** Matches spec exactly (`attachments` subdocument array, `_id: false`) — matches Architecture Delta §3.1.
- **API contracts:** Request shape matches (attachments in POST body). Validation error codes match (400 for validation, 413 for body size) — matches Architecture Delta §4.1.
- **Provider integration:** All four providers (OpenAI, Anthropic, Gemini, Mock) correctly use `formatAttachmentsForProvider` — matches Architecture Delta §7.
- **LLMAttachment type:** Defined in `src/lib/providers/types.ts` with `size` field — matches Architecture Delta §3.4 (acceptable enhancement for token estimation).
- **Data flow:** Client → base64 encoding → POST body → server validation → save on user node → context builder includes in path → providers format per-provider. Matches Architecture Delta §4.1 orchestration flow.
- **Export/Import:** Attachments included in export, restored on import — matches Architecture Delta §4.5.
- **No unexpected files or missing files.**

## Forward Compatibility

- **LLMAttachment interface** includes `size` field, flexible for future use.
- **formatAttachmentsForProvider** is cleanly separated — new providers just need a new case in the switch.
- **Base64 storage in MongoDB** is a known tradeoff documented in architecture decisions. No hardcoded assumptions that would need undoing.
- **No forward compatibility concerns identified.**

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- CLAUDE.md updates: 0
- Recommendation: **PROCEED**
