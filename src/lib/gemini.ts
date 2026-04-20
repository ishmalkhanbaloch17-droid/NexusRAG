import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getEmbedding(text: string) {
  if (!text || text.trim().length === 0) {
    console.warn("Attempted to get embedding for empty text. Returning zero vector.");
    return new Array(768).fill(0); // Standard embedding size for gemini-embedding-2-preview
  }
  
  try {
    const result = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [{ parts: [{ text: text.trim() }] }],
    });
    return result.embeddings[0].values;
  } catch (error) {
    console.error("Embedding core error:", error);
    throw error;
  }
}

export async function generateRAGResponse(query: string, context: string) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            text: `You are a helpful assistant that answers questions based strictly on the provided context information.
If the answer is not in the context, say that you don't know and don't make up information.

CONTEXT:
${context}

QUESTION:
${query}`
          }
        ]
      }
    ],
  });
  return response.text;
}
