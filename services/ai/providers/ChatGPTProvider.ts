import { BaseAIProvider } from './BaseAIProvider';
import { AIProviderType, AIResponse, AIRequestContext } from '../types';

export class ChatGPTProvider extends BaseAIProvider {
  name = 'OpenAI ChatGPT';
  type: AIProviderType = 'chatgpt';

  private readonly API_URL = 'https://api.openai.com/v1/chat/completions';
  private readonly MODEL_NAME = 'gpt-4o-mini';

  async enhance(context: AIRequestContext): Promise<AIResponse> {
    if (!this.isConfigured) {
      throw new Error("ChatGPT API Key is not configured.");
    }

    try {
      const messages: any[] = [];

      // Build content array for the user message
      const content: any[] = [];

      // Add image if available
      if (context.imageBase64) {
        const imageUrl = context.imageBase64.startsWith('data:')
          ? context.imageBase64
          : `data:image/jpeg;base64,${context.imageBase64}`;
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }

      // Add text prompt
      content.push({
        type: 'text',
        text: this.buildPrompt(context)
      });

      messages.push({
        role: 'user',
        content
      });

      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: this.MODEL_NAME,
          messages,
          response_format: { type: 'json_object' },
          max_tokens: 2000
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'ChatGPT API request failed');
      }

      const data = await response.json();
      const resultText = data.choices?.[0]?.message?.content;

      if (!resultText) throw new Error("No response from ChatGPT");

      return JSON.parse(resultText) as AIResponse;
    } catch (error) {
      console.error("ChatGPT API Error:", error);
      throw error;
    }
  }
}
