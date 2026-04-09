# Prompt Caching (Claude-only) — Audit Report (Cycle 1)
Date: 2026-04-09
Tasks covered: T-106, T-107

## Spec Compliance

### T-106: Add cache_control Breakpoints to Anthropic Provider

| # | Acceptance Criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | System prompt content block has `cache_control` when present | **PASS** | `buildSystemParam()` at line 25-28 of `src/lib/providers/anthropic.ts` returns `{ system: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }] }` when systemText is non-empty. |
| 2 | Last message content block has `cache_control` | **PASS** | `buildAnthropicMessages()` at lines 13-19 wraps the last message's text into a content block array with `cache_control: { type: 'ephemeral' }`. |
| 3 | Applied in both `sendMessage` and `streamMessage` | **PASS** | Both methods call `buildSystemParam(systemText)` and `buildAnthropicMessages(nonSystemMessages)` — shared helper functions apply cache_control uniformly. `sendMessage` at line 47-48, `streamMessage` at line 77-78. |
| 4 | No `cache_control` in database/stored data | **PASS** | `cache_control` only appears in `src/lib/providers/anthropic.ts`. Not present in any model, route handler, or database code. Added dynamically at request-build time. |
| 5 | Exactly 2 breakpoints used | **PASS** | One on system content block, one on last message. Test at lines 99-127 of the test file explicitly counts and asserts `cacheControlCount === 2`. |
| 6 | `npm run build` passes | **PASS** | Build completes successfully with no errors. |

### T-107: Write Tests for Prompt Caching

| # | Acceptance Criterion | Status | Evidence |
|---|----------------------|--------|----------|
| 1 | Cache control breakpoint placement verified in tests | **PASS** | `__tests__/lib/providers/anthropic.test.ts` — tests verify `cache_control` on system block (lines 54-67, 131-148) and last message block (lines 69-85, 150-168). |
| 2 | Both sendMessage and streamMessage covered | **PASS** | Two describe blocks: `sendMessage` (lines 53-128) with 4 tests, `streamMessage` (lines 130-185) with 3 tests. |
| 3 | All tests pass | **PASS** | 7 tests, all passing (verified via `npx vitest run`). |
| 4 | `npm run build` passes | **PASS** | Confirmed. |

## Bug Detection

No bugs found.

The implementation is clean and minimal:
- `buildAnthropicMessages()` correctly handles the case where `lastMsg.content` is a string (extracts it) before wrapping in a content block array.
- `buildSystemParam()` correctly returns an empty object `{}` when systemText is empty/falsy, which means spread into the request adds no `system` key — correct behavior.
- Both `sendMessage` and `streamMessage` share the same helper functions, preventing divergence.
- Error handling in `streamMessage` catches errors and yields an error chunk.

## Security

No security issues found.

This feature is entirely localized to the Anthropic provider file. It does not:
- Introduce new API routes
- Accept user input
- Modify authentication or authorization
- Expose API keys (key is read from `process.env.ANTHROPIC_API_KEY` at runtime)
- Store sensitive data in new locations

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| File modified | `src/lib/providers/anthropic.ts` | `src/lib/providers/anthropic.ts` | **Match** |
| System breakpoint | `system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }]` | `buildSystemParam()` returns exactly this | **Match** |
| Last message breakpoint | Last message content wrapped with `cache_control` | `buildAnthropicMessages()` wraps last message | **Match** |
| Applied to both methods | `sendMessage` and `streamMessage` | Both use shared helpers | **Match** |
| Test file location | `__tests__/lib/providers/anthropic.test.ts` | `__tests__/lib/providers/anthropic.test.ts` | **Match** |
| No extra files | Only anthropic.ts modified + test file added | Confirmed | **Match** |

No deviations from the architecture.

## Forward Compatibility

| Concern | Assessment |
|---------|------------|
| F-22 (File Attachments) interaction | The delta doc warns that `cache_control` must be applied AFTER building full content blocks including attachments. Currently `buildAnthropicMessages()` applies `cache_control` to text-only content. When F-22 adds attachments, the helper will need to be updated to apply `cache_control` to the fully-built content array (with attachment blocks). The current implementation does NOT block F-22 — it just needs to be extended. The spec explicitly anticipated this: "For now, apply it to the text-only messages. F-22 will need to ensure cache_control is on the fully-built content blocks." **Compatible.** |
| Streaming + caching order | Delta doc section 12.7 specifies the order: separate system → build messages with attachments → add cache_control → start stream. Current implementation follows this order (system separated first, then messages built with cache_control, then stream started). **Compatible.** |
| Max 4 breakpoints limit | Using exactly 2 breakpoints leaves room for future additions if needed. **Compatible.** |

## CLAUDE.md Updates

No updates needed — CLAUDE.md is accurate. The Anthropic provider section already documents `cache_control` is not part of the stored interface, and the provider description matches the implementation. The feature is localized to the provider file and doesn't change any interfaces, API contracts, or data models documented in CLAUDE.md.

## Summary
- Critical issues: 0
- Medium issues: 0
- Low issues: 0
- CLAUDE.md updates: 0
- Recommendation: **PROCEED**
