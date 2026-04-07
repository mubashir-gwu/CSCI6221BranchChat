# F-19: File-Based Logging — Audit Report (Cycle 2)
Date: 2026-04-07
Tasks covered: T-090, T-091, T-092, T-093

## Cycle 1 Remediation Status

All three medium issues from Cycle 1 have been addressed:

| # | Cycle 1 Issue | Status | Evidence |
|---|---------------|--------|----------|
| 1 | `fs.appendFileSync` blocks event loop | **FIXED** | `logger.ts` now uses `async writeLog()` with `fs.promises.appendFile` (line 46) and `fs.promises.mkdir` (line 24). Convenience methods fire-and-forget. |
| 2 | Unauthenticated requests not logged | **FIXED** | All 9 authenticated routes now log `Route entered` before the auth check and `logger.warn('Unauthorized request', ...)` on 401. Verified in all route files. |
| 3 | `providers/route.ts` missing try/catch | **FIXED** | Route body wrapped in try/catch with `logger.error('Route error', ...)` (line 26) and 500 response (line 27). |

## Spec Compliance

### T-090: Create Logger Module and Configure Log Directory

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Importing and calling `logger.info('test')` writes a JSON line to `logs/app.log` | **PASS** | `src/lib/logger.ts` uses `fs.promises.appendFile` to write JSON lines to `logs/app.log`. Test `writes a JSON line to the log file` passes. |
| 2 | Log levels are respected (e.g., `LOG_LEVEL=WARN` suppresses INFO and DEBUG) | **PASS** | `shouldLog()` at line 16–18 compares level indexes. Test `respects log level filtering` confirms filtering works. |
| 3 | `logs/` directory is gitignored | **PASS** | `.gitignore` line 37: `logs/` |
| 4 | `npm run build` passes | **PASS** | Build completed successfully. |

Additional spec items:
- **Log levels TRACE/DEBUG/INFO/WARN/ERROR**: **PASS** — Defined at line 4.
- **Configurable via `LOG_LEVEL` env var, default INFO**: **PASS** — `getMinLevel()` reads `process.env.LOG_LEVEL`, defaults to `'INFO'`.
- **JSON line format with timestamp, level, message, context**: **PASS** — `writeLog()` constructs JSON with these fields.
- **Auto-create `logs/` directory**: **PASS** — `ensureLogDir()` at lines 20–26 uses `fs.promises.mkdir({ recursive: true })`.
- **Convenience methods trace/debug/info/warn/error**: **PASS** — Exported at lines 49–54.
- **Each method accepts `(message, context?)`**: **PASS** — Type signature matches.
- **`LOG_LEVEL` added to `.env.example`**: **PASS** — Line 7: `LOG_LEVEL=INFO`.

### T-091: Add Logging to API Routes

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Every API route logs entry, exit, and errors | **PASS** | All 10 route files have `Route entered`, `Route completed`, and `Route error` log calls. |
| 2 | LLM chat route logs provider, model, token count, and duration | **PASS** | `llm/chat/route.ts` lines 185 and 188: `LLM call started` with provider/model/messageCount, `LLM call completed` with provider/model/inputTokens/outputTokens/durationMs. |
| 3 | Log entries include `requestId` for correlation | **PASS** | Every route generates `crypto.randomUUID()` and includes it in the context object. |
| 4 | Logs appear in `logs/app.log` as JSON lines | **PASS** | Logger writes JSON lines via `fs.promises.appendFile`. |
| 5 | `npm run build` passes | **PASS** | Build completed successfully. |

Routes instrumented (all 10 verified):
- `src/app/api/auth/register/route.ts` — Entry/exit/error, registration success/failure.
- `src/app/api/conversations/route.ts` — GET and POST both instrumented.
- `src/app/api/conversations/[id]/route.ts` — PATCH and DELETE both instrumented.
- `src/app/api/conversations/[id]/nodes/route.ts` — GET instrumented.
- `src/app/api/conversations/[id]/nodes/[nodeId]/route.ts` — DELETE instrumented.
- `src/app/api/conversations/[id]/export/route.ts` — GET instrumented.
- `src/app/api/llm/chat/route.ts` — POST instrumented with detailed LLM logging.
- `src/app/api/import/route.ts` — POST instrumented.
- `src/app/api/providers/route.ts` — GET instrumented.
- `src/app/api/token-usage/route.ts` — GET instrumented.

