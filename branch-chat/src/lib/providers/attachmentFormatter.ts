import { LLMAttachment } from './types';

function isTextFile(mimeType: string): boolean {
  return (
    mimeType === 'text/plain' ||
    mimeType === 'text/markdown' ||
    mimeType === 'text/csv'
  );
}

function decodeBase64ToText(base64: string): string {
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function formatForAnthropic(attachments: LLMAttachment[]): unknown[] {
  return attachments.map((att) => {
    if (isTextFile(att.mimeType)) {
      const text = decodeBase64ToText(att.data);
      return { type: 'text', text: `[File: ${att.filename}]\n${text}` };
    }
    if (att.mimeType === 'application/pdf') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: att.data },
      };
    }
    // Images
    return {
      type: 'image',
      source: { type: 'base64', media_type: att.mimeType, data: att.data },
    };
  });
}

function formatForOpenAI(attachments: LLMAttachment[]): unknown[] {
  return attachments.map((att) => {
    if (isTextFile(att.mimeType)) {
      const text = decodeBase64ToText(att.data);
      return { type: 'input_text', text: `[File: ${att.filename}]\n${text}` };
    }
    if (att.mimeType === 'application/pdf') {
      return {
        type: 'input_file',
        file_data: `data:application/pdf;base64,${att.data}`,
        filename: att.filename,
      };
    }
    // Images
    return {
      type: 'input_image',
      image_url: `data:${att.mimeType};base64,${att.data}`,
    };
  });
}

function formatForGemini(attachments: LLMAttachment[]): unknown[] {
  return attachments.map((att) => {
    if (isTextFile(att.mimeType)) {
      const text = decodeBase64ToText(att.data);
      return { text: `[File: ${att.filename}]\n${text}` };
    }
    // Images and PDFs
    return {
      inlineData: { mimeType: att.mimeType, data: att.data },
    };
  });
}

export function formatAttachmentsForProvider(
  attachments: LLMAttachment[],
  provider: string,
): unknown[] {
  switch (provider) {
    case 'anthropic':
      return formatForAnthropic(attachments);
    case 'openai':
      return formatForOpenAI(attachments);
    case 'gemini':
      return formatForGemini(attachments);
    case 'mock':
    default:
      return [];
  }
}
