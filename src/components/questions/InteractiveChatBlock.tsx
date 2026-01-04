import { useState, useRef, useEffect, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { openai } from '../../services/ai/geminiApi';
import { BOT_PERSONAS } from '../../services/ai/prompts';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
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

const MODEL_NAME = 'gpt-4o-mini';

/**
 * Interactive Chat Block with Streaming Support
 * Provides real-time AI tutor responses with multiple persona options
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Get selected persona prompt
      const persona = BOT_PERSONAS[selectedPersona as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.teacher;

      const systemPrompt = `${persona}

נושא השיעור: ${context.topic}
שלב נוכחי: ${context.step}

עליך לספק תגובה מועילה המבוססת על הנושא והשלב הנוכחיים.`;

      // Prepare messages for API
      const apiMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
        { role: 'user', content: userMessage.content },
      ];

      // Add empty assistant message for streaming
      const assistantMessageIndex = messages.length + 1;
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '', isStreaming: true },
      ]);

      // Call streaming API
      const stream = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: apiMessages as any,
        temperature: 0.7,
        stream: true,
      });

      let fullContent = '';

      // Process stream chunks
      for await (const chunk of stream as any) {
        // Check if aborted
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) {
          fullContent += delta;

          // Update streaming message
          setMessages((prev) => {
            const newMessages = [...prev];
            newMessages[assistantMessageIndex] = {
              role: 'assistant',
              content: fullContent,
              isStreaming: true,
            };
            return newMessages;
          });
        }
      }

      // Mark streaming complete
      setMessages((prev) => {
        const newMessages = [...prev];
        newMessages[assistantMessageIndex] = {
          role: 'assistant',
          content: fullContent,
          isStreaming: false,
        };
        return newMessages;
      });
    } catch (error: any) {
      console.error('[Chat Error]:', error);

      // Add error message
      if (!abortControllerRef.current?.signal.aborted) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: '⚠️ אירעה שגיאה. אנא נסה שוב.',
            isStreaming: false,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancelStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
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
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.content}
                    </ReactMarkdown>
                    {message.isStreaming && (
                      <span className="inline-block w-2 h-4 bg-gray-800 animate-pulse ml-1" />
                    )}
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
        <div className="flex gap-2">
          <textarea
            className="flex-1 p-3 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            placeholder="שאל שאלה... (Enter לשליחה)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
          />
          {isLoading ? (
            <button
              onClick={handleCancelStreaming}
              className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            >
              ⏹️ עצור
            </button>
          ) : (
            <button
              onClick={handleSend}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              disabled={!input.trim()}
            >
              שלח
            </button>
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
