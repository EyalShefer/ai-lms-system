import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { callGeminiChat, type ChatMessage } from '../../services/ProxyService';
import { BOT_PERSONAS } from '../../services/ai/prompts';
import { InlineMathKeyboard } from '../math/MathKeyboard';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface InteractiveChatBlockProps {
  block: any;
  context: {
    topic: string;
    step: number;
  };
  readOnly?: boolean;
  answer?: { messages?: Message[] };
  onAnswerChange?: (answer: any) => void;
}

/**
 * Interactive Chat Block
 * Provides AI tutor responses with multiple persona options
 */
const InteractiveChatBlock = memo(function InteractiveChatBlock({
  context,
  readOnly = false,
  answer,
  onAnswerChange,
}: InteractiveChatBlockProps) {
  const [messages, setMessages] = useState<Message[]>(answer?.messages || []);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string>('teacher');
  const [showMathKeyboard, setShowMathKeyboard] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save messages to answer
  useEffect(() => {
    if (onAnswerChange && messages.length > 0) {
      onAnswerChange({ messages });
    }
  }, [messages, onAnswerChange]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Get selected persona prompt
      const persona = BOT_PERSONAS[selectedPersona as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.teacher;

      const systemPrompt = `${persona}

נושא השיעור: ${context.topic}
שלב נוכחי: ${context.step}

עליך לספק תגובה מועילה המבוססת על הנושא והשלב הנוכחיים.`;

      // Prepare messages for API
      const apiMessages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userMessage.content },
      ];

      // Call Gemini API via Cloud Function
      const response = await callGeminiChat(apiMessages, { temperature: 0.7 });

      // Add assistant response
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response },
      ]);
    } catch (error: any) {
      console.error('[Chat Error]:', error);

      // Add error message
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ אירעה שגיאה. אנא נסה שוב.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Handle math symbol insertion
  const handleMathInsert = (symbol: string) => {
    if (symbol === '⌫') {
      // Backspace - remove last character
      setInput(prev => prev.slice(0, -1));
    } else {
      // Insert symbol at cursor position or end
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue = input.slice(0, start) + symbol + input.slice(end);
        setInput(newValue);
        // Restore cursor position after symbol
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + symbol.length;
          textarea.focus();
        }, 0);
      } else {
        setInput(prev => prev + symbol);
      }
    }
  };

  const personaOptions = [
    { value: 'teacher', label: '👨‍🏫 מורה', description: 'מסביר בסבלנות' },
    { value: 'socratic', label: '🤔 סוקרטי', description: 'מוביל בשאלות' },
    { value: 'concise', label: '⚡ תמציתי', description: 'תשובות קצרות' },
    { value: 'coach', label: '💪 מאמן', description: 'מעודד ומעצים' },
  ];

  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-800">💬 צ'אט אינטראקטיבי</h3>

        {/* Persona selector */}
        <div className="flex gap-2">
          {personaOptions.map((persona) => (
            <button
              key={persona.value}
              onClick={() => setSelectedPersona(persona.value)}
              className={`px-3 py-1 text-sm rounded-full transition ${
                selectedPersona === persona.value
                  ? 'bg-blue-600 text-white shadow'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
              title={persona.description}
            >
              {persona.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages container */}
      <div className="bg-white rounded-lg shadow-inner p-4 mb-4 h-96 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-8">
            <p className="text-lg mb-2">👋 שלום!</p>
            <p>שאל אותי כל שאלה על {context.topic}</p>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`mb-4 flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.role === 'assistant' ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {message.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      {!readOnly && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                className="w-full p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="שאל שאלה... (Enter לשליחה)"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                disabled={isLoading}
              />
              {/* Math keyboard toggle button */}
              <button
                onClick={() => setShowMathKeyboard(!showMathKeyboard)}
                className={`absolute bottom-2 left-2 p-1.5 rounded-lg transition-colors ${
                  showMathKeyboard
                    ? 'bg-indigo-100 text-indigo-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="מקלדת מתמטית"
                type="button"
              >
                🔢
              </button>
            </div>
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed self-end"
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? 'שולח...' : 'שלח'}
            </button>
          </div>

          {/* Math keyboard */}
          {showMathKeyboard && (
            <div className="bg-gray-50 p-2 rounded-lg border border-gray-200">
              <InlineMathKeyboard
                onInsert={handleMathInsert}
                symbols={['+', '−', '×', '÷', '=', '<', '>', '≤', '≥', '/', '.', '½', '¼', '¾', '²', '³', '√', 'π']}
              />
            </div>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <p className="text-xs text-gray-500 mt-2 text-center">
          {messages.length} הודעות בשיחה
        </p>
      )}
    </div>
  );
});

export default InteractiveChatBlock;
