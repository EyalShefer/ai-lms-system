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
 * Flowchart Example - Process steps
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
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }
    .title {
      font-size: 48px;
      font-weight: bold;
      color: white;
      margin-bottom: 60px;
      text-align: center;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .flowchart {
      display: flex;
      flex-direction: column;
      gap: 40px;
      align-items: center;
    }
    .step {
      background: white;
      padding: 30px 50px;
      border-radius: 20px;
      box-shadow: 0 8px 20px rgba(0,0,0,0.2);
      font-size: 28px;
      font-weight: 600;
      color: #333;
      text-align: center;
      min-width: 600px;
      position: relative;
    }
    .step-number {
      position: absolute;
      top: -15px;
      right: -15px;
      background: #FF6B6B;
      color: white;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      font-weight: bold;
      box-shadow: 0 4px 10px rgba(255,107,107,0.4);
    }
    .arrow {
      color: white;
      font-size: 60px;
      line-height: 0;
    }
  </style>
</head>
<body>
  <div class="title">תהליך הפוטוסינתזה</div>
  <div class="flowchart">
    <div class="step">
      <div class="step-number">1</div>
      הצמח קולט אור שמש
    </div>
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-number">2</div>
      קליטת מים ומינרלים מהאדמה
    </div>
    <div class="arrow">↓</div>
    <div class="step">
      <div class="step-number">3</div>
      יצירת גלוקוז ופליטת חמצן
    </div>
  </div>
</body>
</html>
`;

/**
 * Timeline Example - Historical events
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
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      padding: 60px;
    }
    .title {
      font-size: 48px;
      font-weight: bold;
      color: white;
      margin-bottom: 80px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .timeline {
      position: relative;
      width: 100%;
      max-width: 900px;
    }
    .timeline-line {
      position: absolute;
      right: 50%;
      top: 0;
      bottom: 0;
      width: 6px;
      background: white;
      transform: translateX(50%);
    }
    .event {
      display: flex;
      align-items: center;
      margin-bottom: 60px;
      position: relative;
    }
    .event:nth-child(odd) {
      flex-direction: row;
      text-align: right;
    }
    .event:nth-child(even) {
      flex-direction: row-reverse;
      text-align: left;
    }
    .event-content {
      background: white;
      padding: 25px 35px;
      border-radius: 15px;
      box-shadow: 0 6px 15px rgba(0,0,0,0.2);
      flex: 1;
      max-width: 380px;
    }
    .event-date {
      font-size: 22px;
      font-weight: bold;
      color: #FF6B6B;
      margin-bottom: 10px;
    }
    .event-text {
      font-size: 20px;
      color: #333;
      line-height: 1.4;
    }
    .event-dot {
      width: 30px;
      height: 30px;
      background: #FFD93D;
      border: 5px solid white;
      border-radius: 50%;
      margin: 0 20px;
      position: relative;
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="title">אבני דרך בהיסטוריה</div>
  <div class="timeline">
    <div class="timeline-line"></div>
    <div class="event">
      <div class="event-content">
        <div class="event-date">1948</div>
        <div class="event-text">הקמת מדינת ישראל</div>
      </div>
      <div class="event-dot"></div>
      <div style="flex: 1;"></div>
    </div>
    <div class="event">
      <div style="flex: 1;"></div>
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
      <div style="flex: 1;"></div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Comparison Example - Side by side
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
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
      padding: 60px;
    }
    .title {
      font-size: 48px;
      font-weight: bold;
      color: white;
      margin-bottom: 60px;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }
    .comparison {
      display: flex;
      gap: 40px;
      width: 100%;
      max-width: 900px;
    }
    .column {
      flex: 1;
      background: white;
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .column-title {
      font-size: 36px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 4px solid;
    }
    .column:first-child .column-title {
      color: #FF6B6B;
      border-color: #FF6B6B;
    }
    .column:last-child .column-title {
      color: #4ECDC4;
      border-color: #4ECDC4;
    }
    .item {
      font-size: 22px;
      color: #333;
      margin-bottom: 20px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 10px;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="title">תא צמחי vs תא בעל חיים</div>
  <div class="comparison">
    <div class="column">
      <div class="column-title">תא צמחי</div>
      <div class="item">🌿 קיר תא קשיח</div>
      <div class="item">🟢 כלורופלסטים</div>
      <div class="item">💧 ואקואול גדול</div>
      <div class="item">📐 צורה מרובעת</div>
    </div>
    <div class="column">
      <div class="column-title">תא בעל חיים</div>
      <div class="item">🧬 ללא קיר תא</div>
      <div class="item">⚫ ללא כלורופלסטים</div>
      <div class="item">💧 ואקואול קטן</div>
      <div class="item">⚪ צורה עגולה</div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Cycle Example - Circular process
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
      background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: rtl;
    }
    .title {
      font-size: 48px;
      font-weight: bold;
      color: #333;
      margin-bottom: 60px;
      text-shadow: 2px 2px 4px rgba(255,255,255,0.5);
    }
    .cycle-container {
      position: relative;
      width: 700px;
      height: 700px;
    }
    .cycle-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 250px;
      height: 250px;
      background: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      font-weight: bold;
      color: #333;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      text-align: center;
      padding: 20px;
    }
    .step {
      position: absolute;
      width: 180px;
      padding: 25px;
      background: white;
      border-radius: 15px;
      box-shadow: 0 6px 15px rgba(0,0,0,0.15);
      text-align: center;
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }
    .step-1 { top: 0; left: 50%; transform: translateX(-50%); background: #FFD93D; }
    .step-2 { right: 50px; top: 150px; background: #6BCB77; }
    .step-3 { right: 50px; bottom: 150px; background: #4D96FF; color: white; }
    .step-4 { bottom: 0; left: 50%; transform: translateX(-50%); background: #FF6B6B; color: white; }
    .step-5 { left: 50px; bottom: 150px; background: #9D84B7; color: white; }
    .step-6 { left: 50px; top: 150px; background: #FFA07A; }
    .arrow {
      position: absolute;
      font-size: 60px;
      color: #666;
    }
    .arrow-1 { top: 100px; right: 200px; }
    .arrow-2 { right: 100px; bottom: 250px; transform: rotate(60deg); }
    .arrow-3 { bottom: 100px; right: 250px; transform: rotate(-30deg); }
    .arrow-4 { bottom: 100px; left: 250px; transform: rotate(30deg); }
    .arrow-5 { left: 100px; top: 250px; transform: rotate(-60deg); }
    .arrow-6 { top: 100px; left: 200px; }
  </style>
</head>
<body>
  <div class="title">מחזור המים בטבע</div>
  <div class="cycle-container">
    <div class="cycle-center">מחזור<br>המים</div>
    <div class="step step-1">אידוי מהים</div>
    <div class="step step-2">עליית אדים</div>
    <div class="step step-3">התעבות לעננים</div>
    <div class="step step-4">גשם ושלג</div>
    <div class="step step-5">ספיגה באדמה</div>
    <div class="step step-6">זרימה לים</div>
    <div class="arrow arrow-1">→</div>
    <div class="arrow arrow-2">→</div>
    <div class="arrow arrow-3">→</div>
    <div class="arrow arrow-4">→</div>
    <div class="arrow arrow-5">→</div>
    <div class="arrow arrow-6">→</div>
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
    flowchart: 'תרשים זרימה עם שלבים עוקבים וחיצים',
    timeline: 'ציר זמן אופקי או אנכי עם אירועים',
    comparison: 'השוואה בין שני דברים side-by-side',
    cycle: 'מחזור מעגלי עם שלבים חוזרים'
  };

  return `אתה מפתח HTML/CSS מומחה המתמחה באינפוגרפיקות חינוכיות.

צור מסמך HTML מלא ועצמאי המציג את התוכן הבא כ-${typeDescriptions[visualType]}.

דרישות קריטיות:
1. **תמיכה בעברית RTL**: השתמש ב-dir="rtl" וגופנים עבריים ברורים
2. **עצמאי לחלוטין**: כל הסגנונות חייבים להיות inline או בתוך <style> (ללא קישורים חיצוניים)
3. **גודל**: בדיוק 1024x1024px
4. **גופנים**: השתמש בגופנים עבריים של המערכת (Arial, Tahoma, 'Segoe UI')
5. **צבעים**: פלטת צבעים חינוכית (תוססת אך מקצועית, gradients מתוחכמים)
6. **פריסה**: ברורה, נקייה, מתאימה למצגת כיתתית
7. **RTL**: הקפד על כיווניות נכונה מימין לשמאל

תוכן לויזואליזציה:
${text}

${topic ? `נושא: ${topic}` : ''}

דוגמה לסגנון ומבנה (התאם לתוכן שלך):
${example}

הוראות חשובות:
- שמור על אותו רמת עיצוב ומקצועיות כמו בדוגמה
- התאם את הצבעים והסגנון לתוכן
- הקפד על גופנים גדולים וברורים (לפחות 20px)
- השתמש בצללים ו-gradients ליופי ומקצועיות
- הקפד על ניגודיות גבוהה לקריאות

פלוט רק את קוד ה-HTML, ללא הסברים.`;
};
