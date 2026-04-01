# T-036 Final Implementation Plan: LLM Chat Orchestration Endpoint

## File
`src/app/api/llm/chat/route.ts`

## Implementation

```typescript
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    // 1. Parse and validate request body
    const body = await request.json();  // wrapped in try/catch for malformed JSON
    const { conversationId, parentNodeId, content, provider, model } = body;
    
    // Validate required fields
    if (!conversationId || !content?.trim() || !provider || !model) → 400
    
    // Validate provider against PROVIDERS keys
    if (!(provider in PROVIDERS)) → 400
    
    // Mock only in development
    if (provider === 'mock' && process.env.NODE_ENV !== 'development') → 400
    
    // Validate model against MODELS[provider]
    if (!MODELS[provider].some(m => m.id === model)) → 400
    
    // 2. Auth check
    const session = await auth();
    if (!session?.user?.id) → 401
    
    // 3. Verify conversation ownership
    await connectDB();
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) → 404
    if (conversation.userId.toString() !== session.user.id) → 403
    
    // 4. Decrypt API key (skip for mock)
    let apiKey = '';
    if (provider !== 'mock') {
      const keyDoc = await ApiKey.findOne({ userId: session.user.id, provider });
      if (!keyDoc) → 422 "No API key found for [provider]."
      apiKey = decrypt(keyDoc.encryptedKey, keyDoc.iv, keyDoc.authTag);
    }
    
    // 5. Load all nodes, build context
    const rawNodes = await Node.find({ conversationId }).lean();
    const nodesMap = new Map(rawNodes.map(n => [
      n._id.toString(),
      { id: n._id.toString(), parentId: n.parentId?.toString() ?? null, role: n.role, content: n.content, provider: n.provider, model: n.model, createdAt: n.createdAt.toISOString() }
    ]));
    
    const modelDef = MODELS[provider].find(m => m.id === model);
    const messages = buildContext(parentNodeId, content, nodesMap, modelDef.contextWindow);
    
    // 6. Insert user node
    const userNode = await Node.create({
      conversationId, parentId: parentNodeId, role: 'user', content: content.trim(), provider: null, model: null
    });
    
    // 7. If first message, set rootNodeId
    if (parentNodeId === null) {
      await Conversation.findByIdAndUpdate(conversationId, { rootNodeId: userNode._id });
    }
    
    // 8. Call LLM
    try {
      const llmResponse = await getProvider(provider).sendMessage(messages, model, apiKey);
      
      // 9. Insert assistant node
      const assistantNode = await Node.create({
        conversationId, parentId: userNode._id, role: 'assistant', content: llmResponse.content, provider, model
      });
      
      // 10. Return both nodes
      return NextResponse.json({
        userNode: serializeNode(userNode),
        assistantNode: serializeNode(assistantNode),
      }, { status: 201 });
      
    } catch (llmError) {
      // Keep user node for retry. Classify error.
      const err = llmError as any;
      if (err.status === 429) → 429 "Rate limited by [provider]."
      if (err.status === 401) → 502 "Invalid API key"
      → 502 "[provider] API error"
    }
    
  } catch (outerError) {
    // CastError → 400, otherwise 500
  }
}

function serializeNode(doc): NodeResponse {
  return { id: doc._id.toString(), parentId: doc.parentId?.toString() ?? null, role: doc.role, content: doc.content, provider: doc.provider ?? null, model: doc.model ?? null, createdAt: doc.createdAt.toISOString() };
}
```

## Acceptance Criteria Verification
- [x] Returns `{ userNode, assistantNode }` with correct fields → 201
- [x] Missing API key → 422 with exact message
- [x] Mock provider works without API key in dev
- [x] Rate limit → 429
- [x] Invalid key → 502
- [x] User node preserved on LLM failure
- [x] First message sets rootNodeId
- [x] maxDuration = 60 exported
