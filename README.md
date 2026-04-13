# BranchChat

A chat interface that lets you branch conversations like a tree. Ask an AI a question, then explore different follow-ups from the same point without losing any thread.

## Features

- **Branching conversations.** Branch off from any message to explore alternate directions. Every message is a node in a tree, and you can create new branches from any point. Navigate between branches freely, and view the full conversation structure in an interactive tree visualization.

- **Multiple AI providers.** Chat with OpenAI, Anthropic (Claude), and Google Gemini from one interface. Switch models mid-conversation, so you can ask Claude a question and then get a second opinion from GPT on the same thread. The model selector groups models by provider with color coding so you can tell at a glance what you're talking to.

- **Token usage tracking.** A dedicated usage page shows how many input and output tokens you've used, broken down per model, along with total call counts. Useful for keeping an eye on API costs.

- **File attachments.** Attach images and files to your messages. Each provider handles attachments in its own format under the hood, but from your side you just drop a file in and it works.

- **Streaming responses.** Responses stream in token by token as the model generates them, so you don't have to wait for the full reply before you start reading.

- **Extended thinking.** For models that support it (Claude's Sonnet/Opus and OpenAI's o-series), you can enable a thinking mode that shows the model's internal reasoning in a collapsible block above the response. You can toggle this on and off per message.

- **Web search.** Enable web search on any message to let the model pull in live information. Cited sources show up as clickable links in the response. Available for all three providers.

- **Dark mode.** Light, dark, and system themes. Switch between them with a single button in the header.

- **Export and import.** Save any conversation as a JSON file and re-import it later. The export includes the full tree structure, so branches are preserved.

## Setup

```bash
cd branch-chat
npm install
docker run -d -p 27017:27017 --name branch-chat-mongo mongo:7
cp .env.example .env.local   # add your API keys
npm run dev                  # localhost:3000
```

## Documentation

See [docs/](docs/) for architecture, task breakdowns, and design decisions.
