/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
// ===== OpenRouter Client (replaces @google/genai) =====
const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

type ContentPart =
  | { text: string }
  | { inlineData: { data: string; mimeType: string } };

function buildORMessages(contents: any, systemInstruction?: string): any[] {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });

  const convertParts = (parts: ContentPart[]): any => {
    const hasImages = parts.some((p: any) => 'inlineData' in p);
    if (hasImages) {
      return parts.map((p: any) => {
        if ('inlineData' in p) {
          return { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } };
        }
        return { type: 'text', text: p.text };
      });
    }
    return parts.map((p: any) => ('text' in p ? p.text : '')).join('\n');
  };

  if (typeof contents === 'string') {
    messages.push({ role: 'user', content: contents });
  } else if (Array.isArray(contents)) {
    contents.forEach((c: any) => {
      messages.push({ role: c.role === 'model' ? 'assistant' : c.role, content: convertParts(c.parts || []) });
    });
  } else if (contents?.parts) {
    messages.push({ role: 'user', content: convertParts(contents.parts) });
  }
  return messages;
}

interface ORConfig {
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  tools?: any[];
}

function createOpenRouterClient(apiKey: string) {
  const baseHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
    'HTTP-Referer': window.location.origin,
    'X-Title': 'CROQODIL',
  });

  const generateContent = async ({ contents, config }: { model?: string; contents: any; config?: ORConfig }) => {
    const messages = buildORMessages(contents, config?.systemInstruction);
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxOutputTokens ?? 2048,
        top_p: config?.topP ?? 0.9,
      }),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`OpenRouter ${res.status}: ${e}`); }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content || '' };
  };

  async function* generateContentStream({ contents, config }: { model?: string; contents: any; config?: ORConfig }) {
    const messages = buildORMessages(contents, config?.systemInstruction);
    const res = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: baseHeaders(),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages,
        temperature: config?.temperature ?? 0.7,
        max_tokens: config?.maxOutputTokens ?? 2048,
        top_p: config?.topP ?? 0.9,
        stream: true,
      }),
    });
    if (!res.ok) { const e = await res.text(); throw new Error(`OpenRouter ${res.status}: ${e}`); }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const raw = line.slice(6);
          if (raw === '[DONE]') return;
          try { const p = JSON.parse(raw); const t = p.choices?.[0]?.delta?.content || ''; if (t) yield { text: t }; } catch {}
        }
      }
    }
  }

  return { models: { generateContent, generateContentStream } };
}
// ===== End OpenRouter Client =====
import { Plus, Settings, Share2, ArrowUp, Loader2, Paperclip, X, FileText, FileCode, Image as ImageIcon, Video, Download, FileJson, FileUp, Facebook, Instagram, Linkedin, Github, Mail, ScrollText, Copy, Trash2, Edit2, Search, SlidersHorizontal, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { ChartRenderer } from './components/ChartRenderer';
import { cn, extractAndParseJSON } from './lib/utils';
// Firebase Imports
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { generateExportHTML, HTMLSection } from './lib/htmlExportService';
import { LandingPage, UserProfile } from './components/Auth';
import { SOCIAL_LINKS } from './constants';

// Firestore Error Handler
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}


// Types
interface Attachment {
  id: string;
  file: File;
  preview: string;
  type: 'image' | 'video' | 'text' | 'pdf';
  base64?: string;
  textContent?: string;
}

