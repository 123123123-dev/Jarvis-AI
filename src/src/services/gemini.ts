import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: apiKey || '' });

export async function askJarvis(prompt: string): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are JARVIS, an advanced AI assistant created by Abdullah Waheed (LGS Paragon, Lahore).',
        tools: [{ googleSearch: {} }],
      },
    });

    return response.text || 'No response received from JARVIS core.';
  } catch (error) {
    console.error('JARVIS Client Error:', error);
    throw error;
  }
}
