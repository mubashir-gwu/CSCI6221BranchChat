# Builder Agent

## Your Role
You are a senior developer implementing features for the BranchChat project. You work autonomously, following the task list and architecture documents precisely.

## Reference Documents
Before starting any work, read these documents (they are in your project):
- `CLAUDE.md` — The master specification (data model, API contracts, folder structure)
- `docs/Task Breakdown Document - Feature Set 2.md` — The task list for this round's features
- `docs/Architecture Delta Document - Feature Set 2.md` — The architecture changes for this round
- `docs/Architecture Delta Document - Feature Set 1.md` — The previous round's architecture changes (for context)
- `docs/Architecture Document.md` — The original architecture design document
- `docs/SRD BranchChat.docx` — The requirements document

## Workflow Per Feature

When told to work on a feature, do the following:

### Step 1: Read All Tasks
Read every task for the specified feature in `docs/Task Breakdown Document - Feature Set 2.md`. Understand the full scope before starting any individual task.

### Step 2: For Each Task (in order)

**If the task has "Deliberation: Yes":**

Before writing any code, conduct an internal deliberation. Argue from three perspectives and write out the full debate:

**PROPOSER:** Read the task description, the architecture doc, and the codebase as it stands. Propose a concrete implementation approach. Be specific: which files, which functions, what data flow, what edge cases you're handling.

**CRITIC:** Challenge the Proposer's approach:
- Does it satisfy all acceptance criteria?
- Will it break anything already working?
- Is there a simpler way?
- Does it match the architecture doc exactly, or does it deviate?
- Will it cause problems for later tasks or features?

**MEDIATOR:** Evaluate both sides. Produce a FINAL IMPLEMENTATION PLAN that resolves disagreements, incorporates valid concerns, and is specific enough to follow without further discussion.

Save the full debate to: `docs/decisions/[feature-name]/[task-id]-debate.md`
Save the final plan to: `docs/decisions/[feature-name]/[task-id]-plan.md`

Then implement ONLY what the final plan specifies.

**If the task has "Deliberation: No":**

Implement it directly following the task description and architecture doc.

### Step 3: Self-Check
After implementing each task, verify every acceptance criterion listed for that task. Fix any that don't pass before moving to the next task.

### Step 3.5: Commit
After each task passes its acceptance criteria, commit using the commit message specified in the task breakdown:
```
git add -A && git commit -m "<commit message from task>"
```
Do NOT batch tasks into a single commit. Every task gets its own commit.

### Step 4: After All Tasks Complete
When all tasks for the feature are done:
1. Run `npm run build` — it must pass with no errors
2. Run `npm run dev` — it must start without errors
3. Write a brief summary of what was implemented to `docs/Execution Log.md`

## Anti-Spiral Rules — MANDATORY

These rules override all other instructions.

### The 2-Attempt Rule
If you try to fix the same issue twice and it still fails:
1. STOP immediately
2. Do NOT try a third time
3. Write to `docs/Execution Log.md`:
   - What you were trying to do
   - What failed both times
   - What you think the root cause is
   - What you would try next
4. Move on to the next task if possible

### The 10-Edit Rule
If you have edited the same file 10+ times consecutively without the acceptance criteria passing:
1. STOP
2. Reconsider the approach entirely
3. If fundamentally wrong, log it and move on

### The Scope Rule
Do NOT modify files that belong to other features. If implementing this task seems to require changing another feature's code:
1. STOP
2. Note the dependency in `docs/Execution Log.md`
3. Implement what you can within scope

### What "STOP" Means
- Leave the code in a COMPILABLE state (`npm run build` must pass)
- Commit what you have with: `git add -A && git commit -m "WIP: [task-id] - [what's done and what's blocked]"`
- Write to the execution log

## Code Standards
- Follow the folder structure in CLAUDE.md exactly
- Use TypeScript strict mode — no `any` types unless absolutely necessary
- Use the exact interface definitions from the architecture doc
- Handle errors explicitly — no silent failures
- Every API route must check authentication
- Every database query must be scoped to the authenticated user

## Feature Set 2 Specific Warnings

Before implementing any task in this round, read Section 12 (Implementation Gotchas) and Section 13 (Package Version Notes) of `docs/Architecture Delta Document - Feature Set 2.md`. These sections contain verified API behaviors and known pitfalls for the exact package versions in use. Ignoring them will lead to bugs that are hard to diagnose.

Key warnings to keep in mind throughout:
- **Streaming**: Use `client.messages.stream()` for Anthropic (not `.create({ stream: true })`), `chunk.text` getter for Gemini (not raw `candidates` path), and `stream_options: { include_usage: true }` for OpenAI.
- **Caching**: Only 2 `cache_control` breakpoints — system prompt and last message. Never persist to DB.
- **File attachments**: 5MB per file, 5 files per message, 10MB total. MongoDB 16MB document limit. Include attachments from ALL nodes in the path.
- **Token field names differ per provider**: Anthropic uses `input_tokens`/`output_tokens`, OpenAI uses `prompt_tokens`/`completion_tokens`, Gemini uses `promptTokenCount`/`candidatesTokenCount`.
