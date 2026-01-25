# מערכת למידה אדפטיבית - מקור אמת
## Adaptive Learning System - Current State

**עדכון אחרון:** 25 בינואר 2026
**סטטוס:** מסמך מקור אמת (Source of Truth)

---

## 1. תקציר מצב

### מה עובד:
| רכיב | סטטוס | קובץ ראשי |
|------|--------|-----------|
| BKT Cloud Function | ✅ פעיל | `functions/src/index.ts:1100-1188` |
| ProfileService | ✅ פעיל | `src/services/profileService.ts` |
| Variant Cache | ✅ פעיל | `src/services/variantCacheService.ts` |
| Topic Taxonomy | ✅ פעיל | `src/data/topicTaxonomy.ts` |
| Gamification | ✅ פעיל | `src/services/gamificationService.ts` |
| **Progressive Variant Gen** | ✅ חדש | `functions/src/services/variantGenerationService.ts` |
| **Variant Readiness Hook** | ✅ חדש | `src/hooks/useVariantReadiness.ts` |

### מה תוקן (25/01/2026):
| בעיה | פתרון | סטטוס |
|------|-------|-------|
| וריאנטים לא נוצרים | Cloud Function trigger על יצירת task | ✅ מיושם |

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

## 8. מסמכי ארכיון

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

---

## 10. קישורים מהירים

- **Cache Service:** [variantCacheService.ts](../src/services/variantCacheService.ts)
- **Adaptive Content:** [adaptiveContentService.ts](../src/services/adaptiveContentService.ts)
- **Profile Service:** [profileService.ts](../src/services/profileService.ts)
- **Player:** [SequentialCoursePlayer.tsx](../src/components/SequentialCoursePlayer.tsx)
- **BKT Function:** [functions/src/index.ts](../functions/src/index.ts) (lines 1100-1188)

---

*מסמך זה הוא מקור האמת היחיד למערכת האדפטיבית.*
*כל שינוי במערכת צריך להתעדכן כאן.*
