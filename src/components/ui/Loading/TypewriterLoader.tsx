import React, { useState, useEffect } from 'react';
import { AIStarsSpinner } from './AIStarsSpinner';

export type ContentType = 'lesson' | 'exam' | 'activity' | 'general';

export interface TypewriterLoaderProps {
  /** Type of content being generated - determines the messages shown */
  contentType?: ContentType;
  /** Whether the loader is visible */
  isVisible?: boolean;
  /** When true, shows the final "ready" messages before transitioning */
  isComplete?: boolean;
  /** Optional custom messages to override defaults */
  customMessages?: string[];
  /** Show the AI spinner */
  showSpinner?: boolean;
  /** Show the "AI is working" status badge below the text */
  showStatusBadge?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Typing speed in ms per character */
  typingSpeed?: number;
  /** Pause duration at end of message before erasing (ms) */
  pauseDuration?: number;
  /** Erasing speed in ms per character */
  erasingSpeed?: number;
}

// Loading messages (loop through these while loading)
const LOADING_MESSAGES: Record<ContentType, string[]> = {
  lesson: [
    "קולט את נושא השיעור...",
    "מגדיר את מטרות הלימוד המרכזיות...",
    "מתכנן פתיחה שתתפוס את תשומת הלב...",
    "בונה את שלד השיעור...",
    "מחלק את הזמן בין החלקים השונים...",
    "מנסח הסברים ברורים למושגים חדשים...",
    "מחפש דוגמאות שמחברות את החומר למציאות...",
    "משלב שאלות לדיון בכיתה...",
    "יוצר מעברים חלקים בין הנושאים...",
    "דואג לגיוון בשיטות ההוראה...",
    "מתאים את השפה לרמת התלמידים...",
    "מוסיף נקודות למחשבה עצמאית...",
    "בודק שהרצף הלוגי עובד...",
    "מכין את סיכום השיעור...",
    "מוודא שהמסר העיקרי עובר...",
    "מלטש את הניסוחים הסופיים...",
    "מארגן את הנראות של המערך...",
  ],
  exam: [
    "ממפה את הנושאים שצריך לבדוק...",
    "מגדיר את רמת הקושי הנדרשת...",
    "מנסח שאלות ידע והבנה...",
    "כותב שאלות הדורשות חשיבה עמוקה...",
    "בונה מסיחים הגיוניים לשאלות האמריקאיות...",
    "מוודא שאין ניסוחים מבלבלים...",
    "מאזן בין שאלות קלות למאתגרות...",
    "בודק כיסוי של כל חומר הלימוד...",
    "מחשב את חלוקת הניקוד לכל שאלה...",
    "מגוון את סוגי השאלות במבחן...",
    "דואג שהשאלות יהיו הוגנות...",
    "בודק את אורך המבחן המשוער...",
    "מנסח הוראות ברורות לנבחן...",
    "מכין את המפתח לתשובות...",
    "עובר שוב על הניסוחים...",
    "מסדר את השאלות בסדר הנכון...",
    "מעצב את דף הבחינה...",
  ],
  activity: [
    "מנתח את מטרת הפעילות...",
    "חושב על קונספט חווייתי...",
    "מתכנן את מסלול ההתקדמות של התלמיד...",
    "מנסח את האתגר הראשון...",
    "בונה מדרגות קושי עולות...",
    "כותב משובים מחזקים להצלחות...",
    "מכין רמזים למקרה של קושי...",
    "הופך את התוכן למשחקי ומעניין...",
    "דואג שהשפה תהיה מזמינה...",
    "יוצר אינטראקציות מעניינות...",
    "משלב אלמנטים ויזואליים...",
    "בודק שההוראות פשוטות להבנה...",
    "מוודא שהפעילות זורמת בקצב טוב...",
    "מחבר את הכיף ללמידה...",
    "סוגר קצוות אחרונים בעיצוב...",
    "בודק את חווית המשתמש...",
    "מכין את מסך הסיום...",
  ],
  general: [
    "מעבד את הבקשה...",
    "מנתח את התוכן...",
    "בונה את המבנה...",
    "מזקק את הרעיונות...",
    "מארגן את המידע...",
  ],
};

// Completion messages (shown only when isComplete=true)
const COMPLETION_MESSAGES: Record<ContentType, string[]> = {
  lesson: [
    "מבצע בדיקת איכות אחרונה...",
    "המערך כמעט מוכן להגשה...",
  ],
  exam: [
    "מוודא שהכל קריא וברור...",
    "הבחינה מתגבשת לצורתה הסופית...",
  ],
  activity: [
    "אורז את הכל ליחידה אחת...",
    "הפעילות מוכנה ליציאה לדרך...",
  ],
  general: [
    "מסיים את העיבוד...",
    "הכל מוכן...",
  ],
};

