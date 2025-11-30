import { GoogleGenAI, Type } from "@google/genai";
import { BaseAIProvider } from './BaseAIProvider';
import { AIProviderType, AIResponse, AIRequestContext } from '../types';

export class GeminiProvider extends BaseAIProvider {
  name = 'Google Gemini';
  type: AIProviderType = 'gemini';

  private client: GoogleGenAI | null = null;
  private readonly MODEL_NAME = 'gemini-2.5-flash';

  constructor(apiKey: string) {
    super(apiKey);
    if (this.isConfigured) {
      this.client = new GoogleGenAI({ apiKey });
    }
  }

  async enhance(context: AIRequestContext): Promise<AIResponse> {
    if (!this.client || !this.isConfigured) {
      throw new Error("Gemini API Key is not configured.");
    }

    try {
      const parts: any[] = [];

      // Add image if available
      if (context.imageBase64) {
        const base64Data = context.imageBase64.split(',')[1] || context.imageBase64;
        parts.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Data
          }
        });
      }

      // Add text prompt
      parts.push({ text: this.buildPrompt(context) });

      const response = await this.client.models.generateContent({
        model: this.MODEL_NAME,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A clear, concise title for this note" },
              content: { type: Type.STRING, description: "The detailed explanation in Markdown format" },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 relevant tags"
              }
            }
          }
        }
      });

      const resultText = response.text;
      if (!resultText) throw new Error("No response from Gemini");

      return JSON.parse(resultText) as AIResponse;
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}