const CroqodilLogo = ({ className = "" }: { className?: string }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const maxMove = 15;

  return (
    <svg 
    width="100%" 
    height="100%" 
    viewBox="0 0 709 539" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    preserveAspectRatio="xMidYMid meet"
  >
      {/* Right Eye */}
      <motion.ellipse 
        cx={531} 
        cy={246} 
        rx={17} 
        ry={65} 
        fill="#F2F1ED"
        animate={{
          x: mousePos.x * maxMove,
          y: mousePos.y * (maxMove * 1.5)
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 30, mass: 0.5 }}
      />
      
      {/* Left Eye */}
      <motion.ellipse 
        cx={179} 
        cy={246} 
        rx={17} 
        ry={65} 
        fill="#F2F1ED"
        animate={{
          x: mousePos.x * maxMove,
          y: mousePos.y * (maxMove * 1.5)
        }}
        transition={{ type: 'spring', stiffness: 200, damping: 30, mass: 0.5 }}
      />
    <defs>
      <motion.linearGradient 
        id="shine-gradient" 
        x1="0%" y1="0%" x2="100%" y2="100%"
        animate={{
          x1: ["-100%", "100%"],
          x2: ["0%", "200%"],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "linear",
          repeatDelay: 1
        }}
      >
        <stop offset="0%" stopColor="#F2F1ED" />
        <stop offset="45%" stopColor="#F2F1ED" />
        <stop offset="50%" stopColor="#FFFFFF" />
        <stop offset="55%" stopColor="#F2F1ED" />
        <stop offset="100%" stopColor="#F2F1ED" />
      </motion.linearGradient>
    </defs>
    <motion.path 
      d="M174 395.6L162.4 379.6C177.867 380.667 191.867 382.133 204.4 384C216.933 385.6 228.8 387.6 240 390C251.2 392.667 262.533 395.733 274 399.2C285.467 402.933 297.733 407.2 310.8 412C323.867 417.067 338.667 422.8 355.2 429.2C373.067 436.133 390.667 441.2 408 444.4C425.6 447.6 442.4 448.8 458.4 448C474.4 447.2 489.333 444.4 503.2 439.6C517.067 434.8 529.467 427.867 540.4 418.8L542.8 420.4C542 432.933 538 444.667 530.8 455.6C523.6 466.533 513.6 475.867 500.8 483.6C488 491.333 472.8 496.533 455.2 499.2C437.867 502.133 418.667 501.733 397.6 498C376.533 494.533 354.133 486.8 330.4 474.8C315.467 467.333 301.333 459.2 288 450.4C274.667 441.867 261.6 433.6 248.8 425.6C236.267 417.6 223.867 410.8 211.6 405.2C199.333 399.867 186.8 396.667 174 395.6ZM176.4 104.4C208.4 104.4 236.133 110.4 259.6 122.4C283.333 134.133 301.6 150.8 314.4 172.4C327.2 194 333.6 219.867 333.6 250C333.6 279.867 327.2 305.733 314.4 327.6C301.6 349.2 283.333 366 259.6 378C235.867 389.733 208.133 395.6 176.4 395.6C144.4 395.6 116.533 389.733 92.8 378C69.3333 366 51.2 349.2 38.4 327.6C25.6 306 19.2 280.133 19.2 250C19.2 220.133 25.6 194.4 38.4 172.8C51.2 150.933 69.3333 134.133 92.8 122.4C116.533 110.4 144.4 104.4 176.4 104.4ZM176.4 378.8C195.333 378.8 211.6 373.6 225.2 363.2C239.067 352.533 249.6 337.6 256.8 318.4C264.267 299.2 268 276.4 268 250C268 223.6 264.267 200.8 256.8 181.6C249.6 162.4 239.067 147.6 225.2 137.2C211.6 126.533 195.333 121.2 176.4 121.2C157.467 121.2 141.067 126.533 127.2 137.2C113.6 147.6 103.067 162.4 95.6 181.6C88.4 200.8 84.8 223.6 84.8 250C84.8 276.4 88.5333 299.2 96 318.4C103.467 337.6 114 352.533 127.6 363.2C141.467 373.6 157.733 378.8 176.4 378.8ZM534.222 104.4C566.222 104.4 593.955 110.4 617.422 122.4C641.155 134.133 659.422 150.8 672.222 172.4C685.289 194 691.822 219.867 691.822 250C691.822 279.867 685.289 305.733 672.222 327.6C659.422 349.2 641.155 366 617.422 378C593.955 389.733 566.222 395.6 534.222 395.6C502.222 395.6 474.355 389.733 450.622 378C427.155 366 409.022 349.2 396.222 327.6C383.422 306 377.022 280.133 377.022 250C377.022 220.133 383.422 194.4 396.222 172.8C409.022 150.933 427.155 134.133 450.622 122.4C474.355 110.4 502.222 104.4 534.222 104.4ZM534.222 378.8C553.155 378.8 569.422 373.6 583.022 363.2C596.622 352.533 607.155 337.6 614.622 318.4C622.089 299.2 625.822 276.4 625.822 250C625.822 223.6 622.089 200.8 614.622 181.6C607.155 162.4 596.622 147.6 583.022 137.2C569.422 126.533 553.155 121.2 534.222 121.2C515.555 121.2 499.289 126.533 485.422 137.2C471.822 147.6 461.289 162.4 453.822 181.6C446.355 200.8 442.622 223.6 442.622 250C442.622 276.4 446.355 299.2 453.822 318.4C461.289 337.6 471.822 352.533 485.422 363.2C499.289 373.6 515.555 378.8 534.222 378.8Z" 
      fill="url(#shine-gradient)" 
      animate={{
        filter: [
          "drop-shadow(0 0 4px rgba(232, 216, 196, 0.2)) drop-shadow(0 0 2px rgba(232, 216, 196, 0.1))",
          "drop-shadow(0 0 12px rgba(232, 216, 196, 0.6)) drop-shadow(0 0 25px rgba(232, 216, 196, 0.3))",
          "drop-shadow(0 0 4px rgba(232, 216, 196, 0.2)) drop-shadow(0 0 2px rgba(232, 216, 196, 0.1))"
        ]
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    />
    </svg>
  );
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'image' | 'video' | 'text' | 'pdf';
    name: string;
    url?: string;
  }[];
  phases?: {
    step: 1 | 2 | 3;
    title: string;
    description: string;
    content: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    model: string;
  }[];
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [tempTitle, setTempTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [modelParams, setModelParams] = useState({
    temperature: 0.7,
    maxOutputTokens: 2048,
    topP: 0.9
  });
  const [agentModeEnabled, setAgentModeEnabled] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'STANDARD' | 'TYPOGRAPHY' | 'SYNTHESIS'>('STANDARD');
  const [activePanel, setActivePanel] = useState<'history' | 'tuning' | 'modes' | 'export' | 'social' | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const memoryInputRef = useRef<HTMLInputElement>(null);
  const instructionsInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const historyRef = useRef<HTMLDivElement>(null);
  const tuningRef = useRef<HTMLDivElement>(null);
  const modesRef = useRef<HTMLDivElement>(null);
  
  const [linkedInstructions, setLinkedInstructions] = useState<string | null>(null);
  const [linkedFileName, setLinkedFileName] = useState<string | null>(null);
  const [activeExportId, setActiveExportId] = useState<string | null>(null); // null if global, id if message
  const [isGlobalExport, setIsGlobalExport] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('or_api_key') || '');
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  const togglePanel = (panel: 'history' | 'tuning' | 'modes' | 'export' | 'social') => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const handleExportWithLang = async (lang: 'ar' | 'en') => {
    const id = activeExportId;
    const isGlobal = isGlobalExport;
    setActivePanel(null);
    setIsTyping(true);

    try {
      const contentToExport = !isGlobal && id 
        ? (messages.find(m => m.id === id)?.content || "")
        : messages.slice(-20).map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 10000)}`).join('\n');

      const synthesisPrompt = `[SYSTEM DIRECTIVE: Prepare a COMPREHENSIVE and DETAILED professional report.
- Respond ONLY with JSON: { "title": "...", "sections": [{ "heading": "...", "body": "...", "type": "text|list" }] }
- Language: ${lang === 'ar' ? 'Arabic' : 'English'}.
- Output should be in ${lang === 'ar' ? 'Arabic (RTL)' : 'English (LTR)'}.
- Ensure the synthesis is sophisticated and thorough.
- Use newlines for lists.]\n\nCONTENT:\n${contentToExport}`;

      const ai = aiRef.current;
      if (!ai) return;

      const result = await ai.models.generateContent({
        model: OPENROUTER_MODEL,
        contents: synthesisPrompt,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = result.text;
      if (!text) throw new Error("No response from AI");

      const htmlData = extractAndParseJSON(text);
      if (htmlData && htmlData.sections && Array.isArray(htmlData.sections)) {
        generateExportHTML(htmlData.title || (lang === 'ar' ? "تقرير تركيبي" : "Synthesis Report"), htmlData.sections, lang);
      }
    } catch (err) {
      console.error("Export failed", err);
      // More robust error string detection
      const errorStr = (err instanceof Error ? err.message : String(err)) + " " + JSON.stringify(err);
      let errorMessage = "Export failed. Please verify connectivity or attempt re-initialization.";
      
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "API Quota reached. Please wait a moment before trying to export again.";
      } else if (errorStr.includes('400') || errorStr.includes('INVALID_ARGUMENT')) {
        errorMessage = "The content is too large to export. Try exporting a single message instead of the full chat.";
      } else if (errorStr.includes('status code: 0') || errorStr.includes('Http response at 400 or 500 level')) {
        errorMessage = "Network Latency Error: The connection timed out during synthesis. This usually happens with very large data sets. Try reducing context.";
      }
      
      setMessages(prev => [...prev, {
        id: 'error-export-' + Date.now(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };
  
  // Recent conversations (mock data for sidebar)
  const recentConversations = [
    "Quantum Physics Basics",
    "Architecture Design Plan",
    "Recipe for Sourdough"
  ];

  // ... AI initialization ...
  const aiRef = useRef<ReturnType<typeof createOpenRouterClient> | null>(null);
  
  useEffect(() => {
    if (user && messages.length > 0) {
      // Create chat ID if not exists
      if (!currentChatId) {
        setCurrentChatId(`chat-${Date.now()}`);
        return;
      }
      
      const saveChat = async () => {
        const chatRef = doc(db, 'users', user.uid, 'chats', currentChatId);
        try {
          await setDoc(chatRef, {
            id: currentChatId,
            title: messages[0].content.substring(0, 30) || "New Chat",
            messages: messages.map(m => ({
              ...m,
              timestamp: m.timestamp.toISOString()
            })),
            updatedAt: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error("Error saving chat:", error);
        }
      };
      
      const timeoutId = setTimeout(saveChat, 5000); // Increased timeout to 5s for better batching
      return () => clearTimeout(timeoutId);
    }
  }, [messages, user, currentChatId]);

  useEffect(() => {
    if (user) {
      const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('updatedAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chats = snapshot.docs.map(doc => doc.data());
        setHistory(chats);
      }, (error) => {
        console.error("Error listening to history:", error);
      });

      return () => unsubscribe();
    }
  }, [user]);

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([{
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: `Hello **${user?.displayName?.split(' ')[0] || 'User'}**, initialization complete. **CROQODIL** is at your disposal. Starting a new session.`,
      timestamp: new Date(),
    }]);
  };

  const filteredHistory = history.filter(chat => 
    chat.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadChat = (chat: any) => {
    setCurrentChatId(chat.id);
    setMessages((chat.messages || []).map((m: any) => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })));
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (!user) return;
    
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    try {
      await deleteDoc(chatRef);
      setHistory(prev => prev.filter(c => c.id !== chatId));
      if (currentChatId === chatId) {
        startNewChat();
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  const handleRename = async (chatId: string) => {
    if (!user || !tempTitle.trim()) {
      setRenamingId(null);
      return;
    }
    
    const chatRef = doc(db, 'users', user.uid, 'chats', chatId);
    try {
      await setDoc(chatRef, { title: tempTitle }, { merge: true });
      setHistory(prev => prev.map(c => c.id === chatId ? { ...c, title: tempTitle } : c));
      setRenamingId(null);
    } catch (error) {
      console.error("Error renaming chat:", error);
    }
  };

  useEffect(() => {
    aiRef.current = createOpenRouterClient(apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) setShowApiKeyModal(true);
  }, []);

  const saveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    localStorage.setItem('or_api_key', trimmed);
    setApiKey(trimmed);
    setApiKeyInput('');
    setShowApiKeyModal(false);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);

      if (currentUser) {
        // Sync user profile to Firestore
        const syncProfile = async () => {
          const userRef = doc(db, 'users', currentUser.uid);
          try {
            const userDoc = await getDoc(userRef);
            
            if (!userDoc.exists()) {
              await setDoc(userRef, {
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                lastLoginAt: serverTimestamp(),
                createdAt: serverTimestamp(),
              });
            } else {
              await setDoc(userRef, {
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                lastLoginAt: serverTimestamp(),
              }, { merge: true });
            }
          } catch (error) {
            console.error("Profile sync error:", error);
          }
        };

        syncProfile();

        // Add personalized welcome message if chat is empty
        setMessages(prev => {
          if (prev.length === 0) {
            return [{
              id: 'welcome-' + Date.now(),
              role: 'assistant',
              content: `Hello **${currentUser.displayName?.split(' ')[0] || 'User'}**, initialization complete. **CROQODIL** is at your disposal.`,
              timestamp: new Date(),
            }];
          }
          return prev;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (activePanel === 'history' && historyRef.current && !historyRef.current.contains(target)) {
        setActivePanel(null);
      } else if (activePanel === 'tuning' && tuningRef.current && !tuningRef.current.contains(target)) {
        setActivePanel(null);
      } else if (activePanel === 'modes' && modesRef.current && !modesRef.current.contains(target)) {
        setActivePanel(null);
      } else if (activePanel === 'social' && tuningRef.current && !tuningRef.current.contains(target)) {
        setActivePanel(null);
      }
    };

    if (activePanel && activePanel !== 'export') {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePanel]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Ctrl+S or Meta+S (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        exportMemory();
      }
      // Check for Ctrl+O or Meta+O (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        memoryInputRef.current?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [messages]); // Dependency on messages ensures the closure has access to current state if needed, 
                  // though exportMemory is currently stable or handles it.

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      const type = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' : 
                   file.type === 'application/pdf' ? 'pdf' : 'text';
      
      const newAttachment: Attachment = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        type,
        preview: type === 'image' ? URL.createObjectURL(file) : '',
      };

      if (type === 'text') {
        const text = await file.text();
        newAttachment.textContent = text;
      } else {
        const reader = new FileReader();
        reader.onload = (re) => {
          const base64 = (re.target?.result as string).split(',')[1];
          setAttachments(prev => prev.map(a => a.id === newAttachment.id ? { ...a, base64 } : a));
        };
        reader.readAsDataURL(file);
      }

      setAttachments(prev => [...prev, newAttachment]);
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const filtered = prev.filter(a => a.id !== id);
      const removed = prev.find(a => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const exportAsText = (content: string, type: 'txt' | 'md') => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CROQODIL_Response_${Date.now()}.${type}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportMemory = () => {
    const sessionData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      messages: messages
    };
    
    const jsonString = JSON.stringify(sessionData, null, 2);
    const markdownContent = `# CROQODIL Session Memory\n\nThis file contains your conversation history. Do not modify the block below if you intend to restore this session.\n\n\`\`\`json\n${jsonString}\n\`\`\``;
    
    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CROQODIL_Memory_${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importMemory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      
      if (!jsonMatch) throw new Error("No valid binary memory found in file.");
      
      const sessionData = JSON.parse(jsonMatch[1]);
      if (sessionData && Array.isArray(sessionData.messages)) {
        // Hydrate timestamps
        const hydratedMessages = (sessionData.messages || []).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
        setMessages(hydratedMessages);
      }
    } catch (err) {
      console.error("Failed to restore memory:", err);
      alert("Error: Could not restore conversation. Ensure the file is a valid CROQODIL memory markdown.");
    } finally {
      if (memoryInputRef.current) memoryInputRef.current.value = '';
    }
  };

  const handleLinkInstructions = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.md')) {
      alert("Please upload a .md file for instructions.");
      return;
    }

    try {
      const text = await file.text();
      setLinkedInstructions(text);
      setLinkedFileName(file.name);
    } catch (err) {
      console.error("Failed to read instructions file:", err);
    } finally {
      if (instructionsInputRef.current) instructionsInputRef.current.value = '';
    }
  };

  const clearInstructions = () => {
    setLinkedInstructions(null);
    setLinkedFileName(null);
  };

  const handleSendMessage = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault();
    const activeInput = overrideInput ?? input;
    if (!activeInput.trim() && attachments.length === 0 || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: activeInput,
      timestamp: new Date(),
      attachments: attachments.map(a => ({
        type: a.type,
        name: a.file.name,
        url: a.preview
      }))
    };

    const currentAttachments = [...attachments];
    setMessages(prev => [...prev, userMessage]);
    if (!overrideInput) setInput('');
    setAttachments([]);
    setIsTyping(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      if (!aiRef.current) throw new Error("AI not initialized");

      const assistantId = (Date.now() + 1).toString();
      
      const userMsg = activeInput.toLowerCase();
    
      // Direct HTML Export Trigger (Global Chat)
      if (userMsg.includes('export html') || userMsg.includes('save as html')) {
        setIsGlobalExport(true);
        setActiveExportId(null);
        setActivePanel('export');
        if (!overrideInput) setInput('');
        return;
      }

      const mergedInput = linkedInstructions 
        ? `${linkedInstructions}\n\n---\n\nUser Request: ${activeInput}` 
        : activeInput;

      // Prune history to avoid token limit errors
      const MAX_HISTORY_MESSAGES = 15;
      const MAX_MESSAGE_CHARS = 50000;

      const prunedMessages = messages.slice(-MAX_HISTORY_MESSAGES);
      
      const promptParts: any[] = [];
      
      // Add pruned history for context
      prunedMessages.forEach(msg => {
        const truncatedContent = msg.content.length > MAX_MESSAGE_CHARS 
          ? msg.content.substring(0, MAX_MESSAGE_CHARS) + "... [Content Truncated for Context]"
          : msg.content;
        promptParts.push({ text: `${msg.role === 'user' ? 'User' : 'Assistant'}: ${truncatedContent}` });
      });

      promptParts.push({ text: `Current User Request: ${mergedInput || "Analyze the attached files."}` });
      
      for (const att of currentAttachments) {
        if (att.type === 'text') {
          const truncatedFileContent = (att.textContent || "").substring(0, 100000);
          promptParts.push({ text: `Content of file ${att.file.name} (Truncated if too large):\n\n${truncatedFileContent}` });
        } else if (att.base64) {
          promptParts.push({
            inlineData: {
              data: att.base64,
              mimeType: att.file.type
            }
          });
        }
      }

      if (!agentModeEnabled) {
        // Standard Single-Phase Mode
        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: '',
          timestamp: new Date()
        }]);

        let modeInstruction = "";
        if (selectedMode === 'STANDARD') {
          modeInstruction = "You are a versatile AI assistant. Provide helpful, accurate, and insightful responses.";
        } else if (selectedMode === 'TYPOGRAPHY') {
          modeInstruction = "FORCE MODE 4: TYPOGRAPHY REFERENCE. Deliver ONLY raw JSON for images.";
        }

        const chat = await aiRef.current.models.generateContentStream({
          model: OPENROUTER_MODEL,
          contents: { parts: promptParts },
          config: {
            ...modelParams,
            tools: [{ googleSearch: {} }],
            systemInstruction: `You are CROQODIL, an expert visual analyst and Brand Identity Strategist.

            IDENTITY STUDY PROTOCOL:
            When analyzing social media accounts (Instagram, X, Facebook, etc.):
            1. STRICT PRIVACY: Do not extract personal data, private information, or sensitive details.
            2. VISUAL IDENTITY: Analyze color palettes (hex codes), typography style, and layout rhythm.
            3. TONE OF VOICE (ToV): Define the linguistic personality (e.g., sophisticated, bold, minimalist).
            4. STRATEGIC ESSENCE: Summarize the core value proposition and brand archetype.
            
            SOCIAL MEDIA & WEB ACCESS:
            Use Google Search to analyze the specific handles or URLs provided. Focus on public-facing brand elements for study purposes.

            ${modeInstruction}

            ${selectedMode === 'SYNTHESIS' ? 'BRAND SYNTHESIS MODE: Analyze Website, X, and Socials. Focus on Direction, Style, TOV, Strategy, and Typography. Generate full HTML report.' : ''}

            SOCIAL MEDIA & WEB ACCESS:
            You have access to Google Search. If the user provides a link (Instagram, Facebook, X/Twitter, etc.), use search to analyze the content and provide an accurate synthesis.

            JSON & CHART CAPABILITY:
            - If generating charts, use the key "chart_data".
            - ALWAYS ensure JSON is valid and complete.
            - Wrap JSON and HTML structures in markdown code blocks: \`\`\`json { ... } \`\`\`.
            - Do NOT include trailing commas in JSON arrays or objects.
            - If generating dynamic content, ensure all brackets are properly closed.

            HTML CAPABILITY:
            If the user asks to "create an html about [topic]" or just a structured report, you MUST respond with a structured JSON block:
            {
              "title": "Document Title",
              "sections": [
                { "heading": "Section Name", "body": "...", "type": "text|list|table" }
              ]
            }

            Deliver a professional, comprehensive response. If it's an image, follow visual analysis protocols for mode: ${selectedMode}.`
          }
        });

        let fullContent = '';
        for await (const chunk of chat) {
          const text = chunk.text;
          if (text) {
            fullContent += text;
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: fullContent } : m
            ));
          }
        }

        // Check for HTML JSON in response
        const htmlData = extractAndParseJSON(fullContent);
        if (htmlData && htmlData.title && htmlData.sections && Array.isArray(htmlData.sections)) {
          generateExportHTML(htmlData.title, htmlData.sections);
        }

        return;
      }

      // Multi-Phase Agent Mode (existing logic)
      const initialPhases: Message['phases'] = [
        { step: 1, title: 'Phase 1: Initial Drafting', description: 'CROQODIL is analyzing inputs (Phase 1).', content: '', status: 'pending', model: OPENROUTER_MODEL },
        { step: 2, title: 'Phase 2: Precision Audit', description: 'System is reviewing the draft for logical consistency.', content: '', status: 'pending', model: OPENROUTER_MODEL },
        { step: 3, title: 'Phase 3: Final Synthesis', description: 'CROQODIL is applying corrections and delivering output.', content: '', status: 'pending', model: OPENROUTER_MODEL },
      ];

      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        phases: initialPhases
      }]);

      // ... (mergedInput and promptParts are already defined above)

      // STEP 1: CROQODIL
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 1 ? { ...p, status: 'processing' } : p)
        } : m
      ));
      
      let draftText = '';
      try {
        let modeInstruction = "";
        if (selectedMode === 'STANDARD') {
          modeInstruction = "Standard AI analysis mode. Provide a comprehensive response based on all inputs.";
        } else if (selectedMode === 'TYPOGRAPHY') {
          modeInstruction = "FORCE MODE 4: TYPOGRAPHY REFERENCE. Return ONLY raw JSON: typographic_style, texture_and_material, lighting_setup, merge_strategy, generation_prompt. Ignore other requests.";
        }

        const draftResponse = await aiRef.current.models.generateContent({
          model: OPENROUTER_MODEL,
          contents: { parts: promptParts },
          config: {
            ...modelParams,
            tools: [{ googleSearch: {} }],
            systemInstruction: `You are CROQODIL, an expert visual analyst, AI image generation prompt engineer, and Brand Architect.
            
            IDENTITY STUDY PROTOCOL:
            Focus exclusively on the "Anatomy of Brand":
            - Chromatic signature (Colors)
            - Verbal signature (Tone of Voice)
            - Aesthetic DNA (Visual Style)
            
            STRICT DATA POLICY: Only analyze public visual identity for educational study. No personal PII extraction.

            ${modeInstruction}

            ${selectedMode === 'SYNTHESIS' ? 'BRAND SYNTHESIS MODE: Analyze Website, X, and Socials. Focus on Direction, Style, TOV, Strategy, and Typography. Generate full HTML report sections for Company, Identity, Strategy, Projects, and Social Media.' : ''}

            SOCIAL MEDIA & WEB ACCESS:
            You have access to Google Search. If the user provides a link (Instagram, Facebook, X, etc.), use the search tool to analyze the content and provide a detailed synthesis.

            HTML CAPABILITY:
            If the user asks to "create an html about [topic]", you MUST respond with a structured JSON block:
            {
              "title": "Document Title",
              "sections": [
                { "heading": "Section Name", "body": "...", "type": "text|list|table" }
              ]
            }

            CHART CAPABILITY:
            If the user asks for data visualization or statistics, you can output a JSON block inside your response in this format:
            {"chart_data": {"type": "bar" | "line" | "pie", "title": "Chart Title", "data": [{"name": "Label", "value": 10}, ...]}}

            MODE 4 — TYPOGRAPHY REFERENCE
            Return ONLY raw JSON: typographic_style, texture_and_material, lighting_setup, merge_strategy, generation_prompt

            RULES:
            - Return ONLY raw JSON. No markdown, no backticks, no explanation.
            - generation_prompt must always be complete and ready to use in any image generation model.
            - If user provides custom text for MODE 4, embed it in generation_prompt.
            
            Aside from visual analysis, analyze all provided inputs and provide a comprehensive, high-quality response. If specific instructions are merged, adhere to them strictly.`
          }
        });
        draftText = draftResponse.text || '';
        if (!draftText) throw new Error("Phase 1 returned empty response.");
      } catch (phError) {
        console.error("Phase 1 failed:", phError);
        throw new Error(`Phase 1 Analysis failed: ${phError instanceof Error ? phError.message : String(phError)}`);
      }

      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 1 ? { ...p, status: 'completed', content: draftText } : p)
        } : m
      ));

      // STEP 2: Review
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 2 ? { ...p, status: 'processing' } : p)
        } : m
      ));

      let reviewText = 'Clean.';
      try {
        const reviewResponse = await aiRef.current.models.generateContent({
          model: OPENROUTER_MODEL,
          contents: `Review this draft for factual accuracy, logical consistency, and clarity. Identify any missing parts based on original instructions.\n\nDraft:\n${draftText}`,
          config: {
            systemInstruction: "You are the specialized Auditor. Be critical and precise."
          }
        });
        reviewText = reviewResponse.text || 'Process completed with minor notes.';
      } catch (phError) {
        console.warn("Phase 2 (non-critical) failed:", phError);
        reviewText = "Review phase encountered a non-blocking delay; proceeding to final synthesis.";
      }

      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 2 ? { ...p, status: 'completed', content: reviewText } : p)
        } : m
      ));

      // STEP 3: Final Refinement
      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 3 ? { ...p, status: 'processing' } : p)
        } : m
      ));

      let assistantContent = '';
      try {
        const finalChat = await aiRef.current.models.generateContentStream({
          model: OPENROUTER_MODEL,
          contents: [
            { role: 'user', parts: promptParts },
            { role: 'model', parts: [{ text: draftText }] },
            { role: 'user', parts: [{ text: `Feedback from audit:\n${reviewText}\n\nDeliver the final, polished response now.` }] }
          ],
          config: {
            ...modelParams,
            tools: [{ googleSearch: {} }],
            systemInstruction: `You are CROQODIL, an expert AI assistant with real-time web access.
            ${selectedMode === 'TYPOGRAPHY' ? 'Follow the specialized Mode instructions for fonts.' : ''} 
            ${selectedMode === 'SYNTHESIS' ? `
            BRAND SYNTHESIS MODE ACTIVE:
            User will provide 3 links (Website, X, Instagram/Facebook).
            1. Use Google Search to analyze the branding, strategy, and visual style from these links.
            2. Analyze: Direction, Style, TOV, Branding/Strategy, and Typography.
            3. Generate a SINGLE complete HTML report in the JSON structure below.
            4. ALWAYS wrap JSON in \`\`\`json blocks. Ensure no trailing commas.
            5. CONTENT REQUIREMENT: For each section, provide 150-300 words of DEEP, DESCRIPTIVE, and DESCRIPTIVE analysis. Avoid brief bullet points. Write like a senior brand strategist.
            
            HTML Sections REQUIRED:
            - Company Overview (نبذة عن الشركة)
            - Color Palette & Visual Identity (الألوان والهوية البصرية)
            - Typography (الخطوط المستخدمة)
            - Art Direction (اتجاه التصميم)
            - Visual Style (الأسلوب البصري)
            - Tone of Voice (نبرة الصوت)
            - Brand Strategy (استراتيجية البراند)
            - Projects Portfolio (المشاريع)
            - Social Media Analysis (تحليل السوشيال ميديا)
            - Recommendations (التوصيات)
            ` : ''} 
            Use Google Search results to enrich the final response if links were provided.
            Deliver a polished, high-quality response. 
            If the draft was JSON, maintain the JSON structure but feel free to add a very brief high-level context if and only if it helps the user.`
          }
        });

        for await (const chunk of finalChat) {
          const text = chunk.text;
          if (text) {
            assistantContent += text;
            setMessages(prev => prev.map(m => 
              m.id === assistantId ? { ...m, content: assistantContent } : m
            ));
          }
        }

        // Check for HTML JSON in response
        const htmlData = extractAndParseJSON(assistantContent);
        if (htmlData && htmlData.title && htmlData.sections && Array.isArray(htmlData.sections)) {
          generateExportHTML(htmlData.title, htmlData.sections);
        }
      } catch (phError) {
        console.error("Phase 3 failed:", phError);
        if (assistantContent) {
          assistantContent += "\n\n[Note: The final synthesis was interrupted, displaying partial results.]";
        } else {
          throw new Error(`Final synthesis failed: ${phError instanceof Error ? phError.message : String(phError)}`);
        }
      }

      setMessages(prev => prev.map(m => 
        m.id === assistantId ? { 
          ...m, 
          phases: m.phases?.map(p => p.step === 3 ? { ...p, status: 'completed', content: assistantContent } : p)
        } : m
      ));

    } catch (error) {
      console.error("Chat error:", error);
      // More robust error string detection
      const errorStr = (error instanceof Error ? error.message : String(error)) + " " + JSON.stringify(error);
      let errorMessage = "Operational Error: Failed to secure link with CROQODIL core. Please verify connectivity or attempt re-initialization.";
      
      if (errorStr.includes('429') || errorStr.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "API Quota reached. Please wait a moment before sending another request.";
      } else if (errorStr.includes('400') || errorStr.includes('INVALID_ARGUMENT')) {
        errorMessage = "The context window has been exceeded. Please clear the chat or reduce attachment sizes.";
      } else if (errorStr.includes('status code: 0') || errorStr.includes('Http response at 400 or 500 level')) {
        errorMessage = "Network Latency Error: The connection to the AI core timed out. This often happens with very long conversations or complex searches. Please try again or clear chat history.";
      } else if (errorStr.includes('404') || errorStr.includes('NOT_FOUND')) {
        errorMessage = "Model Configuration Error: The requested AI model was not found. Please try again or clear chat to reset configuration.";
      }

      setMessages(prev => [...prev, {
        id: 'error-' + Date.now(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!authReady) {
    return (
      <div className="h-screen bg-[#141416] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cream animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage />;
  }

  return (
    <div className="flex h-screen bg-[#141416] text-[#F0EFEB] font-sans selection:bg-cream/30 overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#141416] relative">
        {/* Header */}
        <header className="h-20 flex items-center justify-between px-6 md:px-10 flex-shrink-0 relative z-50">
          <div className="flex-1 flex items-center gap-6 justify-start">
            {/* Agent Mode Toggle - Far Left */}
            <div className="flex flex-col items-start justify-center">
              <button 
                onClick={() => setAgentModeEnabled(!agentModeEnabled)}
                className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all flex items-center gap-1.5 border w-fit ${
                  agentModeEnabled 
                    ? 'text-[#112250] bg-cream border-[#112250]/20' 
                    : 'text-cream/40 bg-white/5 border-white/5 hover:text-cream'
                }`}
                title={agentModeEnabled ? "Deactivate Agent Synthesis" : "Activate Agent Synthesis (3-Phase)"}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${agentModeEnabled ? 'bg-[#112250] animate-pulse' : 'bg-cream/20'}`}></div>
                Agent Mode: {agentModeEnabled ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
          </div>
          
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className="w-64 h-16 flex items-center justify-center">
              <CroqodilLogo className="w-full h-full drop-shadow-[0_0_25px_rgba(86,28,36,0.5)]" />
            </div>
          </div>
 
          <div className="flex-1 flex items-center justify-end h-full gap-4">
            <button
              onClick={() => { setApiKeyInput(apiKey); setShowApiKeyModal(true); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${apiKey ? 'border-cream/10 text-cream/40 hover:text-cream hover:border-cream/30' : 'border-red-500/50 text-red-400 animate-pulse'}`}
              title="OpenRouter API Key"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-green-400' : 'bg-red-400'}`} />
              API Key
            </button>
            <UserProfile user={user} />
          </div>
        </header>

        {/* Chat Area */}
        <main 
          ref={scrollRef}
          className="flex-1 overflow-y-auto no-scrollbar scroll-smooth"
        >
          <div className="max-w-3xl mx-auto w-full py-16 px-6 md:px-8 space-y-12">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col group ${message.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-3 mb-2 px-1">
                    {message.role === 'user' ? (
                      <>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-[#112250]" />
                          <div className="w-1 h-1 rounded-full bg-[#112250]" />
                        </div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-[#112250] uppercase">Initiator</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-[#112250]" />
                          <div className="w-1 h-1 rounded-full bg-[#112250]" />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-cream" />
                          <div className="w-1 h-1 rounded-full bg-cream" />
                        </div>
                        <span className="text-[10px] font-black tracking-[0.2em] text-cream uppercase">Croqodil</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 rounded-full bg-cream" />
                          <div className="w-1 h-1 rounded-full bg-cream" />
                        </div>
                      </>
                    )}
                  </div>

                  <div className={`flex-1 min-w-0 space-y-2 w-full ${message.role === 'user' ? 'flex flex-col items-end text-right' : ''}`}>
                    {message.attachments && message.attachments.length > 0 && (
                      <div className={`flex flex-wrap gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.attachments.map((att, i) => (
                          <div key={i} className="relative group/att border border-transparent rounded-xl overflow-hidden">
                            {att.type === 'image' ? (
                              <img src={att.url} alt={att.name} referrerPolicy="no-referrer" className="h-28 w-36 object-cover grayscale hover:grayscale-0 transition-all duration-500 ease-out scale-100 hover:scale-105" />
                            ) : att.type === 'video' ? (
                              <div className="h-28 w-36 bg-black/80 flex flex-col items-center justify-center p-3">
                                <Video className="w-7 h-7 text-cream mb-2" />
                                <span className="text-[10px] text-cream truncate w-full text-center font-medium">{att.name}</span>
                              </div>
                            ) : att.type === 'pdf' ? (
                              <div className="h-28 w-36 bg-black/80 flex flex-col items-center justify-center p-3">
                                <FileText className="w-7 h-7 text-cream mb-2" />
                                <span className="text-[10px] text-cream font-black mb-1">PDF</span>
                                <span className="text-[9px] text-cream/70 truncate w-full text-center">{att.name}</span>
                              </div>
                            ) : (
                              <div className="h-28 w-36 bg-black/80 flex flex-col items-center justify-center p-3">
                                <FileText className="w-7 h-7 text-cream mb-2" />
                                <span className="text-[10px] text-cream truncate w-full text-center uppercase tracking-tighter">{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {message.phases && message.phases.length > 0 && (
                      <div className="space-y-4 mb-6 w-full">
                        {message.phases.map((phase) => (
                          <details key={phase.step} className="group/details bg-transparent transition-all duration-500 overflow-hidden">
                            <summary className="flex items-center justify-between p-5 cursor-pointer list-none select-none hover:bg-cream/5 transition-colors">
                              <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                                  phase.status === 'completed' ? 'bg-cream text-black' :
                                  phase.status === 'processing' ? 'bg-cream/40 text-black animate-pulse' :
                                  'bg-transparent text-cream/40'
                                }`}>
                                  {phase.status === 'completed' ? '✓' : phase.step}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-cream tracking-wide uppercase">{phase.title}</h4>
                                  <p className="text-[10px] text-cream font-medium">{phase.status === 'processing' ? 'Processing neural data...' : phase.description}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono text-cream bg-transparent px-1.5 py-0.5 rounded border border-transparent">{phase.model}</span>
                                <Plus className="w-3 h-3 text-cream/60 group-open:rotate-45 transition-transform" />
                              </div>
                            </summary>
                            {phase.content && (
                              <div className="p-4 pt-0 bg-transparent flex flex-col gap-2">
                                <div className="mt-4 p-3 bg-transparent rounded-lg text-[11px] font-mono text-cream max-h-48 overflow-y-auto no-scrollbar border border-white/5">
                                  {phase.content}
                                </div>
                                <button 
                                  onClick={() => navigator.clipboard.writeText(phase.content || '')}
                                  className="flex items-center gap-1.5 self-end px-2 py-1 text-[9px] font-bold text-cream hover:text-white bg-white/5 hover:bg-white/10 rounded transition-all"
                                  title="Copy Phase Content"
                                >
                                  <Copy className="w-3 h-3" />
                                  Copy Phase Data
                                </button>
                              </div>
                            )}
                          </details>
                        ))}
                      </div>
                    )}

                    <div className={`markdown-body prose prose-invert prose-p:leading-relaxed w-fit max-w-full text-cream transition-all duration-500 py-2 ${message.role === 'user' ? 'ml-auto text-right' : ''}`}>
                      <Markdown>{message.content || (isTyping && message.role === 'assistant' ? '_Thinking..._ ' : '...')}</Markdown>
                    </div>

                    {message.role === 'assistant' && message.content && message.content.includes('chart_data') && (
                      <div className="w-full">
                        {(() => {
                          const parsed = extractAndParseJSON(message.content);
                          if (parsed && parsed.chart_data) {
                            return <ChartRenderer data={parsed.chart_data} />;
                          }
                          return null;
                        })()}
                      </div>
                    )}
                    
                    {!isTyping && message.content && (
                      <div className={`flex flex-wrap gap-2 mt-6 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <button 
                          onClick={() => navigator.clipboard.writeText(message.content)}
                          className="px-3 py-1 text-[11px] font-medium rounded-full text-cream hover:bg-cream/10 hover:text-white transition-colors flex items-center gap-1.5"
                          title="Copy Content"
                        >
                          <Copy className="w-3 h-3" />
                          {message.role === 'user' ? 'Copy prompt' : 'Copy text'}
                        </button>
                        
                        {message.role === 'assistant' && message.id !== 'welcome' && (
                          <div className="flex gap-2">
                            <button 
                              onClick={() => exportAsText(message.content, 'md')}
                              className="px-3 py-1 text-[11px] font-medium rounded-full text-cream hover:bg-cream/10 hover:text-white transition-colors flex items-center gap-1.5"
                            >
                              <FileJson className="w-3 h-3" />
                              Export .md
                            </button>
                            <button 
                              onClick={() => {
                                setIsGlobalExport(false);
                                setActiveExportId(message.id);
                                setActivePanel('export');
                              }}
                              disabled={isTyping}
                              className="px-3 py-1 text-[11px] font-medium rounded-full text-cream hover:bg-cream/10 hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
                            >
                              <FileCode className="w-3 h-3" />
                              Export HTML
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isTyping && messages[messages.length-1]?.content === '' && (
              <div className="flex flex-col animate-pulse items-start">
                <div className="flex items-center gap-3 mb-2 px-1">
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-cream" />
                    <div className="w-1 h-1 rounded-full bg-cream" />
                  </div>
                  <span className="text-[10px] font-black tracking-[0.2em] text-cream uppercase">Croqodil</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 rounded-full bg-cream" />
                    <div className="w-1 h-1 rounded-full bg-cream" />
                  </div>
                </div>
                <div className="flex-1 space-y-2 w-full">
                  <div className="h-4 bg-cream/5 rounded w-3/4"></div>
                  <div className="h-4 bg-cream/5 rounded w-1/2"></div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Input Area */}
        <div className="p-6 md:px-10 z-50">
          <div className="max-w-3xl mx-auto relative">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-4 p-4 bg-transparent rounded-2xl">
                {attachments.map((att) => (
                  <div key={att.id} className="relative group/att rounded-xl overflow-hidden p-1 bg-transparent">
                    {att.type === 'image' ? (
                      <img src={att.preview} alt="preview" className="h-14 w-14 object-cover rounded-lg" />
                    ) : (
                      <div className="h-14 w-14 flex items-center justify-center bg-transparent rounded-lg">
                        <FileText className="w-6 h-6 text-cream" />
                      </div>
                    )}
                    <button 
                      onClick={() => removeAttachment(att.id)}
                      className="absolute -top-1 -right-1 bg-black text-cream rounded-full p-0.5 hover:text-white transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <form 
              onSubmit={handleSendMessage}
              className="relative bg-white/5 backdrop-blur-xl border border-white/5 rounded-2xl p-2 transition-all duration-300"
            >
              <div className="flex items-end gap-2 px-2">
                <div className="flex items-center gap-1 p-1">
                  {history.length > 0 && (
                    <div className="relative" ref={historyRef}>
                      <button 
                        type="button"
                        onClick={() => togglePanel('history')}
                        className={`p-2 rounded-full transition-all ${activePanel === 'history' ? 'bg-[#112250] text-cream' : 'text-cream/40 hover:text-cream hover:bg-[#112250]/20'}`}
                        title="Conversation History"
                      >
                        <ScrollText className="w-5 h-5" />
                      </button>
                      
                      <AnimatePresence>
                        {activePanel === 'history' && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full mb-3 left-0 w-72 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl p-3 z-[100] max-h-[80vh] overflow-y-auto no-scrollbar"
                          >
                            <div className="text-[10px] font-black text-cream/40 uppercase tracking-widest mb-4 flex items-center justify-between px-1">
                              Neural History
                              <X className="w-3 h-3 cursor-pointer" onClick={() => setActivePanel(null)} />
                            </div>

                            <div className="relative mb-4">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cream/30" />
                              <input 
                                type="text"
                                placeholder="Search neural history..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-[10px] text-cream outline-none focus:border-cream/30 transition-all"
                              />
                            </div>

                            <div className="space-y-1">
                            {filteredHistory.map((chat) => (
                              <div key={chat.id} className="relative group/item flex items-center gap-1 p-1">
                                {renamingId === chat.id ? (
                                  <div className="flex-1 flex items-center gap-1 p-1">
                                    <input
                                      autoFocus
                                      type="text"
                                      value={tempTitle}
                                      onChange={(e) => setTempTitle(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleRename(chat.id);
                                        if (e.key === 'Escape') setRenamingId(null);
                                      }}
                                      onBlur={() => handleRename(chat.id)}
                                      className="flex-1 bg-white/5 border border-cream/20 rounded px-2 py-1 text-[10px] text-cream outline-none"
                                    />
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        loadChat(chat);
                                        setActivePanel(null);
                                      }}
                                      className="flex-1 text-left p-2 rounded-lg hover:bg-white/5 transition-colors"
                                    >
                                      <div className="text-[10px] font-bold text-cream truncate">{chat.title}</div>
                                      <div className="text-[8px] text-cream/40">{new Date(chat.updatedAt?.seconds * 1000).toLocaleDateString()}</div>
                                    </button>
                                    <div className="flex items-center opacity-0 group-hover/item:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setRenamingId(chat.id);
                                          setTempTitle(chat.title);
                                        }}
                                        className="p-1.5 text-cream/40 hover:text-cream transition-all rounded-lg"
                                        title="Rename Chat"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={(e) => deleteChat(e, chat.id)}
                                        className="p-1.5 text-cream/40 hover:text-red-400 transition-all rounded-lg"
                                        title="Delete Chat"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            ))}
                            </div>
                            <div className="mt-2 pt-2 border-t border-white/5 flex flex-col gap-1">
                              <button 
                                onClick={() => {
                                  startNewChat();
                                  setActivePanel(null);
                                }}
                                className="w-full flex items-center gap-2 p-2 text-[10px] font-bold text-linen hover:bg-white/5 rounded-lg transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                New Chat
                              </button>
                              
                              <div className="flex flex-col gap-1 px-1">
                                <div className="flex items-center gap-1">
                                  <button 
                                    onClick={() => {
                                      memoryInputRef.current?.click();
                                      setActivePanel(null);
                                    }}
                                    className="flex-1 p-1.5 text-cream/40 hover:text-cream hover:bg-white/5 rounded-md transition-all flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider"
                                    title="Restore from Memory File"
                                  >
                                    <FileUp className="w-3.5 h-3.5" />
                                    Restore
                                  </button>
                                  <button 
                                    onClick={() => {
                                      exportMemory();
                                      setActivePanel(null);
                                    }}
                                    className="flex-1 p-1.5 text-cream/40 hover:text-cream hover:bg-white/5 rounded-md transition-all flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider"
                                    title="Save Session to Memory"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    Save
                                  </button>
                                </div>
                                
                                <button 
                                  onClick={() => {
                                    if (linkedInstructions) {
                                      clearInstructions();
                                    } else {
                                      instructionsInputRef.current?.click();
                                    }
                                    setActivePanel(null);
                                  }}
                                  className={`w-full p-1.5 text-[8px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1.5 border border-transparent ${
                                    linkedInstructions 
                                      ? 'text-cream bg-cream/20' 
                                      : 'text-cream/40 hover:text-cream hover:bg-white/5'
                                  }`}
                                  title={linkedInstructions ? `Unlink: ${linkedFileName}` : "Link Instruction MD"}
                                >
                                  <ScrollText className={`w-3.5 h-3.5 ${linkedInstructions ? 'animate-pulse text-cream' : ''}`} />
                                  {linkedInstructions ? 'Linked MD' : 'Link MD'}
                                  {linkedInstructions && (
                                    <span onClick={(e) => { e.stopPropagation(); clearInstructions(); }} className="ml-auto hover:text-white transition-colors">
                                      <X className="w-2.5 h-2.5" />
                                    </span>
                                  )}
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="relative">
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      type="button"
                      onClick={() => togglePanel('social')}
                      className={`p-2 rounded-full transition-all relative ${activePanel === 'social' ? 'bg-[#112250] text-cream' : 'text-cream/40 hover:text-cream hover:bg-[#112250]/20'}`}
                      title="Sync Social Identity"
                    >
                      <Link className="w-5 h-5" />
                      {activePanel === 'social' && (
                        <motion.div 
                          layoutId="active-indicator"
                          className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-rose-500 rounded-full"
                        />
                      )}
                    </motion.button>

                    <AnimatePresence>
                      {activePanel === 'social' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-3 left-0 bg-[#0a0a0c] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-72 space-y-4"
                        >
                          <div className="text-[10px] font-black text-rose-500/60 uppercase tracking-widest mb-1 flex items-center justify-between">
                            Identify Verification
                            <X className="w-3 h-3 cursor-pointer text-cream/40 hover:text-cream" onClick={() => setActivePanel(null)} />
                          </div>

                          <div className="space-y-4">
                            <p className="text-[11px] text-cream/70 leading-relaxed text-right font-medium dir-rtl" style={{ direction: 'rtl' }}>
                              لن يتم أخذ معلومات من هذا الحساب أو أي معلومات شخصية، ولكن فقط تحليل.
                            </p>
                            
                            <div className="space-y-2">
                              <div className="relative group">
                                <input 
                                  type="text" 
                                  placeholder="Instagram / X / Facebook URL..." 
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-cream placeholder-cream/20 focus:outline-none focus:border-[#112250] transition-all"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = (e.target as HTMLInputElement).value;
                                      if (val.trim()) {
                                        const analysisPrompt = `Analyze the identity and tone of voice for this social media account: ${val}. Focus on color palette, writing style, and brand essence. (Educational Study)`;
                                        handleSendMessage(undefined, analysisPrompt);
                                        setActivePanel(null);
                                      }
                                    }
                                  }}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 items-center">
                                  <span className="text-[9px] text-cream/20 font-mono uppercase">Enter to study</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-white/5 flex items-center gap-2 opacity-30">
                              <Instagram className="w-3 h-3" />
                              <Facebook className="w-3 h-3" />
                              <div className="w-1 h-1 rounded-full bg-cream/20" />
                              <span className="text-[8px] font-black uppercase tracking-tighter">Vision Only Mode</span>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative" ref={tuningRef}>
                    <button 
                      type="button"
                      onClick={() => togglePanel('tuning')}
                      className={`p-2 rounded-full transition-all ${activePanel === 'tuning' ? 'bg-[#112250] text-cream' : 'text-cream/40 hover:text-cream hover:bg-[#112250]/20'}`}
                      title="Model Parameters"
                    >
                      <SlidersHorizontal className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {activePanel === 'tuning' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-3 left-0 bg-[#1a1a1e] border border-white/10 rounded-2xl p-4 shadow-2xl z-50 w-64 space-y-4"
                        >
                          <div className="text-[10px] font-black text-cream/40 uppercase tracking-widest mb-2 flex items-center justify-between">
                            Neural Tuning
                            <X className="w-3 h-3 cursor-pointer" onClick={() => setActivePanel(null)} />
                          </div>
                          
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[9px] uppercase font-bold text-cream/60">
                                Temperature
                                <span>{modelParams.temperature}</span>
                              </div>
                              <input 
                                type="range" min="0" max="2" step="0.1" 
                                value={modelParams.temperature} 
                                onChange={(e) => setModelParams(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                                className="w-full accent-cream"
                              />
                            </div>
                            
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-[9px] uppercase font-bold text-cream/60">
                                Max Tokens
                                <span>{modelParams.maxOutputTokens}</span>
                                </div>
                              <input 
                                type="range" min="100" max="8000" step="100" 
                                value={modelParams.maxOutputTokens} 
                                onChange={(e) => setModelParams(prev => ({ ...prev, maxOutputTokens: parseInt(e.target.value) }))}
                                className="w-full accent-cream"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="relative" ref={modesRef}>
                    <button 
                      type="button"
                      onClick={() => togglePanel('modes')}
                      className={`p-2 rounded-full transition-all ${activePanel === 'modes' ? 'bg-[#112250] text-cream' : 'text-cream/40 hover:text-cream hover:bg-[#112250]/20'}`}
                      title="Choose Analysis Mode"
                    >
                      <Settings className="w-5 h-5" />
                    </button>
                    
                    <AnimatePresence>
                      {activePanel === 'modes' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full mb-3 left-0 bg-[#1a1a1e] border border-white/10 rounded-2xl p-2 shadow-2xl z-50 w-48"
                        >
                          <div className="text-[9px] font-black text-cream/40 uppercase tracking-widest px-3 mb-2">Analysis Modes</div>
                          {[
                            { id: 'STANDARD', label: 'Standard AI' },
                            { id: 'TYPOGRAPHY', label: 'TTP' },
                            { id: 'SYNTHESIS', label: 'Synthesis' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => {
                                setSelectedMode(mode.id as any);
                                setActivePanel(null);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                selectedMode === mode.id ? 'bg-[#112250] text-cream' : 'text-cream/60 hover:text-cream hover:bg-white/5'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 text-cream/40 hover:text-cream hover:bg-[#112250]/20 rounded-full transition-all"
                    title="Attach Pin"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileSelect} 
                  multiple 
                  className="hidden" 
                />
                
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  autoComplete="off"
                  placeholder="Inquiry for CROQODIL..."
                  className="flex-1 bg-transparent border-none focus:ring-0 focus:outline-none outline-none caret-cream text-cream placeholder-cream/40 py-3 resize-none max-h-[200px] font-medium"
                  rows={1}
                />

                <button 
                  type="submit"
                  disabled={(!input.trim() && attachments.length === 0) || isTyping}
                  className={`p-3 rounded-full transition-all ${
                    (input.trim() || attachments.length > 0) && !isTyping
                      ? 'bg-[#112250] text-cream hover:bg-[#112250]/90 active:scale-95'
                      : 'text-cream/20 bg-[#112250]/10 cursor-not-allowed'
                  }`}
                >
                  {isTyping ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowUp className="w-5 h-5" />}
                </button>
              </div>
            </form>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-6">
                {SOCIAL_LINKS.map((link) => (
                  <a 
                    key={link.name} 
                    href={link.url} 
                    target={link.name === 'Gmail' ? '_self' : '_blank'} 
                    rel="noopener noreferrer"
                    className="text-[#112250] hover:text-[#112250]/80 transition-all hover:scale-110 active:scale-95 group/link relative"
                    title={link.name}
                  >
                    <div className="absolute -inset-2 bg-[#112250]/10 rounded-full blur-md opacity-0 group-hover/link:opacity-100 transition-opacity"></div>
                    <link.Icon className="w-5 h-5 relative z-10 drop-shadow-[0_0_8px_rgba(17,34,80,0.4)]" />
                  </a>
                ))}
              </div>
              <p className="text-[9px] text-center text-cream/40 uppercase tracking-[0.2em] font-black">
                CROQODIL • Neural Synthesis Engine • Amoled Edition
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Language Selection Modal */}
      <AnimatePresence>
        {activePanel === 'export' && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md px-6"
            onClick={() => setActivePanel(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cream/20 to-transparent" />
              <h3 className="text-xl font-black text-cream mb-2 text-center uppercase tracking-tight">Export Language</h3>
              <p className="text-[10px] text-cream/40 mb-8 text-center uppercase tracking-widest font-mono">Select report destination language</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleExportWithLang('ar')}
                  className="flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-[#112250]/40 border border-white/5 hover:border-[#112250]/60 rounded-2xl transition-all group active:scale-95"
                >
                  <span className="text-2xl font-black text-cream group-hover:scale-110 transition-transform">عربي</span>
                  <span className="text-[9px] text-cream/30 font-black tracking-widest">ARABIC (RTL)</span>
                </button>
                <button 
                  onClick={() => handleExportWithLang('en')}
                  className="flex flex-col items-center gap-3 p-6 bg-white/5 hover:bg-cream/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all group active:scale-95"
                >
                  <span className="text-2xl font-black text-cream group-hover:scale-110 transition-transform">EN</span>
                  <span className="text-[9px] text-cream/30 font-black tracking-widest">ENGLISH (LTR)</span>
                </button>
              </div>
              
              <button 
                onClick={() => setActivePanel(null)}
                className="mt-8 w-full py-3 text-[10px] font-black text-cream/20 hover:text-white transition-colors uppercase tracking-[0.3em]"
              >
                Cancel Synthesis
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <AnimatePresence>
        {showApiKeyModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md px-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[#050505] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cream/20 to-transparent" />
              
              <div className="flex items-center gap-2 mb-1">
                <span className={`w-2 h-2 rounded-full ${apiKey ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
                <h3 className="text-lg font-black text-cream uppercase tracking-tight">OpenRouter API Key</h3>
              </div>
              <p className="text-[10px] text-cream/40 mb-6 uppercase tracking-widest font-mono">
                {apiKey ? 'Update your key below' : 'Required to activate CROQODIL'}
              </p>

              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                  autoFocus
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-cream placeholder-cream/20 focus:outline-none focus:border-cream/30 transition-all font-mono"
                />
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[10px] text-cream/30 hover:text-cream/60 transition-colors text-center"
                >
                  Get your key at openrouter.ai/keys ↗
                </a>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={saveApiKey}
                  disabled={!apiKeyInput.trim()}
                  className="flex-1 py-3 bg-[#112250] hover:bg-[#112250]/80 text-cream text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                >
                  Save & Activate
                </button>
                {apiKey && (
                  <button
                    onClick={() => setShowApiKeyModal(false)}
                    className="py-3 px-4 text-[11px] font-black text-cream/30 hover:text-cream transition-colors uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Styles for Markdown (Flat Blood Theme) */}
      <style>{`
        .markdown-body h1 { font-size: 1.5rem; font-weight: 900; margin-bottom: 1rem; color: #F0EFEB; padding-bottom: 0.5rem; text-transform: uppercase; letter-spacing: -0.02em; }
        .markdown-body h2 { font-size: 1.25rem; font-weight: 800; margin-bottom: 0.75rem; color: #F0EFEB; letter-spacing: -0.01em; padding-bottom: 0.25rem; }
        .markdown-body p { margin-bottom: 1.5rem; line-height: 1.8; color: #F0EFEB; font-weight: 400; font-size: 0.9375rem; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body strong { color: #F0EFEB; font-weight: 800; }
        .markdown-body code { background: #141416; padding: 0.2rem 0.4rem; border-radius: 0.375rem; font-family: ui-monospace, monospace; font-size: 0.85em; color: #F0EFEB; }
        .markdown-body pre { background: #141416; padding: 1.5rem; border-radius: 1rem; overflow-x: auto; margin-bottom: 1.5rem; }
        .markdown-body ul, .markdown-body ol { margin-left: 1.5rem; margin-bottom: 1.5rem; list-style-type: disc; color: #F0EFEB; }
        .markdown-body li { margin-bottom: 0.75rem; color: #F0EFEB; }
        .markdown-body a { color: #F0EFEB; text-decoration: underline; text-underline-offset: 4px; font-weight: 600; }
        .markdown-body blockquote { border-left: 4px solid #F0EFEB; padding: 0.75rem 1.25rem; font-style: italic; color: #F0EFEB; margin-bottom: 1.5rem; background: rgba(240, 239, 235, 0.05); border-radius: 0.75rem; }
      `}</style>
    </div>
  );
}
