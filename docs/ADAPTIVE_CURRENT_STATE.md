# מערכת למידה אדפטיבית - מקור אמת
## Adaptive Learning System - Current State

**עדכון אחרון:** 26 בינואר 2026
**סטטוס:** מסמך מקור אמת (Source of Truth)

---

## 1. תקציר מצב

### מה עובד:
| רכיב | סטטוס | קובץ ראשי |
|------|--------|-----------|
| BKT Cloud Function | ✅ פעיל | `functions/src/index.ts:2241-2334` |
| ProfileService | ✅ פעיל | `src/services/profileService.ts` |
| Variant Cache | ✅ פעיל | `src/services/variantCacheService.ts` |
| Topic Taxonomy | ✅ פעיל | `src/data/topicTaxonomy.ts` |
| Gamification | ✅ פעיל | `src/services/gamificationService.ts` |
| Progressive Variant Gen | ✅ פעיל | `functions/src/services/variantGenerationService.ts` |
| Variant Readiness Hook | ✅ פעיל | `src/hooks/useVariantReadiness.ts` |
| **Feature Flags** | ✅ חדש | `src/config/adaptiveFeatureFlags.ts` |
| **IRT Calibration** | ✅ חדש | `functions/src/services/irtCalibrationService.ts` |
| **Forgetting Curve** | ✅ חדש | `src/services/adaptiveEnhancementsService.ts` |
| **Learning Trend** | ✅ חדש | `src/services/adaptiveEnhancementsService.ts` |
| **A/B Testing** | ✅ חדש | `src/services/adaptiveEnhancementsService.ts` |

### מה נוסף (26/01/2026):
| רכיב | תיאור | סטטוס |
|------|-------|-------|
| IRT Calibration | כיול קושי שאלות מנתוני תלמידים אמיתיים | ✅ מיושם (כבוי) |
| Forgetting Curve | mastery דועך עם הזמן | ✅ מיושם (כבוי) |
| Learning Trend | זיהוי מגמת שיפור/ירידה | ✅ מיושם (כבוי) |
| A/B Testing | תשתית לניסויים | ✅ מיושם (כבוי) |

---

## 2. הבעיה המזוהה

### זרימת יצירת פעילות (נוכחית):

```
מורה יוצר פעילות חדשה
        │
        ▼
┌─────────────────────────────┐
│ CourseWizard                │
│ handleWizardComplete()      │
│                             │
│ ⚠️ קורא: generateUnitSkeleton│
│    + generateStepContent    │
│                             │
│ ❌ לא קורא:                  │
│    generateFullUnitContent  │
│    WithVariants             │
└─────────────────────────────┘
        │
        ▼
    וריאנטים לא נוצרים!
```

### איפה וריאנטים כן נוצרים:

```typescript
// CourseEditor.tsx - handleSaveUnit (שורה ~1565)
// נקרא רק כשמורה שומר יחידה ומייצר את היחידה הבאה
await generateFullUnitContentWithVariants(...)
```

**משמעות:** פעילות עם יחידה אחת (רוב הפעילויות) לעולם לא תכלול וריאנטים.

---

## 3. הארכיטקטורה החדשה (מוצעת)

### עקרון: Progressive Variant Generation

במקום ליצור וריאנטים בזמן יצירת הפעילות (חוסם), ניצור אותם:
1. **ברקע** - אחרי שמורה שולח משימה
2. **לפי צורך** - רק כשתלמיד עומד להזדקק להם
3. **Bloom-aware** - רק וריאנטים שסביר שיידרשו

### שלבי הזרימה החדשה:

```
מורה שולח משימה לתלמיד
        │
        ▼
┌─────────────────────────────┐
│ Assignment Created          │
│ status: "preparing"         │
└─────────────────────────────┘
        │
        ▼ (Cloud Function trigger)
┌─────────────────────────────┐
│ Background Variant Gen      │
│                             │
│ לכל block:                  │
│   • בדוק Bloom level        │
│   • צור variant מתאים       │
│   • שמור ב-variants_cache   │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Assignment Ready            │
│ status: "ready"             │
└─────────────────────────────┘
        │
        ▼
    תלמיד פותח משימה
        │
        ▼
┌─────────────────────────────┐
│ Player בודק cache           │
│ • אם variant קיים → משתמש  │
│ • אם לא → fallback לoriginal│
└─────────────────────────────┘
```

