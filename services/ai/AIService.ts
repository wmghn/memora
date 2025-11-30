import { AIProvider, AIProviderType, AIResponse, UserAISettings, AIRequestContext } from './types';
import { GeminiProvider, ChatGPTProvider } from './providers';

/**
 * AI Service - Factory & Manager for AI Providers
 * Uses Strategy Pattern for clean, extensible AI provider management
 */
export class AIService {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private preferredProvider: AIProviderType | null = null;

  constructor(settings?: UserAISettings) {
    if (settings) {
      this.configure(settings);
    }
  }

  /**
   * Configure AI providers based on user settings
   */
  configure(settings: UserAISettings): void {
    this.providers.clear();

    // Initialize Gemini if key provided
    if (settings.geminiApiKey) {
      const gemini = new GeminiProvider(settings.geminiApiKey);
      if (gemini.isConfigured) {
        this.providers.set('gemini', gemini);
      }
    }

    // Initialize ChatGPT if key provided
    if (settings.chatgptApiKey) {
      const chatgpt = new ChatGPTProvider(settings.chatgptApiKey);
      if (chatgpt.isConfigured) {
        this.providers.set('chatgpt', chatgpt);
      }
    }

    // Set preferred provider
    this.preferredProvider = settings.preferredProvider || null;
  }

  /**
   * Get list of available (configured) providers
   */
  getAvailableProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get provider by type
   */
  getProvider(type: AIProviderType): AIProvider | undefined {
    return this.providers.get(type);
  }

  /**
   * Check if any AI provider is available
   */
  hasAnyProvider(): boolean {
    return this.providers.size > 0;
  }

  /**
   * Check if multiple providers are available (for selection UI)
   */
  hasMultipleProviders(): boolean {
    return this.providers.size > 1;
  }

  /**
   * Get the preferred or first available provider
   */
  getPreferredProvider(): AIProvider | undefined {
    if (this.preferredProvider && this.providers.has(this.preferredProvider)) {
      return this.providers.get(this.preferredProvider);
    }
    // Return first available
    return this.providers.values().next().value;
  }

  /**
   * Enhance content using specified or preferred provider
   */
  async enhance(
    context: AIRequestContext,
    providerType?: AIProviderType
  ): Promise<AIResponse> {
    let provider: AIProvider | undefined;

    if (providerType) {
      provider = this.providers.get(providerType);
      if (!provider) {
        throw new Error(`Provider ${providerType} is not configured`);
      }
    } else {
      provider = this.getPreferredProvider();
      if (!provider) {
        throw new Error('No AI provider is configured. Please add your API key in Settings.');
      }
    }

    return provider.enhance(context);
  }
}

// Singleton instance for app-wide usage
let aiServiceInstance: AIService | null = null;

export const getAIService = (): AIService => {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
};

export const configureAIService = (settings: UserAISettings): AIService => {
  const service = getAIService();
  service.configure(settings);
  return service;
};
