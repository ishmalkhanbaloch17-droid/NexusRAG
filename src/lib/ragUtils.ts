export function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  // Normalize text - remove extra carriage returns and multiple newlines
  const normalizedText = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n");
  
  // Split into paragraphs to respect semantic boundaries
  const paragraphs = normalizedText.split(/\n\n/).filter(p => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const para of paragraphs) {
    // If paragraph itself is huge, split it by sentences
    if (para.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      
      const sentences = para.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
      for (const sent of sentences) {
        if (currentChunk.length + sent.length > chunkSize) {
          if (currentChunk.trim().length > 0) {
            chunks.push(currentChunk.trim());
          }
          // Handle overlap
          currentChunk = (currentChunk.length > overlap ? currentChunk.slice(-overlap) : "") + sent + " ";
        } else {
          currentChunk += sent + " ";
        }
      }
    } else {
      if (currentChunk.length + para.length > chunkSize) {
        chunks.push(currentChunk.trim());
        // Simple overlap by taking previous paragraph tail or just starting fresh
        currentChunk = (currentChunk.length > overlap ? currentChunk.slice(-overlap) : "") + para + "\n\n";
      } else {
        currentChunk += para + "\n\n";
      }
    }
  }

  if (currentChunk && currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.filter(c => c.length > 0);
}

export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  
  const magnitude = Math.sqrt(mA) * Math.sqrt(mB);
  if (magnitude === 0) return 0;
  
  return dotProduct / magnitude;
}

export interface DocumentChunk {
  id: string;
  text: string;
  embedding?: number[];
  fileName: string;
}
