import { getFunctions, httpsCallable } from 'firebase/functions';
import { BaseAIProvider } from './BaseAIProvider';
import { AIProviderType, AIResponse, AIRequestContext } from '../types';

interface EnhanceNoteData {
  text: string;
  imageBase64?: string;
}

/**
 * Firebase Gemini Provider - Calls Gemini via Firebase Functions
 * This keeps the API key secure on the server side
 */
export class FirebaseGeminiProvider extends BaseAIProvider {
  name = 'Google Gemini (Secure)';
  type: AIProviderType = 'gemini';

  constructor() {
    // No API key needed - handled by Firebase Functions
    super('firebase-managed');
  }

  get isConfigured(): boolean {
    // Always configured since it uses Firebase Functions
    return true;
  }

  async enhance(context: AIRequestContext): Promise<AIResponse> {
    try {
      const functions = getFunctions();
      const enhanceNote = httpsCallable<EnhanceNoteData, AIResponse>(
        functions,
        'enhanceNoteWithAI'
      );

      const text = context.content || context.title || '';
      if (!text) {
        throw new Error('No content to enhance');
      }

      const result = await enhanceNote({
        text,
        imageBase64: context.imageBase64,
      });

      return result.data;
    } catch (error: unknown) {
      console.error('Firebase Gemini Error:', error);
      if (error instanceof Error && error.message.includes('unauthenticated')) {
        throw new Error('Please sign in to use AI features');
      }
      throw error;
    }
  }
}
