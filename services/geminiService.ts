import { GoogleGenAI, Type } from "@google/genai";
import { AIResponse } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize client securely. 
// Note: In a real production app, ensure API key is not exposed to client if possible, 
// or use proxy. For this demo architecture, we use process.env.
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Enhances a short note or formula into a detailed explanation.
 */
export const enhanceNoteWithAI = async (text: string, imageBase64?: string): Promise<AIResponse> => {
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }

  try {
    const parts: any[] = [];

    // Add image if available
    if (imageBase64) {
      // Strip prefix if present (e.g., "data:image/jpeg;base64,")
      const base64Data = imageBase64.split(',')[1] || imageBase64;
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg', // Assuming jpeg/png for simplicity
          data: base64Data
        }
      });
    }

    // Add text prompt
    const prompt = `
      You are an expert tutor helper. The user has provided a note or a formula.
      
      Task:
      1. Analyze the text ${imageBase64 ? "and the provided image" : ""}.
      2. If it is a formula, explain what it is, variables, and usage.
      3. If it is a concept, summarize it clearly.
      4. Format the output with clear Markdown (bolding, lists).
      5. Suggest 3 relevant short tags.
      
      Input text: "${text}"
    `;
    parts.push({ text: prompt });

    // Use JSON schema for structured output
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
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
    if (!resultText) throw new Error("No response from AI");
    
    return JSON.parse(resultText) as AIResponse;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};