---

## 4. אסטרטגיית Bloom-Aware

### הרעיון:
לא כל שאלה צריכה את כל הוריאנטים. נייצר רק את מה שרלוונטי:

| רמת Bloom של השאלה | וריאנט "הבנה" | וריאנט "העמקה" |
|-------------------|---------------|----------------|
| **הבנה** (Remember/Understand) | ❌ לא צריך | ✅ כן |
| **יישום** (Apply/Analyze) | ✅ כן | ✅ כן |
| **העמקה** (Evaluate/Create) | ✅ כן | ❌ לא צריך |

### חיסכון צפוי:
- ללא אסטרטגיה: 14 קריאות API לפעילות עם 7 שאלות
- עם Bloom-aware: ~10 קריאות בממוצע (29% חיסכון)
- עם Progressive: ~1.05 קריאות בממוצע (92% חיסכון נוסף)

---

## 5. מבנה Firestore

### קיים:
```
variants_cache/
└── {blockId}_{variantType}/
    ├── activityId: string
    ├── blockId: string
    ├── variantType: "הבנה" | "העמקה"
    ├── content: ActivityBlock
    ├── topic: string
    ├── generatedAt: Timestamp
    ├── expiresAt: Timestamp (TTL: 90 days)
    └── metadata: {
        version: string,
        generationTimeMs: number,
        generationMethod: "background" | "on-demand"
    }
```

### נדרש (חדש):
```
assignments/
└── {assignmentId}/
    ├── status: "preparing" | "ready" | "sent"
    ├── variantGenerationProgress: {
        total: number,
        completed: number,
        failed: number
    }
    └── createdAt: Timestamp
```

---

## 6. קבצים מרכזיים

### שירותי Variants:
| קובץ | תפקיד |
|------|-------|
| `src/services/variantCacheService.ts` | Cache CRUD + generation |
| `src/services/adaptiveContentService.ts` | יצירת תוכן וריאנטים |
| `src/hooks/useVariantPolling.ts` | Polling עד שvariant מוכן |

### מנוע אדפטיבי:
| קובץ | תפקיד |
|------|-------|
| `functions/src/index.ts:1100-1188` | BKT calculation |
| `src/services/profileService.ts` | Student profile persistence |
| `src/services/adaptivePolicyService.ts` | Policy decisions |
| `src/data/topicTaxonomy.ts` | Topic hierarchy |

### Player:
| קובץ | תפקיד |
|------|-------|
| `src/components/SequentialCoursePlayer.tsx` | Main adaptive player |

---

## 7. סטטוס מימוש (מעודכן 25/01/2026)

### Phase 1: Infrastructure ✅ הושלם
- [x] הוספת שדה `variantStatus` ל-StudentTask (`src/shared/types/courseTypes.ts`)
- [x] Cloud Function trigger על יצירת task (`functions/src/index.ts`)
- [x] Bloom-level detection בזמן generation (`functions/src/services/variantGenerationService.ts`)

### Phase 2: Background Generation ✅ הושלם
- [x] יצירת וריאנטים ברקע אחרי שליחת משימה
- [x] עדכון progress ב-task doc (`variantStats`)
- [x] Timeout handling (540 seconds max)

### Phase 3: Player Integration ✅ הושלם
- [x] Hook לבדיקת status (`src/hooks/useVariantReadiness.ts`)
- [x] Overlay component (`src/components/VariantPreparationOverlay.tsx`)
- [x] Fallback graceful אם variant לא מוכן

### Phase 4: Visual Indicators ✅ הושלם (25/01/2026)
- [x] אינדיקטור אדפטיבי בצד תלמיד - אייקון מוח מופיע כשמוצג וריאנט מותאם
- [x] אינדיקטור בדשבורד מורה - סימון בטבלה כשפעילות מוכנה עם וריאנטים

