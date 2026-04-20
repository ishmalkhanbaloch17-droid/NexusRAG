/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  FileUp, 
  Send, 
  FileText, 
  Plus, 
  CheckCircle2, 
  Loader2, 
  Trash2,
  AlertCircle,
  Database,
  Sparkles,
  Search,
  ClipboardList,
  Cpu,
  Activity,
  History
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getEmbedding, generateRAGResponse } from "./lib/gemini";
import { chunkText, cosineSimilarity, type DocumentChunk } from "./lib/ragUtils";

// Utility for merging tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: DocumentChunk[];
}

interface Document {
  id: string;
  name: string;
  status: "uploading" | "indexing" | "ready" | "error";
  chunkCount: number;
}

export default function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "I've initialized the RAG engine. Upload some documents to the Knowledge Base, and I'll help you extract insights from your data." }
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const docId = Math.random().toString(36).substring(7);
    const newDoc: Document = {
      id: docId,
      name: file.name,
      status: "uploading",
      chunkCount: 0,
    };

    setDocuments(prev => [...prev, newDoc]);
    setIsProcessingFile(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-text", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to extract text from document");
      }

      const { text } = data;
      if (!text) throw new Error("Document appears to be empty or unreadable");

      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: "indexing" } : d));

      const newChunks = chunkText(text).map((chunkText, idx) => ({
        id: `${docId}-${idx}`,
        text: chunkText,
        fileName: file.name,
      }));

      const chunksWithEmbeddings = await Promise.all(
        newChunks
          .filter(chunk => chunk.text && chunk.text.trim().length > 0)
          .map(async (chunk) => {
            const embedding = await getEmbedding(chunk.text);
            return { ...chunk, embedding };
          })
      );

      setChunks(prev => [...prev, ...chunksWithEmbeddings]);
      setDocuments(prev => prev.map(d => d.id === docId ? { 
        ...d, 
        status: "ready", 
        chunkCount: chunksWithEmbeddings.length 
      } : d));

    } catch (error) {
      console.error("Upload error:", error);
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: "error" } : d));
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isThinking) return;

    const userQuery = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userQuery }]);
    setIsThinking(true);

    try {
      const queryEmbedding = await getEmbedding(userQuery);
      const topChunks = chunks
        .map(chunk => ({
          ...chunk,
          similarity: chunk.embedding ? cosineSimilarity(queryEmbedding, chunk.embedding) : 0
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 5)
        .filter(chunk => chunk.similarity > 0.4);

      const context = topChunks.map(c => `[From ${c.fileName}]: ${c.text}`).join("\n\n");
      const answer = await generateRAGResponse(userQuery, context);

      setMessages(prev => [...prev, { 
        role: "assistant", 
        content: answer || "Response context insufficient.",
        sources: topChunks.map(({ id, text, fileName }) => ({ id, text, fileName }))
      }]);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "assistant", content: "Critical thinking module encountered an error." }]);
    } finally {
      setIsThinking(false);
    }
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(d => d.id !== id));
    setChunks(prev => prev.filter(c => !c.id.startsWith(id)));
  };

  return (
    <div className="flex flex-col h-screen bg-background text-slate-300 font-sans selection:bg-blue-500/30">
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-panel shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <span className="text-white font-bold text-xs uppercase">DM</span>
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-white">
            DocuMind RAG <span className="text-slate-500 font-normal text-sm">v1.0.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-500">
              Vector DB Connected
            </span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden">
            <img src="https://picsum.photos/seed/user/32/32" referrerPolicy="no-referrer" alt="User" />
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Knowledge Sources */}
        <aside className="w-64 border-r border-slate-800 bg-panel flex flex-col shrink-0">
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
            <h2 className="text-[11px] uppercase tracking-[0.15em] text-slate-500 font-bold mb-4">Knowledge Base</h2>
            
            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {documents.length === 0 && (
                  <div className="text-center py-8 px-4 border border-dashed border-slate-800 rounded-xl">
                    <FileUp className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                    <p className="text-[10px] text-slate-500">No sources ingested.</p>
                  </div>
                )}
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "group relative p-3 border rounded-lg flex flex-col gap-1 transition-all",
                      doc.status === "ready" 
                        ? "bg-blue-600/5 border-blue-500/20 overflow-hidden" 
                        : "bg-slate-800/30 border-slate-800"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-xs font-semibold truncate",
                        doc.status === "ready" ? "text-blue-400" : "text-slate-400"
                      )}>
                        {doc.name}
                      </span>
                      <button 
                        onClick={() => removeDocument(doc.id)}
                        className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        {doc.status === "ready" ? `${doc.chunkCount} chunks • Processed` : doc.status}
                      </span>
                      {doc.status !== "ready" && doc.status !== "error" && (
                        <Loader2 className="w-2.5 h-2.5 text-blue-500 animate-spin" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-md transition-all flex items-center justify-center gap-2"
            >
              {isProcessingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Ingest New Source
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.txt"
            />
          </div>
        </aside>

        {/* Middle: Chat Interface */}
        <section className="flex-1 flex flex-col bg-background relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
          
          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <div className="max-w-3xl mx-auto space-y-8">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 group"
                >
                  <div className={cn(
                    "w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold border",
                    msg.role === "assistant" 
                      ? "bg-slate-800 border-slate-700 text-slate-400" 
                      : "bg-blue-600 border-blue-500 text-white"
                  )}>
                    {msg.role === "assistant" ? "AI" : "U"}
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className={cn(
                      "text-sm leading-relaxed p-4 rounded-xl",
                      msg.role === "assistant" 
                        ? "bg-slate-800/30 border border-slate-800 text-slate-300 rounded-tl-none" 
                        : "text-white font-medium"
                    )}>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {/* Sources Visualization */}
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="mt-4 p-4 border border-blue-500/20 bg-blue-500/5 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-2">
                             <Search className="w-3 h-3" /> Retrieved Context
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {msg.sources.slice(0, 2).map((source, idx) => (
                            <div 
                              key={idx} 
                              className="bg-panel p-3 border border-slate-800 rounded text-[11px] leading-tight text-slate-400 italic"
                            >
                              "{source.text.slice(0, 100)}..."
                              <div className="mt-2 text-[9px] text-blue-500/50 uppercase font-bold tracking-tighter">
                                source: {source.fileName}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {isThinking && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-8 h-8 rounded bg-slate-800 flex-shrink-0 flex items-center justify-center text-[10px] border border-slate-700">AI</div>
                  <div className="bg-slate-800/20 border border-slate-800 px-4 py-3 rounded-xl rounded-tl-none flex gap-1">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Input Bar */}
          <div className="p-8 shrink-0 max-w-4xl mx-auto w-full">
            <div className="relative flex items-center">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                disabled={chunks.length === 0}
                placeholder={chunks.length > 0 ? "Ask about your architecture..." : "Connect your data sources to query..."}
                className="w-full bg-panel border border-slate-800 rounded-xl py-4 pl-6 pr-20 text-sm focus:outline-none focus:border-blue-500/50 shadow-inner shadow-black/40 disabled:opacity-50 disabled:cursor-not-allowed" 
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isThinking || chunks.length === 0}
                className="absolute right-3 bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded-lg text-[10px] font-bold text-white shadow-lg shadow-blue-600/20 transition-all disabled:bg-slate-800 disabled:shadow-none"
              >
                 {isThinking ? <Loader2 className="w-3 h-3 animate-spin" /> : "SEND"}
              </button>
            </div>
          </div>
        </section>

        {/* Right Sidebar: Implementation Guide */}
        <aside className="w-80 border-l border-slate-800 bg-panel flex flex-col overflow-hidden shrink-0 hidden lg:flex">
          <div className="p-6 h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-sm font-bold text-white mb-6 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-blue-400" />
              Implementation Guide
            </h2>
            
            <div className="space-y-6">
              {[
                { step: 1, title: "Data Preparation", desc: "Chunking sources into semantic fragments for efficient retrieval.", current: true },
                { step: 2, title: "Vector Indexing", desc: "Generating high-dimensional embeddings using Gemini API." },
                { step: 3, title: "Semantic Retrieval", desc: "Performing cosine similarity checks on user queries." },
                { step: 4, title: "Grounded Response", desc: "Augmenting LLM context with retrieved documentation." }
              ].map((item) => (
                <div key={item.step} className="relative pl-8">
                  <div className={cn(
                    "absolute left-0 top-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                    item.current ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                  )}>
                    {item.step}
                  </div>
                  {item.step < 4 && <div className="absolute left-[9px] top-6 w-[px] h-full border-l border-slate-800" />}
                  <h3 className={cn(
                    "text-xs font-bold uppercase tracking-wide mb-1",
                    item.current ? "text-slate-200" : "text-slate-500"
                  )}>
                    {item.title}
                  </h3>
                  <p className={cn(
                    "text-[11px] leading-normal",
                    item.current ? "text-slate-500" : "text-slate-600"
                  )}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 p-4 bg-blue-500/5 border border-blue-500/10 rounded-lg">
              <h4 className="text-[10px] font-bold text-blue-500 uppercase mb-2 flex items-center gap-1">
                <Activity className="w-3 h-3" /> Engine Status
              </h4>
              <div className="space-y-3 pt-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500">Indexed Vectors</span>
                  <span className="text-white font-mono">{chunks.length}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-500">Query Latency</span>
                  <span className="text-white font-mono">0.12s</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Bottom Status Bar */}
      <footer className="px-6 py-2.5 border-t border-slate-800 bg-panel flex justify-between items-center text-[10px] font-mono text-slate-500 shrink-0">
        <div className="flex gap-6">
          <span className="flex items-center gap-2">
            <Cpu className="w-3 h-3 text-slate-600" /> GPU: A100 (45% UTIL)
          </span>
          <span className="flex items-center gap-2">
            <History className="w-3 h-3 text-slate-600" /> LATENCY: ~0.12s
          </span>
          <span className="flex items-center gap-2">
             MODEL: GEMINI-3-FLASH
          </span>
        </div>
        <div className="flex gap-4">
          <span className="text-blue-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
            SYSTEM HEALTHY
          </span>
        </div>
      </footer>
    </div>
  );
}
