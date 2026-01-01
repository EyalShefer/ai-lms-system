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