### קבצים שנוצרו/עודכנו:
| קובץ | סוג | תיאור |
|------|-----|-------|
| `functions/src/services/variantGenerationService.ts` | חדש | לוגיקת Bloom-aware generation |
| `src/hooks/useVariantReadiness.ts` | חדש | Hook לבדיקת מוכנות |
| `src/components/VariantPreparationOverlay.tsx` | חדש | UI להמתנה |
| `functions/src/index.ts` | עריכה | הוספת `onVariantGenerationRequired` |
| `src/shared/types/courseTypes.ts` | עריכה | הוספת `VariantGenerationStatus` |
| `src/components/SequentialCoursePlayer.tsx` | עריכה | אינטגרציית readiness + אינדיקטור וריאנט |
| `src/components/TeacherDashboard.tsx` | עריכה | אינדיקטור אדפטיבי בדשבורד מורה |

---

## 8. הרחבות אדפטיביות (26/01/2026)

### 8.1 Feature Flags

כל ההרחבות החדשות מבוקרות על ידי feature flags. כברירת מחדל הכל **כבוי** לשמירה על תאימות לאחור.

```typescript
// src/config/adaptiveFeatureFlags.ts
export const ADAPTIVE_FEATURE_FLAGS = {
    useIrtDifficulty: false,      // IRT calibration
    useTrendAnalysis: false,      // Learning trend
    useForgettingCurve: false,    // Forgetting curve
    enableABTesting: false,       // A/B testing
    usePrerequisiteCheck: false,  // Prerequisites check
};
```

### 8.2 IRT Calibration (Item Response Theory)

**מטרה:** חישוב קושי שאלות מנתוני תלמידים אמיתיים במקום הערכת AI.

**קבצים:**
| קובץ | תפקיד |
|------|-------|
| `functions/src/services/irtCalibrationService.ts` | שירות כיול IRT |
| `functions/src/index.ts` (submitAdaptiveAnswer) | איסוף נתונים |
| `functions/src/index.ts` (runIRTCalibrationScheduled) | Job יומי |

**Collections:**
```
irt_submission_logs/{logId}     # נתוני תשובות לכיול
├── questionId, variantId, variantType
├── isCorrect, responseTimeMs
├── studentMasteryAtSubmission
└── timestamp

question_calibration/{questionId}_{variantType}   # תוצאות כיול
├── irtDifficulty              # קושי בסקאלת theta (-3 עד +3)
├── discrimination             # כמה השאלה מבדילה (0.5-2.5)
├── guessingParam              # הסתברות ניחוש
├── calibrationN               # מספר תשובות
└── lastCalibrated
```

**זרימה:**
```
תלמיד עונה → submitAdaptiveAnswer → log ל-irt_submission_logs
                                            │
                              ← ← ← ← ← ← ← ┘
                              │
                    Job יומי (04:00)
                              │
                              ▼
            runIRTCalibration (min 30 תשובות)
                              │
                              ▼
            שמירה ב-question_calibration
                              │
                              ▼
            BKT משתמש ב-IRT difficulty
```

### 8.3 Forgetting Curve (עקומת שכחה)

**מטרה:** mastery דועך עם הזמן אם התלמיד לא תרגל.

**נוסחה:**
```
effective_mastery = stored_mastery × max(0.3, e^(-λ × days))

Where:
- λ = 0.02 (decay rate)
- strength = 1 + (mastery - 0.5) × 1.5
- λ מותאם לפי strength (mastery גבוה = שכחה איטית)
```

**דוגמה:**
```
mastery שמור: 0.8
ימים מאז תרגול: 30

effective = 0.8 × e^(-0.02 × 30 / strength)
         ≈ 0.8 × 0.55
         ≈ 0.44

→ התלמיד יקבל variant קל יותר
```

**שימוש:**
```typescript
import { getEffectiveMastery } from './adaptiveEnhancementsService';

const effective = getEffectiveMastery(storedMastery, daysSincePractice);
// אם flag כבוי → מחזיר storedMastery ללא שינוי
```

