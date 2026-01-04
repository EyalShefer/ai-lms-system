# 🎨 תכונת יצירת אינפוגרפיקה - Infographic Generator

## סקירה כללית

המערכת כוללת כעת יכולת מתקדמת ליצירת אינפוגרפיקות חינוכיות באמצעות DALL-E 3, המאפשרת למורים להמיר תוכן טקסטואלי לויזואליזציות ברורות ומושכות.

---

## 🚀 איך להשתמש

### מ-Teacher Cockpit:

1. **פתח את Teacher Cockpit** עבור יחידת לימוד
2. **Hover על בלוק** - יופיעו בקרות בפינה השמאלית העליונה
3. **לחץ על אייקון האינפוגרפיקה** 📊 (צבע סגול)
4. **בחר סוג אינפוגרפיקה**:
   - 🔄 **תרשים זרימה (Flowchart)** - תהליכים ורצפים
   - ⏱️ **ציר זמן (Timeline)** - אירועים כרונולוגיים
   - ⚖️ **השוואה (Comparison)** - ניגודים והשוואות
   - 🔁 **מחזור (Cycle)** - תהליכים מחזוריים

5. **המתן 10-15 שניות** - האינפוגרפיקה תיווצר ותתווסף מיד אחרי הבלוק הנוכחי

---

## 📁 קבצים שונו

### 1. `src/services/ai/geminiApi.ts`
**פונקציה חדשה:**
```typescript
generateInfographicFromText(
  text: string,
  visualType: 'flowchart' | 'timeline' | 'comparison' | 'cycle',
  topic?: string
): Promise<Blob | null>
```

**תכונות:**
- Prompts ייעודיים לכל סוג אינפוגרפיקה
- תמיכה בעברית (RTL)
- אופטימיזציה לשימוש חינוכי
- Truncation אוטומטי של טקסט ארוך (2000 תווים)

---

### 2. `src/icons.tsx`
**אייקון חדש:**
```typescript
export const IconInfographic
```
- עיצוב: 4 ריבועים עם חיבורים (מסמל תרשים מבנה)
- צבע: סגול (purple-600) להבדלה

---

### 3. `src/components/TeacherCockpit.tsx`

**State חדש:**
```typescript
const [showInfographicMenu, setShowInfographicMenu] = useState<string | null>(null);
const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
```

**פונקציה:**
```typescript
handleGenerateInfographic(block: ActivityBlock, visualType: InfographicType)
```

**תכונות UI:**
- כפתור אינפוגרפיקה בבקרות בלוק (hover)
- תפריט נפתח עם 4 אפשרויות
- Loading indicator ("יוצר אינפוגרפיקה...")
- יצירת בלוק תמונה חדש אוטומטית

---

## 💰 עלויות

| מודל | עלות לתמונה | עלות ל-1000 תמונות |
|------|-------------|-------------------|
| **DALL-E 3 Standard** (1024x1024) | $0.040 | **$40** |
| **Imagen 3** (חלופה) | $0.020 | **$20** (חיסכון 50%) |

### המלצה:
- נכון לעכשיו: **DALL-E 3** (כבר מחובר)
- עתיד: שקול **Imagen 3** דרך Firebase AI SDK לחיסכון בעלויות

---

## 🎯 מקרי שימוש מומלצים

### 1. תרשים זרימה (Flowchart)
- **מתי**: תהליכים, אלגוריתמים, רצפים לוגיים
- **דוגמה**: "תהליך הפוטוסינתזה", "מעגל המים"

### 2. ציר זמן (Timeline)
- **מתי**: אירועים היסטוריים, התפתחות כרונולוגית
- **דוגמה**: "מלחמת העולם השנייה", "התפתחות הטכנולוגיה"

### 3. השוואה (Comparison)
- **מתי**: ניגודים, Venn diagrams, טבלאות השוואה
- **דוגמה**: "תאים בעלי חיים vs צמחים", "דמוקרטיה vs דיקטטורה"

### 4. מחזור (Cycle)
- **מתי**: מחזורים טבעיים, לולאות
- **דוגמה**: "מחזור החיים של פרפר", "מחזור כלכלי"

---

## 🔧 שיפורים עתידיים (רשימת TODO)

### בעדיפות גבוהה:
- [ ] **Caching** - שמירת אינפוגרפיקות שנוצרו (hash based)
- [ ] **Auto-detect** - זיהוי אוטומטי של סוג אינפוגרפיקה מתוך הטקסט
- [ ] **Edit prompts** - אפשרות למורה לערוך את ה-prompt לפני יצירה

### בעדיפות בינונית:
- [ ] **Imagen 3 fallback** - חיסכון בעלויות
- [ ] **Preview mode** - תצוגה מקדימה לפני הוספה
- [ ] **Templates gallery** - ספריית דוגמאות

### בעדיפות נמוכה:
- [ ] **Analytics** - מעקב: "תלמידים עם אינפוגרפיקה לומדים X% יותר טוב"
- [ ] **Batch generation** - יצירה מרובה בלחיצה אחת
- [ ] **Custom styles** - בחירת palette צבעים

---

## 🐛 Troubleshooting

### בעיה: "שגיאה ביצירת אינפוגרפיקה"
**פתרונות:**
1. ודא ש-OPENAI_API_KEY מוגדר ב-Firebase Secrets
2. בדוק ש-openaiProxy פועל (functions deployed)
3. ודא שיש מספיק quota ב-OpenAI account

### בעיה: תמונה ללא טקסט עברי
**פתרונות:**
- ה-prompts כוללים "Hebrew text labels" - DALL-E 3 אמור לתמוך
- אם הבעיה נמשכת, נסה להוסיף עוד הקשר בפרומפט
- שקול שימוש ב-Imagen 3 (תמיכה טובה יותר ב-RTL)

### בעיה: יצירה איטית (>30 שניות)
**זה נורמלי!** DALL-E 3 לוקח בממוצע 10-20 שניות
- אינדיקטור הטעינה יודיע למשתמש
- אפשר להמשיך לעבוד בזמן היצירה (לא blocking)

---

## 📊 דוגמאות Prompts

### Flowchart:
```
Create a clean educational flowchart infographic showing the process described below.
Style: Minimalist, clear arrows, colorful boxes, suitable for classroom presentation.
Include Hebrew text labels extracted from the content.
Layout: Top-to-bottom flow with decision diamonds where applicable.
Topic: מחזור המים

Content to visualize:
המים מתאדים מהים... [טקסט מלא]

Requirements:
- Clear, large Hebrew text (RTL support)
- High contrast colors (educational palette)
- Numbered steps if sequential
- Professional diagram style
```

---

## 🎓 טיפים למורים

1. **התחל פשוט** - נסה עם תרשים זרימה קצר
2. **ערוך את הטקסט** - ודא שהתוכן ברור ומאורגן לפני יצירת האינפוגרפיקה
3. **נסה מספר סוגים** - לפעמים "השוואה" עובדת טוב יותר מ"ציר זמן"
4. **שמור את המוצלחים** - בלוקי תמונה נשמרים אוטומטית
5. **שתף ידע** - אם אינפוגרפיקה יצאה מעולה, שתף עם עמיתים

---

## 📚 קישורים

- [DALL-E 3 Documentation](https://platform.openai.com/docs/guides/images)
- [Firebase AI (Imagen)](https://firebase.google.com/docs/vertex-ai/image-generation)
- [Best Practices for Educational Infographics](https://www.canva.com/learn/infographic-design/)

---

**נוצר ב:** 2026-01-04
**גרסה:** 1.0.0
**תמיכה:** eyal@example.com
