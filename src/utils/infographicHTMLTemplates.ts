/**
 * HTML Templates for Educational Infographics
 * Hand-crafted templates that LLM can use as examples
 * Optimized for Hebrew RTL content
 */

import type { InfographicType } from '../services/ai/geminiApi';

/**
 * Get example HTML structure for each infographic type
 */
export const getExampleHTMLStructure = (type: InfographicType): string => {
  switch (type) {
    case 'flowchart':
      return FLOWCHART_EXAMPLE;
    case 'timeline':
      return TIMELINE_EXAMPLE;
    case 'comparison':
      return COMPARISON_EXAMPLE;
    case 'cycle':
      return CYCLE_EXAMPLE;
    default:
      return FLOWCHART_EXAMPLE;
  }
};

/**
 * Flowchart Example - Process steps (Premium Design)
 */
const FLOWCHART_EXAMPLE = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1024px;
      height: 1024px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      padding: 40px;
      position: relative;
      overflow: hidden;
    }
    /* Decorative background elements */
    body::before {
      content: '';
      position: absolute;
      top: -50%;
      right: -50%;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(102,126,234,0.1) 0%, transparent 50%);
    }
    body::after {
      content: '';
      position: absolute;
      bottom: -50%;
      left: -50%;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle, rgba(233,69,96,0.1) 0%, transparent 50%);
    }
    .header {
      text-align: center;
      margin-bottom: 50px;
      position: relative;
      z-index: 1;
    }
    .title {
      font-size: 52px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #e94560 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 10px;
      letter-spacing: -1px;
    }
    .subtitle {
      font-size: 22px;
      color: rgba(255,255,255,0.6);
      font-weight: 300;
    }
    .flowchart {
      display: flex;
      flex-direction: column;
      gap: 20px;
      align-items: center;
      position: relative;
      z-index: 1;
    }
    .step {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 25px 40px;
      border-radius: 16px;
      font-size: 26px;
      font-weight: 600;
      color: white;
      text-align: center;
      min-width: 500px;
      position: relative;
      transition: transform 0.3s ease;
    }
    .step:hover { transform: scale(1.02); }
    .step-number {
      position: absolute;
      top: 50%;
      right: -30px;
      transform: translateY(-50%);
      background: linear-gradient(135deg, #e94560 0%, #764ba2 100%);
      color: white;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      box-shadow: 0 8px 25px rgba(233,69,96,0.4);
      border: 3px solid rgba(255,255,255,0.3);
    }
    .step-icon {
      font-size: 32px;
      margin-left: 15px;
    }
    .connector {
      width: 4px;
      height: 30px;
      background: linear-gradient(180deg, #667eea 0%, #e94560 100%);
      border-radius: 2px;
      position: relative;
    }
    .connector::after {
      content: '▼';
      position: absolute;
      bottom: -15px;
      left: 50%;
      transform: translateX(-50%);
      color: #e94560;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">תהליך הפוטוסינתזה</div>
    <div class="subtitle">השלבים העיקריים בתהליך</div>
  </div>
  <div class="flowchart">
    <div class="step">
      <div class="step-number">1</div>
      <span class="step-icon">☀️</span>
      הצמח קולט אור שמש
    </div>
    <div class="connector"></div>
    <div class="step">
      <div class="step-number">2</div>
      <span class="step-icon">💧</span>
      קליטת מים ומינרלים מהאדמה
    </div>
    <div class="connector"></div>
    <div class="step">
      <div class="step-number">3</div>
      <span class="step-icon">🌿</span>
      יצירת גלוקוז ופליטת חמצן
    </div>
  </div>
</body>
</html>
`;

/**
 * Timeline Example - Historical events (Premium Design)
 */
const TIMELINE_EXAMPLE = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1024px;
      height: 1024px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      background: linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      padding: 50px 40px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      position: relative;
      z-index: 1;
    }
    .title {
      font-size: 48px;
      font-weight: 800;
      color: white;
      margin-bottom: 8px;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    .title-decoration {
      width: 120px;
      height: 4px;
      background: linear-gradient(90deg, #f093fb 0%, #f5576c 50%, #ffd93d 100%);
      margin: 0 auto;
      border-radius: 2px;
    }
    .timeline {
      position: relative;
      width: 100%;
      max-width: 900px;
      z-index: 1;
    }
    .timeline-line {
      position: absolute;
      right: 50%;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, #f093fb 0%, #f5576c 50%, #ffd93d 100%);
      transform: translateX(50%);
      border-radius: 2px;
    }
    .event {
      display: flex;
      align-items: center;
      margin-bottom: 35px;
      position: relative;
    }
    .event:nth-child(odd) { flex-direction: row; }
    .event:nth-child(even) { flex-direction: row-reverse; }
    .event-content {
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      padding: 20px 25px;
      border-radius: 16px;
      flex: 1;
      max-width: 380px;
    }
    .event-date {
      font-size: 28px;
      font-weight: 800;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 8px;
    }
    .event-text {
      font-size: 20px;
      color: rgba(255,255,255,0.9);
      line-height: 1.5;
    }
    .event-dot {
      width: 24px;
      height: 24px;
      background: linear-gradient(135deg, #ffd93d 0%, #f5576c 100%);
      border: 4px solid #24243e;
      border-radius: 50%;
      margin: 0 25px;
      position: relative;
      z-index: 2;
      box-shadow: 0 0 20px rgba(255,217,61,0.5);
    }
    .spacer { flex: 1; max-width: 380px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">אבני דרך בהיסטוריה</div>
    <div class="title-decoration"></div>
  </div>
  <div class="timeline">
    <div class="timeline-line"></div>
    <div class="event">
      <div class="event-content">
        <div class="event-date">1948</div>
        <div class="event-text">הקמת מדינת ישראל</div>
      </div>
      <div class="event-dot"></div>
      <div class="spacer"></div>
    </div>
    <div class="event">
      <div class="spacer"></div>
      <div class="event-dot"></div>
      <div class="event-content">
        <div class="event-date">1967</div>
        <div class="event-text">מלחמת ששת הימים</div>
      </div>
    </div>
    <div class="event">
      <div class="event-content">
        <div class="event-date">1979</div>
        <div class="event-text">הסכם השלום עם מצרים</div>
      </div>
      <div class="event-dot"></div>
      <div class="spacer"></div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Comparison Example - Side by side (Premium Design)
 */
const COMPARISON_EXAMPLE = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1024px;
      height: 1024px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #141e30 0%, #243b55 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      padding: 50px;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(79,172,254,0.15) 0%, transparent 70%);
      top: -200px;
      right: -200px;
    }
    body::after {
      content: '';
      position: absolute;
      width: 600px;
      height: 600px;
      background: radial-gradient(circle, rgba(0,242,254,0.15) 0%, transparent 70%);
      bottom: -200px;
      left: -200px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      position: relative;
      z-index: 1;
    }
    .title {
      font-size: 46px;
      font-weight: 800;
      color: white;
      margin-bottom: 10px;
    }
    .vs-badge {
      display: inline-block;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      padding: 8px 25px;
      border-radius: 30px;
      font-size: 20px;
      font-weight: 700;
      color: white;
      letter-spacing: 2px;
    }
    .comparison {
      display: flex;
      gap: 30px;
      width: 100%;
      max-width: 920px;
      position: relative;
      z-index: 1;
    }
    .column {
      flex: 1;
      background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      padding: 30px;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .column:first-child {
      border-top: 4px solid #4facfe;
    }
    .column:last-child {
      border-top: 4px solid #00f2fe;
    }
    .column-header {
      text-align: center;
      margin-bottom: 25px;
    }
    .column-icon {
      font-size: 50px;
      margin-bottom: 10px;
    }
    .column-title {
      font-size: 30px;
      font-weight: 700;
      color: white;
    }
    .column:first-child .column-title { color: #4facfe; }
    .column:last-child .column-title { color: #00f2fe; }
    .items {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 15px;
      font-size: 20px;
      color: rgba(255,255,255,0.9);
      padding: 15px 18px;
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .item-icon {
      font-size: 26px;
      width: 40px;
      text-align: center;
    }
    .item-text {
      flex: 1;
      line-height: 1.4;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">תא צמחי vs תא בעל חיים</div>
    <div class="vs-badge">השוואה</div>
  </div>
  <div class="comparison">
    <div class="column">
      <div class="column-header">
        <div class="column-icon">🌱</div>
        <div class="column-title">תא צמחי</div>
      </div>
      <div class="items">
        <div class="item"><span class="item-icon">🧱</span><span class="item-text">קיר תא קשיח</span></div>
        <div class="item"><span class="item-icon">🟢</span><span class="item-text">כלורופלסטים</span></div>
        <div class="item"><span class="item-icon">💧</span><span class="item-text">ואקואול גדול</span></div>
        <div class="item"><span class="item-icon">▢</span><span class="item-text">צורה מרובעת</span></div>
      </div>
    </div>
    <div class="column">
      <div class="column-header">
        <div class="column-icon">🦠</div>
        <div class="column-title">תא בעל חיים</div>
      </div>
      <div class="items">
        <div class="item"><span class="item-icon">〰️</span><span class="item-text">ללא קיר תא</span></div>
        <div class="item"><span class="item-icon">⚫</span><span class="item-text">ללא כלורופלסטים</span></div>
        <div class="item"><span class="item-icon">💧</span><span class="item-text">ואקואול קטן</span></div>
        <div class="item"><span class="item-icon">⭕</span><span class="item-text">צורה עגולה</span></div>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Cycle Example - Circular process (Premium Design)
 */
const CYCLE_EXAMPLE = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1024px;
      height: 1024px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 50%, #16213e 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      position: relative;
      overflow: hidden;
    }
    body::before {
      content: '';
      position: absolute;
      width: 800px;
      height: 800px;
      background: conic-gradient(from 0deg, rgba(102,126,234,0.1), rgba(118,75,162,0.1), rgba(233,69,96,0.1), rgba(255,217,61,0.1), rgba(102,126,234,0.1));
      border-radius: 50%;
      animation: rotate 30s linear infinite;
    }
    @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .header {
      position: absolute;
      top: 40px;
      text-align: center;
      z-index: 10;
    }
    .title {
      font-size: 48px;
      font-weight: 800;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #e94560 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .cycle-container {
      position: relative;
      width: 750px;
      height: 750px;
      z-index: 1;
    }
    .cycle-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 200px;
      height: 200px;
      background: linear-gradient(135deg, rgba(102,126,234,0.3) 0%, rgba(118,75,162,0.3) 100%);
      backdrop-filter: blur(20px);
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: white;
      text-align: center;
      box-shadow: 0 0 60px rgba(102,126,234,0.4);
    }
    .step {
      position: absolute;
      width: 150px;
      padding: 18px 15px;
      background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 16px;
      text-align: center;
      font-size: 18px;
      font-weight: 600;
      color: white;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    }
    .step-icon { font-size: 32px; margin-bottom: 8px; display: block; }
    .step-1 { top: 20px; left: 50%; transform: translateX(-50%); border-top: 3px solid #FFD93D; }
    .step-2 { top: 160px; right: 40px; border-top: 3px solid #6BCB77; }
    .step-3 { bottom: 160px; right: 40px; border-top: 3px solid #4D96FF; }
    .step-4 { bottom: 20px; left: 50%; transform: translateX(-50%); border-top: 3px solid #e94560; }
    .step-5 { bottom: 160px; left: 40px; border-top: 3px solid #9D84B7; }
    .step-6 { top: 160px; left: 40px; border-top: 3px solid #FFA07A; }
    .connector {
      position: absolute;
      width: 50px;
      height: 3px;
      background: linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%);
    }
    .connector::after {
      content: '›';
      position: absolute;
      right: -8px;
      top: -12px;
      font-size: 24px;
      color: rgba(255,255,255,0.6);
    }
    .c1 { top: 100px; right: 200px; transform: rotate(30deg); }
    .c2 { top: 280px; right: 80px; transform: rotate(90deg); }
    .c3 { bottom: 200px; right: 130px; transform: rotate(150deg); }
    .c4 { bottom: 100px; left: 200px; transform: rotate(-150deg); }
    .c5 { top: 280px; left: 80px; transform: rotate(-90deg); }
    .c6 { top: 100px; left: 200px; transform: rotate(-30deg); }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">מחזור המים בטבע</div>
  </div>
  <div class="cycle-container">
    <div class="cycle-center">מחזור<br>המים</div>
    <div class="step step-1"><span class="step-icon">☀️</span>אידוי מהים</div>
    <div class="step step-2"><span class="step-icon">⬆️</span>עליית אדים</div>
    <div class="step step-3"><span class="step-icon">☁️</span>התעבות לעננים</div>
    <div class="step step-4"><span class="step-icon">🌧️</span>גשם ושלג</div>
    <div class="step step-5"><span class="step-icon">🌍</span>ספיגה באדמה</div>
    <div class="step step-6"><span class="step-icon">🌊</span>זרימה לים</div>
    <div class="connector c1"></div>
    <div class="connector c2"></div>
    <div class="connector c3"></div>
    <div class="connector c4"></div>
    <div class="connector c5"></div>
    <div class="connector c6"></div>
  </div>
</body>
</html>
`;

/**
 * Generate prompt for LLM to create similar HTML
 */
export const getInfographicHTMLPrompt = (
  text: string,
  visualType: InfographicType,
  topic?: string
): string => {
  const example = getExampleHTMLStructure(visualType);
  const typeDescriptions = {
    flowchart: 'תרשים זרימה אלגנטי עם שלבים עוקבים',
    timeline: 'ציר זמן מודרני עם אירועים',
    comparison: 'טבלת השוואה side-by-side',
    cycle: 'דיאגרמה מעגלית עם שלבים'
  };

  return `אתה מעצב גרפי מומחה ביצירת אינפוגרפיקות פרימיום בסגנון מודרני.

צור מסמך HTML יחיד המציג את התוכן כ-${typeDescriptions[visualType]}.

## דרישות עיצוב קריטיות:

### סגנון ויזואלי (חובה!)
- רקע כהה עם gradients (לדוגמה: #1a1a2e → #16213e → #0f3460)
- אלמנטים עם glass morphism: backdrop-filter: blur(10px), רקע שקוף חלקית
- גבולות עדינים: border: 1px solid rgba(255,255,255,0.2)
- צללים עמוקים: box-shadow: 0 8px 32px rgba(0,0,0,0.3)
- כותרות עם gradient text (background-clip: text)
- אייקונים emoji רלוונטיים לתוכן

### טקסט עברי
- dir="rtl" lang="he" על ה-html
- גופן: 'Segoe UI', Tahoma, Arial, sans-serif
- כותרת: 46-52px, font-weight: 800
- תוכן: 20-26px, font-weight: 600
- צבע טקסט: white או rgba(255,255,255,0.9)

### מבנה טכני
- גודל: בדיוק 1024x1024px על ה-body
- כל ה-CSS בתוך <style> בלבד (ללא קישורים חיצוניים)
- position: relative ו-overflow: hidden על body
- אלמנטים דקורטיביים עם ::before ו-::after

### פשטות
- מקסימום 4-5 אלמנטים מרכזיים
- לא להעמיס - להשאיר מרווחים
- כל אלמנט חייב להיות קריא

## תוכן לעיצוב:
${text}

${topic ? `## נושא: ${topic}` : ''}

## דוגמה לסגנון הנדרש (עקוב אחרי המבנה והסגנון):
${example}

פלוט רק קוד HTML תקין. ללא הסברים, ללא markdown code blocks.`;
};