### T-092: Add Logging to Auth and Database Operations

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Auth login attempts and outcomes are logged | **PASS** | `src/lib/auth.ts` line 21: `Auth: login attempt`; line 25: `Auth: login failed` (user not found); line 30: `Auth: login failed` (invalid password); line 33: `Auth: login success`. |
| 2 | Database connection events are logged (with credentials masked) | **PASS** | `src/lib/db.ts` line 17: `Database: connecting` with URI masked via `.replace(/\/\/.*@/, '//***@')`; line 22: `Database: connected`; line 25: `Database: connection failed`. |
| 3 | Auto-title generation is logged | **PASS** | `src/app/api/llm/chat/route.ts` line 26: `Auto-title: generating`; line 56: `Auto-title: success`; line 229: `Auto-title: failed`. |
| 4 | `npm run build` passes | **PASS** | Build completed successfully. |

### T-093: Write Tests for Logger Module

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All tests pass via `npm test` | **FAIL** | 6 of 7 tests pass. The `supports all log levels` test fails — see Bug Detection below. |
| 2 | `npm run build` passes | **PASS** | Build completed successfully. |

## Bug Detection

1. **File: `__tests__/lib/logger.test.ts`, test "supports all log levels" — Race condition in async fire-and-forget writes causes non-deterministic log ordering**
   - The test calls `logger.trace("t"); logger.debug("d"); logger.info("i"); logger.warn("w"); logger.error("e")` in rapid succession and expects them to appear in that exact order. However, the Cycle 1 fix changed `writeLog` to be async, and the convenience methods fire-and-forget (they don't return/await the promise). Each call independently does `await ensureLogDir()` then `await appendFile()`. Since they're all independent promises racing, the writes can interleave and complete out of order.
   - Observed result: `["TRACE", "DEBUG", "WARN", "ERROR", "INFO"]` instead of expected `["TRACE", "DEBUG", "INFO", "WARN", "ERROR"]`.
   - **Fix:** The test's 50ms `flush()` is insufficient to guarantee ordering. Two options: (a) serialize writes in the logger using a write queue/chain so each `appendFile` awaits the previous one, or (b) have the convenience methods return the promise so tests can `await` them sequentially. Option (a) is preferred since it preserves fire-and-forget semantics at call sites while ensuring log order correctness — log ordering is important in production too, not just tests.
   - **Severity:** Medium

## Security

No security issues found.

- **No secrets logged**: Database URI credentials masked in `db.ts` line 17. API keys never logged.
- **No user content logged**: Message content is not written to logs — only metadata.
- **Unauthorized attempts logged**: All routes now log `Unauthorized request` warnings on 401, providing visibility into failed access attempts.
- **Log file location**: `logs/app.log` is server-side only, gitignored.
- **No log injection risk**: `JSON.stringify` handles special characters safely.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| Logger location | `src/lib/logger.ts` | `src/lib/logger.ts` | **Match** |
| Log output | `logs/app.log` | `logs/app.log` | **Match** |
| Log format | JSON lines with timestamp, level, message, context | JSON lines with timestamp, level, message, context + extra fields | **Match** |
| Log levels | TRACE, DEBUG, INFO, WARN, ERROR | TRACE, DEBUG, INFO, WARN, ERROR | **Match** |
| Config via env var | `LOG_LEVEL`, default INFO | `LOG_LEVEL`, default INFO | **Match** |
| I/O method | `fs.promises.appendFile` or `fs.appendFileSync` | `fs.promises.appendFile` (async) | **Match** |
| Test location | `__tests__/lib/logger.test.ts` | `__tests__/lib/logger.test.ts` | **Match** |
| `logs/` gitignored | Yes | Yes | **Match** |

No unexpected files. No missing files. Data flow matches the architecture.

## Forward Compatibility

No forward compatibility concerns. F-19 is the last feature. The logger module has a clean, extensible interface.

## Summary
- Critical issues: 0
- Medium issues: 1
- Low issues: 0
- Recommendation: **FIX FIRST**

The single remaining issue is a race condition introduced by the Cycle 1 fix (sync→async). The async `writeLog` calls can interleave, causing non-deterministic log ordering. This manifests as a test failure and is also a correctness concern in production (log lines could appear out of chronological call order under high concurrency).
