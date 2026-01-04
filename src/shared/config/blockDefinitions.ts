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
            content = { question: '', options: ['', '', '', ''], correctAnswer: '' };
            break;
        case 'open-question':
            content = { question: '' };
            break;
        case 'interactive-chat':
            content = { title: personaData.name, description: 'צ\'אט...' };
            break;
        case 'fill_in_blanks':
            content = "השלימו את המשפט: [מילה] חסרה.";
            break;
        case 'ordering':
            content = { instruction: 'סדרו את ...', correct_order: ['פריט 1', 'פריט 2', 'פריט 3'] };
            break;
        case 'categorization':
            content = { question: 'מיינו לקטגוריות...', categories: ['קטגוריה 1', 'קטגוריה 2'], items: [{ text: 'פריט 1', category: 'קטגוריה 1' }] };
            break;
        case 'memory_game':
            content = { pairs: [{ card_a: 'חתול', card_b: 'Cat' }, { card_a: 'כלב', card_b: 'Dog' }] };
            break;
        case 'true_false_speed':
            content = { statement: 'השמיים כחולים', answer: true };
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
