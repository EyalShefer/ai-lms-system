import { v4 as uuidv4 } from 'uuid';
import { BOT_PERSONAS } from '../../services/ai/geminiApi';
import type { ActivityBlock } from '../types/courseTypes';
import { generatePedagogicalPrompt } from '../../services/ai/prompts';

export const createBlock = (type: string, initialPersonaId: string = 'socratic'): ActivityBlock => {
    const personaData = BOT_PERSONAS[initialPersonaId as keyof typeof BOT_PERSONAS] || BOT_PERSONAS.socratic;
    const safeSystemPrompt = type === 'interactive-chat' ? generatePedagogicalPrompt(initialPersonaId) : '';

    let content: any = '';

    switch (type) {
        case 'multiple-choice':
            content = {
                question: 'לחצו כאן כדי לערוך את השאלה',
                options: ['תשובה א׳', 'תשובה ב׳', 'תשובה ג׳', 'תשובה ד׳'],
                correctAnswer: 'תשובה א׳'
            };
            break;
        case 'open-question':
            content = { question: 'לחצו כאן כדי לערוך את השאלה' };
            break;
        case 'interactive-chat':
            content = { title: personaData.name, description: 'צ\'אט...' };
            break;
        case 'fill_in_blanks':
            content = { text: "השלימו את המשפט: ה[שמש] זורחת במזרח ושוקעת ב[מערב]." };
            break;
        case 'ordering':
            content = {
                instruction: 'סדרו את השלבים בסדר הנכון:',
                correct_order: ['שלב ראשון', 'שלב שני', 'שלב שלישי']
            };
            break;
        case 'categorization':
            content = {
                question: 'מיינו את הפריטים לקטגוריות המתאימות:',
                categories: ['קטגוריה א׳', 'קטגוריה ב׳'],
                items: [
                    { text: 'פריט 1', category: 'קטגוריה א׳' },
                    { text: 'פריט 2', category: 'קטגוריה ב׳' }
                ]
            };
            break;
        case 'memory_game':
            content = {
                pairs: [
                    { card_a: 'מושג 1', card_b: 'הגדרה 1' },
                    { card_a: 'מושג 2', card_b: 'הגדרה 2' },
                    { card_a: 'מושג 3', card_b: 'הגדרה 3' }
                ]
            };
            break;
        case 'true_false_speed':
            content = { statement: 'לחצו כאן כדי לערוך את הטענה', answer: true };
            break;
        case 'podcast':
            content = { title: 'פודקאסט AI', audioUrl: null, script: null, description: 'פרק האזנה' };
            break;
        case 'audio-response':
            content = { question: 'הקליטו את תשובתכם:', description: 'לחצו על ההקלטה כדי לענות', maxDuration: 60 };
            break;
        case 'drag_and_drop':
            content = {
                instruction: 'גררו כל פריט לאזור הנכון:',
                zones: [
                    { id: 'zone1', label: 'אזור 1', color: '#E0F2FE' },
                    { id: 'zone2', label: 'אזור 2', color: '#FEF3C7' }
                ],
                items: [
                    { id: 'item1', text: 'פריט 1', correctZone: 'zone1' },
                    { id: 'item2', text: 'פריט 2', correctZone: 'zone2' }
                ]
            };
            break;
        case 'hotspot':
            content = {
                instruction: 'לחצו על החלקים השונים בתמונה:',
                image_description: 'דיאגרמה חינוכית',
                hotspots: [
                    { id: 'spot1', label: 'נקודה 1', x: 25, y: 25, width: 20, height: 20, feedback: 'הסבר על נקודה זו' },
                    { id: 'spot2', label: 'נקודה 2', x: 60, y: 40, width: 20, height: 20, feedback: 'הסבר על נקודה זו' }
                ]
            };
            break;
        case 'mindmap':
            content = {
                title: 'מפת חשיבה',
                nodes: [
                    {
                        id: '1',
                        type: 'topic',
                        data: { label: 'נושא מרכזי', color: '#3B82F6' },
                        position: { x: 400, y: 200 }
                    },
                    {
                        id: '2',
                        type: 'subtopic',
                        data: { label: 'תת-נושא 1', color: '#10B981' },
                        position: { x: 200, y: 100 }
                    },
                    {
                        id: '3',
                        type: 'subtopic',
                        data: { label: 'תת-נושא 2', color: '#10B981' },
                        position: { x: 200, y: 300 }
                    }
                ],
                edges: [
                    { id: 'e1-2', source: '1', target: '2' },
                    { id: 'e1-3', source: '1', target: '3' }
                ],
                layoutDirection: 'RL'
            };
            break;
        case 'infographic':
            content = {
                imageUrl: '',
                title: 'אינפוגרפיקה',
                caption: '',
                visualType: 'flowchart' // 'flowchart' | 'timeline' | 'comparison' | 'cycle'
            };
            break;
        case 'text':
            content = '<h3>כותרת</h3><p>לחצו כאן כדי לערוך את התוכן...</p>';
            break;
        default:
            content = '';
    }

    return {
        id: uuidv4(),
        type: type,
        content: content,
        metadata: {
            score: 0,
            systemPrompt: safeSystemPrompt,
            initialMessage: type === 'interactive-chat' ? personaData.initialMessage : '',
            botPersona: initialPersonaId,
            caption: '',
            relatedQuestion: null
        }
    } as ActivityBlock;
};
