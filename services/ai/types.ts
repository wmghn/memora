// AI Service Types

export interface AIResponse {
  title?: string;
  content: string;
  tags?: string[];
}

export interface AIProviderConfig {
  apiKey: string;
}

export type AIProviderType = 'gemini' | 'chatgpt';

export interface AIRequestContext {
  title?: string;
  content?: string;
  imageBase64?: string;
  customPrompt?: string;
}

export interface AIProvider {
  name: string;
  type: AIProviderType;
  isConfigured: boolean;
  enhance: (context: AIRequestContext) => Promise<AIResponse>;
}

export interface UserAISettings {
  geminiApiKey?: string;
  chatgptApiKey?: string;
  preferredProvider?: AIProviderType;
}
