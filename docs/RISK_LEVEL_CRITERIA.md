# קריטריונים לסיווג רמת סיכון תלמידים

## מטרה
מערכת ה-LMS מסווגת תלמידים לפי 3 רמות סיכון כדי לסייע למורים לזהות תלמידים הזקוקים לתשומת לב מיוחדת.

## הקריטריונים (מתוך analyticsService.ts)

### 🔴 High Risk (דורשים תשומת לב מיוחדת)

תלמיד יסווג כ-**High Risk** אם מתקיים **אחד או יותר** מהתנאים הבאים:

1. **דיוק נמוך**: `accuracy < 40%`
   - פחות מ-40% תשובות נכונות

2. **תלות גבוהה ברמזים**: `hintDependency > 70%`
   - משתמש ברמזים ביותר מ-70% מהשאלות

3. **שליטה נמוכה בנושא**: `avgMastery < 30%`
   - רמת שליטה (לפי BKT) פחות מ-30%

**דוגמה מהסימולציה:**
- שרה כהן: דיוק 38%, שליטה 25% → **High Risk** ✓

---

### 🟡 Medium Risk (ביצועים ממוצעים)

תלמיד יסווג כ-**Medium Risk** אם:
- **לא** נמצא ב-High Risk (לא עומד באף אחד מהקריטריונים הקודמים)
- **אבל** מתקיים **אחד או יותר** מהתנאים הבאים:

1. **דיוק בינוני**: `accuracy < 70%`
   - פחות מ-70% תשובות נכונות

2. **תלות בינונית ברמזים**: `hintDependency > 40%`
   - משתמש ברמזים ביותר מ-40% מהשאלות

3. **שליטה בינונית**: `avgMastery < 60%`
   - רמת שליטה פחות מ-60%

**דוגמה מהסימולציה:**
- דוד לוי: דיוק 50%, שליטה 68% → **Medium Risk** ✓

---

### 🟢 Low Risk (מצטיינים)

תלמיד יסווג כ-**Low Risk** אם:
- דיוק ≥ 70%
- תלות ברמזים ≤ 40%
- שליטה ≥ 60%

**דוגמה מהסימולציה:**
- מאיה אברהם: דיוק 100%, שליטה 95% → **Low Risk** ✓

---

## איך זה מוצג בדשבורד?

### 1. **"דורשים תשומת לב"** (High Risk)
- מוצג בקופסה הצהובה עם סמל אזהרה
- מכיל תלמידים עם `riskLevel === 'high'`
- מציג את הדיוק (accuracy) של כל תלמיד

### 2. **קבוצות בסטטיסטיקה הכללית**
```typescript
const struggling = students.filter(s => s.riskLevel === 'high');
const average = students.filter(s => s.riskLevel === 'medium');
const advanced = students.filter(s => s.riskLevel === 'low');
```

### 3. **צבעים ורמזים חזותיים**
- 🔴 High Risk: צהוב/כתום (אזהרה)
- 🟡 Medium Risk: כחול/אפור (רגיל)
- 🟢 Low Risk: ירוק (מצטיין)

---

## חשוב לדעת!

### נתונים ספציפיים לקורס vs גלובליים

**עכשיו (אחרי התיקון):**
- כשצופים בדשבורד של **קורס ספציפי**, הקריטריונים מחושבים **רק מהקורס הזה**
- הדיוק, השליטה, והתלות ברמזים - כולם מבוססים על הביצועים **בקורס הנוכחי בלבד**

**לפני התיקון:**
- הנתונים היו גלובליים מכל הקורסים
- זה גרם למצב שבו תלמידה מצטיינת בקורס אחד הייתה מוצגת כ"דורשת תשומת לב" בגלל ביצועים נמוכים בקורס אחר

---

## קוד המימוש

### מיקום: `src/services/analyticsService.ts`

```typescript
const calculateRiskLevel = (
    accuracy: number,
    hintDependency: number,
    avgMastery: number
): 'low' | 'medium' | 'high' => {
    // High risk: low accuracy OR high hint dependency OR low mastery
    if (accuracy < 0.4 || hintDependency > 0.7 || avgMastery < 0.3) {
        return 'high';
    }
    // Medium risk: moderate performance
    if (accuracy < 0.7 || hintDependency > 0.4 || avgMastery < 0.6) {
        return 'medium';
    }
    // Low risk: good performance
    return 'low';
};
```

---

## דוגמאות מהסימולציה

| תלמיד | דיוק | שליטה | רמזים | Risk Level | הסבר |
|-------|------|-------|--------|-----------|------|
| שרה כהן | 38% | 25% | 90% | 🔴 High | דיוק < 40% AND שליטה < 30% AND רמזים > 70% |
| דוד לוי | 50% | 68% | 40% | 🟡 Medium | דיוק < 70% |
| מאיה אברהם | 100% | 95% | 10% | 🟢 Low | כל הקריטריונים מצוינים |

---

## שינויים שנעשו (2026-01-24)

### 1. **חישוב ספציפי לקורס**
- ✅ Accuracy מחושב מהסשנים של הקורס הנוכחי
- ✅ Mastery לוקח מה-proficiency topics של הקורס הנוכחי
- ✅ HintDependency מחושב מהאינטראקציות של הקורס הנוכחי

### 2. **לוגים משופרים**
```typescript
console.log(`🎯 [getStudentAnalytics] Risk calculation for ${studentId}:`, {
    accuracy: (accuracy * 100).toFixed(1) + '%',
    hintDependency: (hintDependency * 100).toFixed(1) + '%',
    avgMastery: (avgMastery * 100).toFixed(1) + '%',
    riskLevel,
    courseId: courseId || 'none'
});
```

### 3. **תיקון בדשבורד**
- עמודת "ציון" ברשימת התלמידים עכשיו מציגה **דיוק** במקום שליטה
- שינוי התווית מ"ממוצע" ל"דיוק"

---

## טיפים למורים

1. **מצב הקצנה (Alert Fatigue):**
   - אם יש הרבה תלמידים ב-High Risk, שקול ליצור פעילות תגבור קבוצתית
   - השתמש ב"צור חומר תגבור לקבוצה" מהקופסה "דורשים תשומת לב"

2. **מעקב אחר שיפור:**
   - בדוק אם תלמידים מתקדמים מ-High ל-Medium או ל-Low לאורך זמן
   - זה מעיד על יעילות ההתערבות החינוכית

3. **שימוש נבון ברמזים:**
   - תלות גבוהה ברמזים (>70%) יכולה להעיד על חוסר הבנה עמוקה
   - שקול לספק scaffolding מותאם אישית במקום רמזים כלליים

---

## מקרי קצה (Edge Cases)

1. **תלמיד חדש ללא נתונים:**
   - אם אין סשנים: `riskLevel = 'medium'` (ברירת מחדל)

2. **קורס ללא courseId:**
   - משתמש בנתונים גלובליים
   - זה יכול לגרום לאי-דיוקים אם התלמיד לומד מספר קורסים

3. **תלמיד עם 0 שאלות:**
   - accuracy = 0, mastery = 0 → High Risk

---

## תיעוד נוסף

- [Analytics Service Documentation](./ANALYTICS_SERVICE.md)
- [Dashboard Components](./DASHBOARD_COMPONENTS.md)
- [Simulation Testing](./SIMULATION_TESTING.md)