/**
 * TypewriterLoader - Animated loading component with typewriter effect
 *
 * Shows messages being typed character by character, then erased,
 * creating an engaging "thinking" experience during long loading operations.
 *
 * The component loops through loading messages until isComplete becomes true,
 * then shows the completion messages before finishing.
 *
 * @example
 * ```tsx
 * <TypewriterLoader contentType="lesson" isVisible={isGenerating} isComplete={dataReady} />
 * ```
 */
export const TypewriterLoader: React.FC<TypewriterLoaderProps> = ({
  contentType = 'general',
  isVisible = true,
  isComplete = false,
  customMessages,
  showSpinner = true,
  showStatusBadge = true,
  className = '',
  typingSpeed = 40,
  pauseDuration = 1200,
  erasingSpeed = 25,
}) => {
  // Get the appropriate messages based on completion state
  const loadingMessages = customMessages || LOADING_MESSAGES[contentType];
  const completionMessages = COMPLETION_MESSAGES[contentType];

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [showCursor, setShowCursor] = useState(true);
  const [showingCompletion, setShowingCompletion] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);

  // Switch to completion messages when isComplete becomes true
  useEffect(() => {
    if (isComplete && !showingCompletion) {
      setShowingCompletion(true);
      setCompletionIndex(0);
      setDisplayedText('');
      setIsTyping(true);
    }
  }, [isComplete, showingCompletion]);

  // Cursor blink effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typewriter effect
  useEffect(() => {
    if (!isVisible) return;

    const messages = showingCompletion ? completionMessages : loadingMessages;
    const currentIndex = showingCompletion ? completionIndex : currentMessageIndex;
    const currentMessage = messages[currentIndex];

    if (!currentMessage) return;

    let timeout: NodeJS.Timeout;

    if (isTyping) {
      // Typing phase
      if (displayedText.length < currentMessage.length) {
        timeout = setTimeout(() => {
          setDisplayedText(currentMessage.slice(0, displayedText.length + 1));
        }, typingSpeed);
      } else {
        // Finished typing, pause before erasing
        timeout = setTimeout(() => {
          setIsTyping(false);
        }, pauseDuration);
      }
    } else {
      // Erasing phase
      if (displayedText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayedText(displayedText.slice(0, -1));
        }, erasingSpeed);
      } else {
        // Finished erasing, move to next message
        if (showingCompletion) {
          // In completion mode, go through completion messages
          if (completionIndex < completionMessages.length - 1) {
            setCompletionIndex(prev => prev + 1);
          }
          // Stay on last completion message (don't loop)
        } else {
          // In loading mode, loop through messages
          setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length);
        }
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeout);
  }, [displayedText, isTyping, currentMessageIndex, completionIndex, showingCompletion, loadingMessages, completionMessages, isVisible, typingSpeed, pauseDuration, erasingSpeed]);

  // Reset when content type changes
  useEffect(() => {
    setCurrentMessageIndex(0);
    setCompletionIndex(0);
    setDisplayedText('');
    setIsTyping(true);
    setShowingCompletion(false);
  }, [contentType, customMessages]);

  if (!isVisible) return null;

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`} dir="rtl">
      {showSpinner && (
        <AIStarsSpinner size="lg" color="gradient" />
      )}

      <div className="min-h-[2rem] flex items-center justify-center">
        <span className="text-lg font-medium text-indigo-700 dark:text-indigo-300">
          {displayedText}
          <span
            className={`inline-block w-0.5 h-5 bg-indigo-500 mr-0.5 align-middle transition-opacity duration-100 ${
              showCursor ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </span>
      </div>

      {/* Status badge - clarifies that AI is actively working */}
      {showStatusBadge && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-full border border-indigo-100 dark:border-indigo-800">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm text-indigo-600 dark:text-indigo-300 font-medium">
            {showingCompletion ? 'מסיים...' : 'AI עובד על זה - זה עלול לקחת עד דקה'}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Inline version for smaller spaces (e.g., inside buttons or cards)
 */
export const TypewriterLoaderInline: React.FC<Omit<TypewriterLoaderProps, 'showSpinner'>> = (props) => (
  <TypewriterLoader {...props} showSpinner={false} className={`inline-flex ${props.className || ''}`} />
);

export default TypewriterLoader;
