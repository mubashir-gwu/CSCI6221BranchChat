# T-033 Implementation Plan: Mock, OpenAI, Anthropic, and Gemini Providers

## Step 1: Install SDKs
```bash
npm install openai@6.33.0 @anthropic-ai/sdk@0.80.0 @google/genai@1.47.0
```

## Step 2: Implement `src/lib/providers/mock.ts`
- Export `mockProvider` satisfying `LLMProvider` interface
- `sendMessage`: sleep 1 second, return canned Markdown response
- Canned response includes heading, bold text, list items, and a code block

## Step 3: Implement `src/lib/providers/openai.ts`
- Import `OpenAI` from `'openai'` (default export, SDK v6)
- Export `openaiProvider` satisfying `LLMProvider`
- `sendMessage`: create `new OpenAI({ apiKey })`, call `client.chat.completions.create({ model, messages })`
- Return `{ content: response.choices[0].message.content ?? '', provider: 'openai', model }`

## Step 4: Implement `src/lib/providers/anthropic.ts`
- Import `Anthropic` from `'@anthropic-ai/sdk'` (default export, SDK v0.80)
- Export `anthropicProvider` satisfying `LLMProvider`
- Extract system messages: filter for `role === 'system'`, join content with `\n`
- Non-system messages go to `messages` param
- Call `client.messages.create({ model, max_tokens: 4096, system?, messages })`
- Map response: `response.content[0].text`

## Step 5: Implement `src/lib/providers/gemini.ts`
- Import `{ GoogleGenAI }` from `'@google/genai'` (v1.47)
- Export `geminiProvider` satisfying `LLMProvider`
- Map history (all but last message): `assistant` → `model`, everything else → `user`; parts: `[{ text: content }]`
- Create chat: `ai.chats.create({ model, history })`
- Send: `chat.sendMessage({ message: lastMessage.content })`
- Return `{ content: response.text, provider: 'gemini', model }`

## Step 6: Update `src/lib/providers/index.ts`
- Import all four provider objects
- Register openai, anthropic, gemini unconditionally
- Register mock only when `process.env.NODE_ENV === 'development'`
- Keep existing `registerProvider` and `getProvider` exports

## Verification
- `npm run build` must pass
