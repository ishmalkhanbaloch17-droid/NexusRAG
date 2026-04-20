import { GoogleGenAI } from "@google/genai";

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function getEmbedding(text: string, retryCount = 3): Promise<number[]> {
  const cleanedText = text?.trim() || "";
  if (cleanedText.length === 0) {
    console.warn("Attempted to get embedding for empty text. Returning zero vector.");
    return new Array(768).fill(0);
  }
  
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      const result = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: [cleanedText],
      });
      
      const embedding = result.embeddings?.[0]?.values;
      if (!embedding) throw new Error("No embedding values returned from API");
      return embedding;
    } catch (error: any) {
      const isRetryable = error?.status === 429 || error?.status === 503 || error?.status === 500;
      if (isRetryable && attempt < retryCount - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        console.warn(`Embedding failed (attempt ${attempt + 1}). Retrying in ${Math.round(delay)}ms...`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      console.error("Embedding API error:", error);
      throw error;
    }
  }
  throw new Error("Maximum retry attempts reached for embedding");
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
