import { AIProvider, AIProviderType, AIResponse, AIRequestContext } from '../types';

export abstract class BaseAIProvider implements AIProvider {
  abstract name: string;
  abstract type: AIProviderType;

  protected apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  abstract enhance(context: AIRequestContext): Promise<AIResponse>;

  protected buildPrompt(context: AIRequestContext): string {
    const { title, content, imageBase64, customPrompt } = context;
    const hasImage = Boolean(imageBase64);

    // If user provided custom prompt, use it with context
    if (customPrompt) {
      return `
You are an expert AI assistant helping with notes and learning.
IMPORTANT: Always respond in Vietnamese (Tiếng Việt).

${title ? `Note Title: "${title}"` : ''}
${content ? `Note Content: "${content}"` : ''}
${hasImage ? 'An image is also attached for reference.' : ''}

User's Request: ${customPrompt}

Respond in JSON format (content must be in Vietnamese):
{
  "title": "Tiêu đề rõ ràng, ngắn gọn bằng tiếng Việt",
  "content": "Nội dung phản hồi bằng tiếng Việt, định dạng Markdown",
  "tags": ["tag1", "tag2", "tag3"]
}
      `.trim();
    }

    // Default prompt for analysis
    return `
You are an expert tutor helper. The user has provided a note.
IMPORTANT: Always respond in Vietnamese (Tiếng Việt).

${title ? `Title: "${title}"` : ''}
${content ? `Content: "${content}"` : ''}
${hasImage ? 'An image is also attached.' : ''}

Task:
1. Analyze the provided information ${hasImage ? "including the image" : ""}.
2. If it contains formulas, explain what they are, variables, and usage.
3. If it is a concept, summarize it clearly.
4. Format the output with clear Markdown (bolding, lists).
5. Suggest 3 relevant short tags in Vietnamese.

Respond in JSON format (all content must be in Vietnamese):
{
  "title": "Tiêu đề rõ ràng, ngắn gọn bằng tiếng Việt",
  "content": "Giải thích chi tiết bằng tiếng Việt, định dạng Markdown",
  "tags": ["tag1", "tag2", "tag3"]
}
    `.trim();
  }
}
