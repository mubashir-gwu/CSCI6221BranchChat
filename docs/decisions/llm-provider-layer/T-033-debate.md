# T-033 Deliberation: Mock, OpenAI, Anthropic, and Gemini Providers

## PROPOSER

I propose implementing all four providers following the Architecture Document §7.6 exactly, plus updating `index.ts` to register them.

### Files and approach:

**1. `src/lib/providers/mock.ts`**
- Export a `mockProvider: LLMProvider` that sleeps 1s via `new Promise(resolve => setTimeout(resolve, 1000))`, returns canned Markdown.
- Canned response uses the exact string from the task description.

**2. `src/lib/providers/openai.ts`**
- Import `OpenAI` from `'openai'` (SDK v6 — default export).
- Create client per-call: `new OpenAI({ apiKey })`.
- Call `client.chat.completions.create({ model, messages })`.
- Map response: `response.choices[0].message.content`.
- Return `{ content, provider: 'openai', model }`.

**3. `src/lib/providers/anthropic.ts`**
- Import `Anthropic` from `'@anthropic-ai/sdk'` (SDK v0.80 — default export).
- Extract system messages: filter `messages` for `role === 'system'`, join content with newlines.
- Filter remaining messages (non-system) for the `messages` param.
- Call `client.messages.create({ model, max_tokens: 4096, system: systemText, messages: nonSystemMessages })`.
- Map response: `response.content[0].text`.
- Return `{ content, provider: 'anthropic', model }`.

**4. `src/lib/providers/gemini.ts`**
- Import `{ GoogleGenAI }` from `'@google/genai'` (v1.47).
- Create `ai = new GoogleGenAI({ apiKey })`.
- Map history (all but last message): `role: msg.role === 'assistant' ? 'model' : 'user'`, `parts: [{ text: msg.content }]`.
- Filter out system messages from history (Gemini doesn't support system role in history) — prepend system content to first user message instead.
- Create chat: `ai.chats.create({ model, history })`.
- Send last message: `chat.sendMessage({ message: lastMessage.content })`.
- Return `{ content: response.text, provider: 'gemini', model }`.

**5. `src/lib/providers/index.ts`**
- Import all four providers.
- Register openai, anthropic, gemini unconditionally.
- Register mock only when `process.env.NODE_ENV === 'development'`.

**6. Install SDKs**: `npm install openai@6.33.0 @anthropic-ai/sdk@0.80.0 @google/genai@1.47.0`

### Edge cases:
- OpenAI can return `null` for content — handle with fallback empty string.
- Anthropic response `content` is an array of content blocks — take `[0].text`.
- Gemini system messages: the Architecture Document shows mapping all messages to user/model roles. System messages should be handled by prepending to first user message or using Gemini's system instruction param.

## CRITIC

**1. SDK creation per-call vs. singleton:**
Creating a new SDK client per `sendMessage` call is intentional — each user has their own API key. No issue here.

**2. Anthropic system message extraction:**
The Proposer says to join system messages with newlines. The Anthropic SDK v0.80 `system` param accepts a string. This is correct. But we should also handle the case where there are no system messages — pass `undefined` for system, not empty string.

**3. Gemini system messages:**
The Architecture Doc §7.6 shows `role: m.role === 'assistant' ? 'model' : 'user'` — it maps everything non-assistant to 'user', including system. This is a simplification. The `@google/genai` v1.47 API actually supports a `systemInstruction` config in `chats.create`. However, the Architecture Doc doesn't specify that. We should follow the Architecture Doc exactly: map system → user in the history.

**4. Gemini `chat.sendMessage` signature:**
Architecture Doc shows `chat.sendMessage({ message: lastMessage })` where `lastMessage` is the text content. Verify: in `@google/genai` v1.47, `sendMessage` takes `{ message: string }`. The Proposer's approach is correct.

**5. Mock registration:**
The `process.env.NODE_ENV` check at module-load time is fine since Next.js inlines this.

**6. Error handling:**
The task says providers should just throw on errors — the LLM chat route (T-036, F-08) handles error classification. No try/catch wrappers needed in providers themselves beyond what the SDKs throw.

**7. `response.text` for Gemini:**
In `@google/genai` v1.47, the response from `chat.sendMessage` has a `.text` property. This matches the Architecture Doc.

## MEDIATOR

### FINAL IMPLEMENTATION PLAN

1. **Install SDKs**: `npm install openai@6.33.0 @anthropic-ai/sdk@0.80.0 @google/genai@1.47.0`

2. **`mock.ts`**: Sleep 1s, return canned Markdown. Export as `LLMProvider` object.

3. **`openai.ts`**: New client per-call. `client.chat.completions.create({ model, messages })`. Content fallback to empty string if null.

4. **`anthropic.ts`**: Extract system messages (join with `\n`), pass as `system` param if non-empty (otherwise omit). Filter non-system for `messages`. `max_tokens: 4096`.

5. **`gemini.ts`**: Follow Architecture Doc exactly — map assistant→model, system→user in history. Use `ai.chats.create({ model, history })` + `chat.sendMessage({ message })`.

6. **`index.ts`**: Import all providers, register. Mock conditional on `NODE_ENV === 'development'`.

7. No error handling wrappers — let SDK exceptions propagate naturally.
