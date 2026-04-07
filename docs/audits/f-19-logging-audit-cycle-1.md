# F-19: File-Based Logging — Audit Report (Cycle 1)
Date: 2026-04-07
Tasks covered: T-090, T-091, T-092, T-093

## Spec Compliance

### T-090: Create Logger Module and Configure Log Directory

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Importing and calling `logger.info('test')` writes a JSON line to `logs/app.log` | **PASS** | `src/lib/logger.ts` uses `fs.appendFileSync` to write JSON lines to `logs/app.log`. Confirmed by test `writes a JSON line to the log file` in `__tests__/lib/logger.test.ts`. |
| 2 | Log levels are respected (e.g., `LOG_LEVEL=WARN` suppresses INFO and DEBUG) | **PASS** | `shouldLog()` at line 16–18 compares level indexes. Test `respects log level filtering` confirms `LOG_LEVEL=ERROR` suppresses INFO/WARN. |
| 3 | `logs/` directory is gitignored | **PASS** | `.gitignore` line 37: `logs/` |
| 4 | `npm run build` passes | **PASS** | Build completed successfully. |

Additional spec items:
- **Log levels TRACE/DEBUG/INFO/WARN/ERROR**: **PASS** — Defined at line 4 of `logger.ts`.
- **Configurable via `LOG_LEVEL` env var, default INFO**: **PASS** — `getMinLevel()` reads `process.env.LOG_LEVEL`, defaults to `'INFO'`.
- **JSON line format with timestamp, level, message, context**: **PASS** — `writeLog()` constructs JSON with these fields.
- **Auto-create `logs/` directory**: **PASS** — `ensureLogDir()` at line 20–24 uses `mkdirSync({ recursive: true })`.
- **Convenience methods trace/debug/info/warn/error**: **PASS** — Exported at lines 47–53.
- **Each method accepts `(message, context?)`**: **PASS** — Type signature matches.
- **`LOG_LEVEL` added to `.env.example`**: **PASS** — Line 7: `LOG_LEVEL=INFO`.

### T-091: Add Logging to API Routes

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Every API route logs entry, exit, and errors | **PASS** | All 10 route files have `Route entered`, `Route completed`, and `Route error` log calls. See details below. |
| 2 | LLM chat route logs provider, model, token count, and duration | **PASS** | `llm/chat/route.ts` lines 184 and 187: `LLM call started` with provider/model/messageCount, `LLM call completed` with provider/model/inputTokens/outputTokens/durationMs. |
| 3 | Log entries include `requestId` for correlation | **PASS** | Every route generates `crypto.randomUUID()` and includes it in the context object. |
| 4 | Logs appear in `logs/app.log` as JSON lines | **PASS** | Logger writes JSON lines via `appendFileSync`. Confirmed `logs/app.log` exists with content. |
| 5 | `npm run build` passes | **PASS** | Build completed successfully. |

Routes instrumented:
- `src/app/api/auth/register/route.ts` — Entry/exit/error logging, registration success/failure logged.
- `src/app/api/conversations/route.ts` — GET and POST both instrumented.
- `src/app/api/conversations/[id]/route.ts` — PATCH and DELETE both instrumented.
- `src/app/api/conversations/[id]/nodes/route.ts` — GET instrumented.
- `src/app/api/conversations/[id]/nodes/[nodeId]/route.ts` — DELETE instrumented.
- `src/app/api/conversations/[id]/export/route.ts` — GET instrumented.
- `src/app/api/llm/chat/route.ts` — POST instrumented with detailed LLM logging.
- `src/app/api/import/route.ts` — POST instrumented.
- `src/app/api/providers/route.ts` — GET instrumented.
- `src/app/api/token-usage/route.ts` — GET instrumented.

Note: T-091 references `src/app/api/usage/route.ts` but the actual route is `src/app/api/token-usage/route.ts` per CLAUDE.md. The correct file is instrumented. Acceptable deviation (task doc typo).

### T-092: Add Logging to Auth and Database Operations

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Auth login attempts and outcomes are logged | **PASS** | `src/lib/auth.ts` line 21: `Auth: login attempt`; line 25: `Auth: login failed` (user not found); line 30: `Auth: login failed` (invalid password); line 33: `Auth: login success`. |
| 2 | Database connection events are logged (with credentials masked) | **PASS** | `src/lib/db.ts` line 17: `Database: connecting` with URI masked via `.replace(/\/\/.*@/, '//***@')`; line 22: `Database: connected`; line 25: `Database: connection failed`. |
| 3 | Auto-title generation is logged | **PASS** | `src/app/api/llm/chat/route.ts` line 26: `Auto-title: generating`; line 56: `Auto-title: success`; line 229: `Auto-title: failed` in catch block. |
| 4 | `npm run build` passes | **PASS** | Build completed successfully. |

