/**
 * DEV ONLY: Test component for three difficulty levels
 * Generates a FULL ACTIVITY (3, 5, or 7 questions) at each level
 * Access via: /dev/three-levels-test
 */

import React, { useState, useRef } from 'react';
import { callGeminiJSON } from '../../services/ProxyService';
import * as pdfjsLib from 'pdfjs-dist';
import { IconHavana, IconYisum, IconHaamaka } from '../../icons';

const DEFAULT_SOURCE_TEXT = `
המגוון הביולוגי בסכנה

בשנת 1831 עגנה ספינתו של צ'רלס דרווין לפני חופי באייה שבברזיל. יערות הגשם החופיים שבהם ביקר, הותירו רושם בל יימחה על דרווין, וכך הוא כתב ביומנו:
"תענוג... הוא ביטוי חלש מדי להביע את עוצמת הרגשות של איש טבע המשוטט לראשונה ביער הברזילאי."

מן היער שעורר את התפעלותו של דרווין, נותרו היום פחות מ-10% מהיצורים החיים. תהליכים ישירים ועקיפים של הרס נופים טבעיים בידי האדם.

הרס ישיר נגרם, למשל, כאשר כורתים יער. הרס עקיף נגרם בדרכים מורכבות יותר. לדוגמה, כאשר האדם מדשן את השדות, לעיתים כמויות הדשן נסחפות עם מי הגשמים למקורות מים.

הדישון הכרחי, כי בלעדיו לא יהיה די יבול לפרנסת האדם, אך בעקיפין הוא פוגע בבתי הגידול של יצורים אחרים.
`;

interface Question {
    questionNumber: number;
    question: string;
    options: string[];
    correctAnswer: string;
    hints?: string[];
    bloomLevel: string;
}

interface ActivityResult {
    level: 'הבנה' | 'יישום' | 'העמקה';
    levelLabel: string;
    questions: Question[];
}

const levelConfigs = {
    הבנה: {
        label: 'הבנה',
        icon: IconHavana,
        color: '#2196F3',
        bgColor: '#E3F2FD',
        instructions: `רמת קושי: הבנה - לתלמידים מתקשים

עקרונות חובה:
1. שפה פשוטה מאוד - משפטים קצרים (עד 10 מילים)
2. שאלות ישירות - התשובה מופיעה במפורש בטקסט
3. מסיחים (תשובות שגויות) - ברורים כשגויים, קל לפסול אותם
4. רמזים - 3 רמזים פרוגרסיביים לכל שאלה
5. רמות בלום: Remember, Understand בלבד
6. סוגי שאלות: בחירה מרובה פשוטה, נכון/לא נכון`,
        temperature: 0.3
    },
    יישום: {
        label: 'יישום',
        icon: IconYisum,
        color: '#FF9800',
        bgColor: '#FFF3E0',
        instructions: `רמת קושי: יישום - לתלמידים טיפוסיים

עקרונות חובה:
1. שפה מותאמת - משפטים עד 15 מילים
2. דורש הבנה - לא רק איתור מידע, אלא הבנת משמעות
3. מסיחים אמינים - דורשים חשיבה להבחנה
4. ללא רמזים אוטומטיים
5. רמות בלום: Understand, Apply, Analyze
6. סוגי שאלות: בחירה מרובה, השוואה, מיון`,
        temperature: 0.5
    },
    העמקה: {
        label: 'העמקה',
        icon: IconHaamaka,
        color: '#F44336',
        bgColor: '#FFEBEE',
        instructions: `רמת קושי: העמקה - לתלמידים מתקדמים

עקרונות חובה:
1. שפה אקדמית - מורכבות לשונית גבוהה
2. חשיבה ביקורתית - הערכה, סינתזה, יצירה
3. מסיחים - כולם נראים אמינים, דורשים ניתוח מעמיק
4. שאלות "למה" ו"איך" - לא רק "מה"
5. חיבור למושגים מתקדמים או רחבים יותר
6. רמות בלום: Analyze, Evaluate, Create
7. סוגי שאלות: שאלות פתוחות, ניתוח, הערכה`,
        temperature: 0.7
    }
};