### 8.4 Learning Trend (מגמת למידה)

**מטרה:** זיהוי אם תלמיד משתפר או יורד.

**טיפוסי מגמה:**
| Trend | תיאור | slope |
|-------|-------|-------|
| `improving_fast` | שיפור מהיר | > 0.02 |
| `improving` | שיפור הדרגתי | > 0.005 |
| `stable` | יציב | -0.005 to 0.005 |
| `declining` | ירידה | < -0.005 |
| `declining_fast` | ירידה מהירה | < -0.02 |
| `insufficient_data` | אין מספיק נתונים | - |

**השפעה על בחירת variant:**
```
תלמיד משתפר מהר (improving_fast):
→ לא מציע scaffolding גם אם mastery נמוך
→ "תן לו להתקדם לבד"

תלמיד בירידה (declining):
→ מציע scaffolding מוקדם יותר
→ "צריך עזרה לפני שיאבד מוטיבציה"
```

**שמירה:**
```
users/{userId}/profile/proficiency_vector
├── topics: { "fractions": 0.75 }
├── masteryHistory: { "fractions": [...last 30 entries] }
├── lastPracticeDate: { "fractions": Timestamp }
├── trends: { "fractions": "improving" }
└── learningVelocity: { "fractions": 0.01 }
```

### 8.5 A/B Testing

**מטרה:** בדיקת פרמטרים שונים של policy.

**Collections:**
```
experiments/{experimentId}
├── name, description, status
├── parameter: "scaffolding_threshold"
├── controlValue: 0.4
├── treatmentValue: 0.5
├── trafficAllocation: 0.5
├── primaryMetric: "learning_gain"
└── startDate, endDate

users/{userId}/profile/experiments
└── assignments: { "exp_123": "treatment" }

experiment_events/{eventId}
├── experimentId, userId, variant
├── eventType, timestamp
└── metrics: { mastery, accuracy }
```

**שימוש:**
```typescript
const threshold = await getExperimentValue(
    userId,
    'scaffolding_threshold_experiment',
    0.4 // default
);
```

### 8.6 Enhanced selectVariant

**פונקציה חדשה:** `selectVariantWithEnhancements`

```typescript
// שימוש פשוט (תואם לאחור)
const result = await selectVariantWithEnhancements(block, mastery, accuracy);

// שימוש מורחב
const result = await selectVariantWithEnhancements(
    block,
    mastery,
    accuracy,
    userId,    // לשליפת trend, forgetting
    topicId    // לשליפת נתוני נושא
);

// תוצאה
result.variant;  // 'הבנה' | 'יישום' | 'העמקה'
result.factors;  // מה השפיע על ההחלטה
result.effectiveValues.mastery;  // mastery אחרי forgetting
```

### 8.7 איך להפעיל

**שלב 1: לאסוף נתונים (שבוע-שבועיים)**
```typescript
// כבר קורה אוטומטית
// submitAdaptiveAnswer שומר ל-irt_submission_logs
```

**שלב 2: להפעיל IRT**
```typescript
// src/config/adaptiveFeatureFlags.ts
useIrtDifficulty: true,
```

**שלב 3: להפעיל Trend**
```typescript
useTrendAnalysis: true,
```

**שלב 4: להפעיל Forgetting**
```typescript
useForgettingCurve: true,
```

**שלב 5: להריץ A/B**
```typescript
enableABTesting: true,
// + ליצור experiment ב-Firestore
```

---

## 9. קבצים מרכזיים (מעודכן)

### שירותי Adaptive מורחבים:
| קובץ | תפקיד |
|------|-------|
| `src/config/adaptiveFeatureFlags.ts` | Feature flags לכל ההרחבות |
| `src/shared/types/adaptiveTypes.ts` | Types ל-IRT, Trend, Forgetting, A/B |
| `src/services/adaptiveEnhancementsService.ts` | לוגיקת Forgetting, Trend, A/B |
| `src/services/adaptivePolicyService.ts` | Policy + selectVariantWithEnhancements |
| `functions/src/services/irtCalibrationService.ts` | כיול IRT |