### T-093: Write Tests for Logger Module

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | All tests pass via `npm test` | **PASS** | 7 tests pass in `__tests__/lib/logger.test.ts`. |
| 2 | `npm run build` passes | **PASS** | Build completed successfully. |

Tests implemented:
- `writes a JSON line to the log file` — Verifies JSON output with level, message, timestamp.
- `includes context in log entries` — Verifies context object is preserved.
- `includes extra fields in log entries` — Verifies additional fields (status, durationMs).
- `respects log level filtering` — LOG_LEVEL=ERROR suppresses INFO/WARN.
- `creates the logs directory if it does not exist` — Directory auto-creation.
- `contains timestamp, level, and message fields` — Field presence and format.
- `supports all log levels` — All 5 levels write when LOG_LEVEL=TRACE.

All tests use temp directories to avoid polluting the real `logs/` directory, as specified.

## Bug Detection

1. **File: `src/lib/logger.ts`, line 44 — Synchronous file I/O blocks event loop**
   - `fs.appendFileSync` is used instead of `fs.promises.appendFile`. Synchronous I/O blocks the Node.js event loop on every log call, which degrades request throughput under load.
   - **Fix:** Replace `fs.appendFileSync` with `fs.promises.appendFile` (make `writeLog` async). The exported convenience methods should call the async version fire-and-forget (no need to await logging).
   - **Severity:** Medium

2. **Files: `src/app/api/conversations/route.ts`, `src/app/api/conversations/[id]/route.ts`, `src/app/api/conversations/[id]/nodes/route.ts`, `src/app/api/conversations/[id]/nodes/[nodeId]/route.ts`, `src/app/api/conversations/[id]/export/route.ts`, `src/app/api/llm/chat/route.ts`, `src/app/api/import/route.ts`, `src/app/api/providers/route.ts`, `src/app/api/token-usage/route.ts` — Unauthenticated requests not logged**
   - In all authenticated routes, the "Route entered" log is placed after the auth check. Unauthenticated requests (401s) are silently dropped with no log trail. This is a security visibility gap — failed auth attempts against protected endpoints should be logged for intrusion detection.
   - **Fix:** Move the `logger.info('Route entered', ...)` call to before the auth check in every route. For routes where `userId` is not yet available, log without it. After the auth check fails, log a warning: `logger.warn('Unauthorized request', { context: { route, method, requestId } })` before returning 401.
   - **Severity:** Medium

3. **File: `src/app/api/providers/route.ts` — No try/catch error logging**
   - The providers route has no try/catch block. If `getAvailableProviders()` throws an unexpected error, it will bubble up as an unhandled exception with no log entry, making debugging impossible.
   - **Fix:** Wrap the body in a try/catch and add `logger.error('Route error', ...)` in the catch block, consistent with all other routes.
   - **Severity:** Medium

## Security

No security issues found related to the logging feature.

- **No secrets logged**: Database URI credentials are masked in `db.ts` line 17 using regex replacement. API keys are never logged anywhere.
- **No user content logged**: Message content is not written to logs — only metadata (provider, model, token counts).
- **Auth state properly checked**: All routes check authentication before logging user-identifiable data.
- **Log file location**: `logs/app.log` is server-side only, within the project directory, and gitignored.
- **No log injection risk**: JSON.stringify handles special characters safely.

## Architecture Alignment

| Aspect | Specified | Implemented | Status |
|--------|-----------|-------------|--------|
| Logger location | `src/lib/logger.ts` | `src/lib/logger.ts` | **Match** |
| Log output | `logs/app.log` | `logs/app.log` | **Match** |
| Log format | JSON lines with timestamp, level, message, context | JSON lines with timestamp, level, message, context + extra fields | **Match** |
| Log levels | TRACE, DEBUG, INFO, WARN, ERROR | TRACE, DEBUG, INFO, WARN, ERROR | **Match** |
| Config via env var | `LOG_LEVEL`, default INFO | `LOG_LEVEL`, default INFO | **Match** |
| Test location | `__tests__/lib/logger.test.ts` | `__tests__/lib/logger.test.ts` | **Match** |
| `logs/` gitignored | Yes | Yes | **Match** |
| `logs/.gitkeep` | Shown in folder structure | Not present | **Acceptable deviation** — `.gitkeep` inside a gitignored directory would itself be ignored. The logger auto-creates the directory, making `.gitkeep` unnecessary. |

No unexpected files created. No missing files. Data flow matches the architecture.

## Forward Compatibility

No forward compatibility concerns. F-19 is the last feature in the task breakdown. The logger module is self-contained with a clean interface (`logger.trace/debug/info/warn/error`) that could be extended if needed without breaking existing call sites.

The `extra` parameter pattern (accepting `Record<string, unknown>`) is flexible enough to accommodate any future logging needs without interface changes.

## Summary
- Critical issues: 0
- Medium issues: 3
- Low issues: 0
- Recommendation: **FIX FIRST**
