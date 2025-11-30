import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { AIService, UserAISettings, AIProviderType, AIProvider, AIResponse, AIRequestContext } from '../services/ai';
import * as dbService from '../services/dbService';

interface AIContextType {
  aiService: AIService;
  isLoading: boolean;
  hasAnyProvider: boolean;
  hasMultipleProviders: boolean;
  availableProviders: AIProvider[];
  preferredProvider: AIProvider | undefined;
  reloadSettings: () => Promise<void>;
  enhance: (context: AIRequestContext, providerType?: AIProviderType) => Promise<AIResponse>;
}

const AIContext = createContext<AIContextType | null>(null);

export const useAI = () => {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIContextProvider');
  }
  return context;
};

export const AIContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [aiService] = useState(() => new AIService());
  const [isLoading, setIsLoading] = useState(true);
  const [, forceUpdate] = useState({});

  const loadSettings = useCallback(async () => {
    if (!user) {
      aiService.configure({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const settings = await dbService.fetchUserAISettings(user.uid);
      if (settings) {
        aiService.configure(settings);
      } else {
        aiService.configure({});
      }
    } catch (error) {
      console.error('Error loading AI settings:', error);
      aiService.configure({});
    } finally {
      setIsLoading(false);
      forceUpdate({}); // Trigger re-render to update derived values
    }
  }, [user, aiService]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const enhance = useCallback(async (
    context: AIRequestContext,
    providerType?: AIProviderType
  ): Promise<AIResponse> => {
    return aiService.enhance(context, providerType);
  }, [aiService]);

  const value: AIContextType = {
    aiService,
    isLoading,
    hasAnyProvider: aiService.hasAnyProvider(),
    hasMultipleProviders: aiService.hasMultipleProviders(),
    availableProviders: aiService.getAvailableProviders(),
    preferredProvider: aiService.getPreferredProvider(),
    reloadSettings: loadSettings,
    enhance
  };

  return (
    <AIContext.Provider value={value}>
      {children}
    </AIContext.Provider>
  );
};
