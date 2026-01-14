# תיעוד מערכת יצירת אינפוגרפיקות - AI LMS

## סיכום העבודה שנעשתה היום (12/01/2026)

### מה בנינו

מערכת יצירת אינפוגרפיקות חינוכיות בעברית עם שלושה מסלולים:

1. **Gemini 2.0 Flash (נוכחי - עובד)**
   - יוצר HTML ישירות מתוכן חינוכי
   - ממיר ל-PNG בצד הלקוח עם `html-to-image`
   - קובץ: `src/services/ai/geminiApi.ts` - פונקציה `generateInfographic`

2. **Gemini 3 Pro Preview (חדש - Cloud Function)**
   - מודל טקסט מתקדם יותר
   - מחזיר HTML איכותי יותר
   - קבצים:
     - `functions/src/gemini3InfographicService.ts` - Cloud Function
     - `functions/src/services/gemini3TextService.ts` - הלוגיקה

3. **Imagen 4 (חדש - Cloud Function)**
   - יוצר תמונות AI אמיתיות (לא HTML)
   - קבצים:
     - `functions/src/imagen4InfographicService.ts` - Cloud Function
     - `functions/src/services/imagen4Service.ts` - הלוגיקה

---

## ארכיטקטורה נוכחית

```
Frontend (geminiApi.ts)
    │
    ├──► generateInfographic() [מקומי]
    │    └── Gemini 2.0 Flash → HTML → html-to-image → PNG
    │
    ├──► generateInfographicWithGemini3() [Cloud Function]
    │    └── POST /generateGemini3Infographic
    │         └── gemini-3-pro-preview → HTML
    │
    └──► generateInfographicWithImagen4() [Cloud Function]
         └── POST /generateImagen4Infographic
              └── imagen-4.0-generate-001 → PNG Base64
```

---

## קבצים עיקריים

### Frontend
| קובץ | תיאור |
|------|-------|
| `src/services/ai/geminiApi.ts` | API ראשי - פונקציות יצירת אינפוגרפיקה |
| `src/utils/infographicCache.ts` | מטמון IndexedDB לאינפוגרפיקות |
| `src/services/infographicAnalytics.ts` | אנליטיקה ומעקב שימוש |

### Backend (Cloud Functions)
| קובץ | תיאור |
|------|-------|
| `functions/src/gemini3InfographicService.ts` | Endpoint ל-Gemini 3 Pro |
| `functions/src/services/gemini3TextService.ts` | לוגיקת יצירת HTML עם Gemini 3 |
| `functions/src/imagen4InfographicService.ts` | Endpoint ל-Imagen 4 |
| `functions/src/services/imagen4Service.ts` | לוגיקת יצירת תמונות |
| `functions/src/index.ts` | רישום ה-exports |

---

## סוגי ויזואליזציות נתמכים

```typescript
type VisualType = 'flowchart' | 'timeline' | 'comparison' | 'cycle';
```

- **flowchart**: תרשים זרימה (תהליכים, שלבים)
- **timeline**: ציר זמן (היסטוריה, רצף אירועים)
- **comparison**: השוואה (מושגים, אפשרויות)
- **cycle**: מחזור (תהליכים מחזוריים)

---

## איך זה עובד

### 1. קריאה מהפרונטאנד
```typescript
// geminiApi.ts
const result = await generateInfographic(
  content,     // תוכן חינוכי בעברית
  visualType,  // 'flowchart' | 'timeline' | 'comparison' | 'cycle'
  topic        // נושא אופציונלי
);
// result = { imageUrl: 'data:image/png;base64,...', html: '...' }
```

### 2. יצירת HTML (Gemini)
הפרומפט מבקש HTML מובנה עם:
- RTL תמיכה מלאה
- צבעים מותאמים לסוג הויזואליזציה
- פונטים עבריים
- תמיכה ב-SVG לאייקונים

### 3. המרה לתמונה
```typescript
import * as htmlToImage from 'html-to-image';

// יוצרים DOM element מוסתר
const container = document.createElement('div');
container.innerHTML = html;
document.body.appendChild(container);

// ממירים ל-PNG
const dataUrl = await htmlToImage.toPng(container);
```

---

## בעיות שנפתרו

### 1. בעיית Location ב-Gemini 3 Pro
**בעיה:** `gemini-3-pro-preview` לא זמין ב-us-central1
**פתרון:** שינינו ל-location: 'global'

```typescript
// gemini3TextService.ts
export const GEMINI3_TEXT_CONFIG = {
    model: 'gemini-3-pro-preview',
    location: 'global',  // חובה!
};
```

### 2. בעיית תמיכה בעברית
**בעיה:** הפונטים לא נטענים נכון
**פתרון:** שימוש ב-system fonts בלבד

```css
font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
```

### 3. בעיית CORS
**בעיה:** הקריאות ל-Cloud Functions נחסמות
**פתרון:** הוספנו `cors: true` בהגדרות ה-Function

---

## מה עוד צריך לעשות

### עדיפות גבוהה
1. [ ] לבדוק את ה-Gemini 3 Pro בפרודקשיין
2. [ ] להפעיל את Imagen 4 (צריך לאפשר API)
3. [ ] להוסיף fallback אוטומטי בין השירותים

### עדיפות בינונית
4. [ ] לשפר את איכות ה-HTML שנוצר
5. [ ] להוסיף עוד סוגי ויזואליזציות (mindmap, pyramid)
6. [ ] לבנות ממשק לבחירת סגנון/צבעים

### עדיפות נמוכה
7. [ ] להוסיף אפשרות עריכה של האינפוגרפיקה
8. [ ] לשמור היסטוריה של אינפוגרפיקות שנוצרו
9. [ ] להוסיף אפשרות שיתוף

---

## קונפיגורציה נדרשת

### משתני סביבה (Functions)
```bash
# .env.local או Firebase config
ENABLE_GEMINI3=true          # להפעיל Gemini 3 Pro
ENABLE_IMAGEN4=true          # להפעיל Imagen 4
GOOGLE_CLOUD_PROJECT=ai-lms-pro
```

### APIs נדרשים ב-GCP
- Vertex AI API
- Cloud Functions
- Secret Manager (לאחסון מפתחות)

---

## בדיקה מקומית

```bash
# להריץ את ה-Functions מקומית
cd functions
npm run serve

# לבדוק endpoint
curl -X POST http://localhost:5001/ai-lms-pro/us-central1/generateGemini3Infographic \
  -H "Content-Type: application/json" \
  -d '{"content": "מחזור המים בטבע", "visualType": "cycle"}'
```

---

## לינקים שימושיים

- [Gemini 3 Pro Preview Docs](https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini-3-pro)
- [Imagen 4 Docs](https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images)
- [html-to-image Library](https://github.com/bubkoo/html-to-image)

---

## Commit של היום
```
feat: Infographic generation with Gemini 3 Pro & Imagen 4, licensing system, and UI improvements
Commit: 2536220
```

---

*תיעוד זה נוצר ב-12/01/2026*