export const ThreeLevelsTest: React.FC = () => {
    const [sourceText, setSourceText] = useState(DEFAULT_SOURCE_TEXT);
    const [questionCount, setQuestionCount] = useState<3 | 5 | 7>(5);
    const [results, setResults] = useState<ActivityResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentLevel, setCurrentLevel] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Extract text from PDF
    const extractTextFromPDF = async (file: File): Promise<string> => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n\n';
        }

        return fullText.trim();
    };

    // Handle file upload
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsExtracting(true);
        setUploadedFileName(file.name);

        try {
            let extractedText = '';

            if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                extractedText = await extractTextFromPDF(file);
            } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
                extractedText = await file.text();
            } else {
                alert('סוג קובץ לא נתמך. אנא העלה PDF או TXT');
                setIsExtracting(false);
                return;
            }

            if (extractedText) {
                setSourceText(extractedText);
            }
        } catch (error: any) {
            console.error('File extraction error:', error);
            alert(error.message || 'שגיאה בחילוץ טקסט מהקובץ');
        } finally {
            setIsExtracting(false);
        }
    };

    const generateActivity = async (level: 'הבנה' | 'יישום' | 'העמקה'): Promise<ActivityResult> => {
        const config = levelConfigs[level];

        const prompt = `
אתה מומחה פדגוגי ליצירת פעילויות לימודיות. צור פעילות של ${questionCount} שאלות בעברית.

טקסט מקור:
${sourceText}

${config.instructions}

צור בדיוק ${questionCount} שאלות מגוונות (לא רק בחירה מרובה - גם נכון/לא נכון, השלמה, וכו').

החזר JSON בלבד:
{
    "questions": [
        {
            "questionNumber": 1,
            "question": "נוסח השאלה",
            "questionType": "multiple_choice | true_false | fill_blank",
            "options": ["תשובה א", "תשובה ב", "תשובה ג", "תשובה ד"],
            "correctAnswer": "התשובה הנכונה",
            "hints": ["רמז 1", "רמז 2", "רמז 3"],
            "bloomLevel": "Remember | Understand | Apply | Analyze | Evaluate | Create"
        }
    ]
}

חשוב:
- צור בדיוק ${questionCount} שאלות
- כל שאלה חייבת להתאים לרמת הקושי ${config.label}
- גוון בסוגי השאלות
`;

        const result = await callGeminiJSON<{ questions: Question[] }>(
            [{ role: 'user', content: prompt }],
            { temperature: config.temperature }
        );

        return {
            level,
            levelLabel: config.label,
            questions: result.questions || []
        };
    };

    const runTest = async () => {
        setLoading(true);
        setResults([]);
        setProgress(0);

        const levels: ('הבנה' | 'יישום' | 'העמקה')[] = ['הבנה', 'יישום', 'העמקה'];
        const newResults: ActivityResult[] = [];

        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            setCurrentLevel(levelConfigs[level].label);
            setProgress(Math.round(((i) / 3) * 100));

            try {
                const result = await generateActivity(level);
                newResults.push(result);
                setResults([...newResults]);
            } catch (error) {
                console.error(`Error generating ${level}:`, error);
            }
        }

        setProgress(100);
        setCurrentLevel(null);
        setLoading(false);
    };

    return (
        <div dir="rtl" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <h1 style={{ borderBottom: '3px solid #333', paddingBottom: '0.5rem' }}>
                🧪 בדיקת פעילות בשלוש רמות קושי
            </h1>
            <p style={{ color: '#666' }}>
                כלי זה מייצר פעילות שלמה ({questionCount} שאלות) בשלוש רמות קושי שונות להשוואה
            </p>

            {/* Settings */}
            <div style={{ background: '#f5f5f5', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                <h3 style={{ marginTop: 0 }}>⚙️ הגדרות</h3>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                        מספר שאלות בפעילות:
                    </label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {([3, 5, 7] as const).map(count => (
                            <button
                                key={count}
                                onClick={() => setQuestionCount(count)}
                                style={{
                                    padding: '0.5rem 1.5rem',
                                    border: questionCount === count ? '2px solid #4CAF50' : '2px solid #ddd',
                                    borderRadius: '8px',
                                    background: questionCount === count ? '#E8F5E9' : 'white',
                                    cursor: 'pointer',
                                    fontWeight: questionCount === count ? 'bold' : 'normal'
                                }}
                            >
                                {count} שאלות ({count === 3 ? 'קצר' : count === 5 ? 'בינוני' : 'ארוך'})
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
                        📄 טקסט מקור:
                    </label>

                    {/* File Upload */}
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".pdf,.txt"
                            style={{ display: 'none' }}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isExtracting}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: isExtracting ? '#ccc' : '#2196F3',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: isExtracting ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {isExtracting ? '⏳ מחלץ טקסט...' : '📁 העלה קובץ (PDF / TXT)'}
                        </button>

                        {uploadedFileName && (
                            <span style={{
                                background: '#E3F2FD',
                                padding: '0.5rem 1rem',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}>
                                ✅ {uploadedFileName}
                            </span>
                        )}

                        <button
                            onClick={() => {
                                setSourceText(DEFAULT_SOURCE_TEXT);
                                setUploadedFileName(null);
                            }}
                            style={{
                                padding: '0.5rem 1rem',
                                background: '#fff',
                                border: '1px solid #ddd',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem'
                            }}
                        >
                            🔄 איפוס לטקסט ברירת מחדל
                        </button>
                    </div>

                    <textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        style={{
                            width: '100%',
                            minHeight: '150px',
                            padding: '1rem',
                            borderRadius: '8px',
                            border: '1px solid #ddd',
                            fontFamily: 'inherit',
                            fontSize: '0.95rem',
                            resize: 'vertical'
                        }}
                        placeholder="הדבק כאן טקסט או העלה קובץ..."
                    />
                    <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                        {sourceText.length} תווים | ~{Math.round(sourceText.split(/\s+/).length)} מילים
                    </p>
                </div>
            </div>

            {/* Run Button */}
            <button
                onClick={runTest}
                disabled={loading}
                style={{
                    padding: '1rem 3rem',
                    fontSize: '1.2rem',
                    background: loading ? '#ccc' : 'linear-gradient(135deg, #4CAF50, #45a049)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    marginBottom: '2rem',
                    boxShadow: loading ? 'none' : '0 4px 15px rgba(76, 175, 80, 0.3)'
                }}
            >
                {loading ? (
                    <span>⏳ מייצר {currentLevel}... ({progress}%)</span>
                ) : (
                    <span>🚀 הרץ בדיקה - צור {questionCount * 3} שאלות (3 רמות × {questionCount})</span>
                )}
            </button>

            {/* Progress Bar */}
            {loading && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{ background: '#ddd', borderRadius: '10px', height: '20px', overflow: 'hidden' }}>
                        <div style={{
                            background: 'linear-gradient(90deg, #4CAF50, #8BC34A)',
                            height: '100%',
                            width: `${progress}%`,
                            transition: 'width 0.3s ease'
                        }} />
                    </div>
                </div>
            )}

            {/* Results */}
            {results.length > 0 && (
                <div>
                    <h2>📊 תוצאות - השוואה בין {results.length} רמות</h2>

                    {/* Side by side comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${results.length}, 1fr)`, gap: '1rem' }}>
                        {results.map((activity, actIdx) => {
                            const config = levelConfigs[activity.level];
                            return (
                                <div
                                    key={actIdx}
                                    style={{
                                        background: config.bgColor,
                                        borderRadius: '12px',
                                        padding: '1rem',
                                        border: `2px solid ${config.color}`
                                    }}
                                >
                                    <h3 style={{ color: config.color, marginTop: 0, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                        <config.icon className="w-6 h-6" />
                                        {config.label}
                                    </h3>
                                    <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666' }}>
                                        {activity.questions.length} שאלות
                                    </p>

                                    {activity.questions.map((q, qIdx) => (
                                        <div
                                            key={qIdx}
                                            style={{
                                                background: 'white',
                                                borderRadius: '8px',
                                                padding: '1rem',
                                                marginBottom: '1rem',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            <div style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: '0.5rem'
                                            }}>
                                                <strong style={{ color: config.color }}>
                                                    שאלה {q.questionNumber}
                                                </strong>
                                                <span style={{
                                                    background: '#eee',
                                                    padding: '2px 8px',
                                                    borderRadius: '4px',
                                                    fontSize: '0.75rem'
                                                }}>
                                                    {q.bloomLevel}
                                                </span>
                                            </div>

                                            <p style={{ fontWeight: '500', marginBottom: '0.5rem' }}>
                                                {q.question}
                                            </p>

                                            <ol style={{ margin: 0, paddingRight: '1.2rem', fontSize: '0.9rem' }}>
                                                {q.options?.map((opt, optIdx) => (
                                                    <li
                                                        key={optIdx}
                                                        style={{
                                                            color: opt === q.correctAnswer ? '#4CAF50' : '#333',
                                                            fontWeight: opt === q.correctAnswer ? 'bold' : 'normal',
                                                            marginBottom: '0.25rem'
                                                        }}
                                                    >
                                                        {opt} {opt === q.correctAnswer && '✓'}
                                                    </li>
                                                ))}
                                            </ol>

                                            {q.hints && q.hints.length > 0 && activity.level === 'הבנה' && (
                                                <div style={{
                                                    marginTop: '0.5rem',
                                                    padding: '0.5rem',
                                                    background: '#FFF9C4',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    <strong>💡 רמזים:</strong>
                                                    {q.hints.map((h, hIdx) => (
                                                        <div key={hIdx}>{hIdx + 1}. {h}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThreeLevelsTest;