### Cloud Functions חדשים:
| Function | Schedule | תפקיד |
|----------|----------|-------|
| `runIRTCalibrationScheduled` | יומי 04:00 | כיול קושי שאלות |

### Collections חדשים:
| Collection | תפקיד |
|------------|-------|
| `irt_submission_logs` | נתוני תשובות לכיול IRT |
| `question_calibration` | תוצאות כיול IRT |
| `experiments` | הגדרות A/B testing |
| `experiment_events` | אירועי A/B testing |

### סימולציה:
| קובץ | תפקיד |
|------|-------|
| `scripts/simulate-adaptive-students.mjs` | בדיקת מערכת אדפטיבית מורחבת |

---

## 10. מסמכי ארכיון

המסמכים הבאים הועברו לארכיון ואינם מעודכנים:

| מסמך מקורי | מיקום בארכיון |
|------------|---------------|
| `ADAPTIVE_LEARNING_SYSTEM.md` | `docs/archive/ADAPTIVE_LEARNING_SYSTEM_2026-01-24.md` |
| `specs/ADAPTIVE_SYSTEM_SPEC.md` | `docs/archive/ADAPTIVE_SYSTEM_SPEC_2026-01-25.md` |
| `ADAPTIVE_LEARNING_AUDIT_REPORT.md` | `docs/archive/ADAPTIVE_LEARNING_AUDIT_REPORT_2026-01-25.md` |

---

## 9. היסטוריית עדכונים

| תאריך | שינוי |
|-------|-------|
| 2026-01-25 | זיהוי באג: וריאנטים לא נוצרים בפעילויות חדשות |
| 2026-01-25 | תכנון ארכיטקטורה חדשה: Progressive + Bloom-aware |
| 2026-01-25 | יצירת מסמך מקור אמת זה |
| 2026-01-25 | **מימוש Phase 1-3:** Cloud Function, Service, Hook, Overlay, Player integration |
| 2026-01-25 | **מימוש Phase 4:** אינדיקטורים ויזואליים לתלמיד ולמורה |
| 2026-01-26 | **הרחבות אדפטיביות:** Feature flags, IRT calibration service |
| 2026-01-26 | **Forgetting Curve:** התכלות שליטה לפי זמן ללא תרגול |
| 2026-01-26 | **Learning Trend:** זיהוי מגמות למידה (משתפר/יורד) |
| 2026-01-26 | **A/B Testing:** תשתית לניסויים מבוקרים |
| 2026-01-26 | **תיעוד ובדיקות:** עדכון מסמך זה + סקריפט סימולציה |

---

## 10. קישורים מהירים

### שירותים קיימים
- **Cache Service:** [variantCacheService.ts](../src/services/variantCacheService.ts)
- **Adaptive Content:** [adaptiveContentService.ts](../src/services/adaptiveContentService.ts)
- **Profile Service:** [profileService.ts](../src/services/profileService.ts)
- **Player:** [SequentialCoursePlayer.tsx](../src/components/SequentialCoursePlayer.tsx)
- **BKT Function:** [functions/src/index.ts](../functions/src/index.ts) (lines 1100-1188)

### שירותים משופרים (2026-01-26)
- **Feature Flags:** [adaptiveFeatureFlags.ts](../src/config/adaptiveFeatureFlags.ts)
- **Adaptive Types:** [adaptiveTypes.ts](../src/shared/types/adaptiveTypes.ts)
- **Enhanced Service:** [adaptiveEnhancementsService.ts](../src/services/adaptiveEnhancementsService.ts)
- **Policy Service:** [adaptivePolicyService.ts](../src/services/adaptivePolicyService.ts)
- **IRT Calibration:** [irtCalibrationService.ts](../functions/src/services/irtCalibrationService.ts)
- **Simulation Script:** [simulate-adaptive-students.mjs](../scripts/simulate-adaptive-students.mjs)

---

*מסמך זה הוא מקור האמת היחיד למערכת האדפטיבית.*
*כל שינוי במערכת צריך להתעדכן כאן.*
