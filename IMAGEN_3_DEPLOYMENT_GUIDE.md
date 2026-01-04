# 🚀 מדריך Deploy - Imagen 3 Integration

## סקירה מהירה

מדריך זה מסביר כיצד לפרוס (deploy) את האינטגרציה עם Imagen 3 כדי להפחית עלויות ב-50%.

## ✅ Pre-requisites (דרישות מוקדמות)

- [ ] Google Cloud Project פעיל
- [ ] Firebase CLI מותקן (`npm install -g firebase-tools`)
- [ ] הרשאות Admin ב-Firebase Console
- [ ] Node.js 22+ מותקן

---

## 📋 שלב 1: Google Cloud Configuration

### 1.1 הפעלת Vertex AI API

```bash
# התחבר ל-Google Cloud
gcloud auth login

# בחר פרויקט
gcloud config set project YOUR_PROJECT_ID

# הפעל Vertex AI API
gcloud services enable aiplatform.googleapis.com
```

או דרך [Google Cloud Console](https://console.cloud.google.com/apis/library/aiplatform.googleapis.com):

1. עבור ל-APIs & Services > Library
2. חפש "Vertex AI API"
3. לחץ Enable

### 1.2 הגדרת הרשאות

Vertex AI API נגיש אוטומטית דרך Firebase Functions (מכיוון ששניהם באותו פרויקט).

אם אתה רוצה הרשאות נפרדות:

```bash
# צור Service Account
gcloud iam service-accounts create imagen-service \
    --description="Service account for Imagen 3 generation" \
    --display-name="Imagen Service"

# הוסף הרשאות Vertex AI
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="serviceAccount:imagen-service@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
```

---

## 📦 שלב 2: התקנת Dependencies

```bash
# נווט לתיקיית functions
cd functions

# התקן @google-cloud/vertexai
npm install @google-cloud/vertexai

# בדוק שהכל תקין
npm run build
```

---

## 🔧 שלב 3: Environment Variables

### 3.1 הוסף למשתני סביבה (אופציונלי)

```bash
firebase functions:config:set \
  imagen.enabled=true \
  imagen.model=imagen-3.0-generate-001 \
  imagen.location=us-central1
```

### 3.2 הוסף ל-.env (פיתוח מקומי)

צור/ערוך `src/.env.local`:

```env
VITE_ENABLE_IMAGEN=false  # שנה ל-true אחרי Deploy
VITE_FIREBASE_PROJECT_ID=your-project-id
```

---

## 🚀 שלב 4: Deploy Cloud Functions

### 4.1 Deploy רק Imagen Functions

```bash
# מתיקיית הבסיס של הפרויקט
firebase deploy --only functions:generateImagenImage,functions:imagenHealthCheck,functions:imagenStats
```

### 4.2 אימות Deploy

לאחר Deploy, בדוק שה-functions פעילים:

```bash
# Health check
curl https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/imagenHealthCheck

# צפוי:
# {
#   "status": "healthy",
#   "service": "Imagen 3 Proxy",
#   "model": "imagen-3.0-generate-001",
#   "timestamp": "2026-01-04T..."
# }
```

---

## ⚙️ שלב 5: הפעלת Imagen בפרונט

### 5.1 עדכן Environment Variables

ב-`src/.env.local`:

```env
VITE_ENABLE_IMAGEN=true
VITE_FIREBASE_PROJECT_ID=your-actual-project-id
```

### 5.2 Rebuild Frontend

```bash
# מתיקיית הבסיס
npm run build

# או במצב פיתוח
npm run dev
```

---

## 🧪 שלב 6: בדיקה

### 6.1 בדיקה ידנית

1. פתח את האפליקציה: `http://localhost:5173`
2. התחבר כמורה
3. צור יחידת לימוד חדשה
4. הוסף בלוק טקסט עם תוכן מתאים (למשל: "תהליך גידול צמח: 1. זריעה, 2. השקיה, 3. גידול, 4. קציר")
5. לחץ על כפתור האינפוגרפיקה (📊)
6. בחר סוג (למשל: תרשים זרימה)
7. פתח Developer Console (F12)
8. חפש לוג: `"🎨 Attempting Imagen 3 generation..."`

אם רואה את זה - Imagen פעיל!

### 6.2 בדיקה עם cURL

```bash
# החלף YOUR_PROJECT_ID
curl -X POST \
  https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/generateImagenImage \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a simple flowchart showing: Start -> Step 1 -> Step 2 -> End",
    "userId": "test-user"
  }'
```

צפוי:
```json
{
  "success": true,
  "image": {
    "base64": "iVBORw0KGgoAAAANSUhEUg...",
    "mimeType": "image/png"
  },
  "metadata": {
    "model": "imagen-3.0-generate-001",
    "generationTime": 8342,
    "cost": 0.020
  }
}
```

---

## 📊 שלב 7: ניטור ועלויות

### 7.1 צפייה בלוגים

```bash
# צפה בלוגים בזמן אמת
firebase functions:log --only generateImagenImage

# או דרך Google Cloud Console
https://console.cloud.google.com/logs
```

### 7.2 מעקב אחרי עלויות

1. עבור ל-[Google Cloud Billing](https://console.cloud.google.com/billing)
2. לחץ על Reports
3. סנן לפי "Vertex AI"
4. ראה עלויות לפי יום/שבוע/חודש

### 7.3 הגדרת Budget Alert (מומלץ!)

```bash
# הגדר תקציב חודשי
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT_ID \
  --display-name="Imagen 3 Monthly Budget" \
  --budget-amount=50USD \
  --threshold-rule=percent=80 \
  --threshold-rule=percent=100
```

זה ישלח לך התראה במייל כש-80% ו-100% מהתקציב נוצלו.

---

## 🔒 שלב 8: אבטחה (חשוב!)

### 8.1 Rate Limiting

Rate limiting כבר מוגדר ב-Cloud Function:

- מקסימום 60 requests לדקה לכל משתמש
- מקסימום 1000 requests לשעה
- מקסימום $50 ליום

### 8.2 Authentication (לעתיד)

הוסף בדיקת Authentication ל-Cloud Function:

```typescript
// בקובץ functions/src/imagenProxy.ts
import { getAuth } from 'firebase-admin/auth';

// בתוך generateImagenImage function:
const authHeader = req.headers.authorization;
if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
}

const token = authHeader.split('Bearer ')[1];
try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;
    // השתמש ב-userId לrate limiting...
} catch (error) {
    res.status(401).json({ error: 'Invalid token' });
    return;
}
```

---

## 🐛 Troubleshooting

### בעיה: "Imagen 3 is not configured"

**פתרון:**
1. ודא ש-`VITE_ENABLE_IMAGEN=true` ב-.env.local
2. עשה rebuild: `npm run build`
3. הפעל מחדש את dev server: `npm run dev`

### בעיה: "Rate limit exceeded"

**פתרון:**
- זה נורמלי אם משתמש יוצר יותר מ-60 תמונות לדקה
- חכה דקה אחת ונסה שוב
- או הגדל את הלימיט ב-`functions/src/imagenProxy.ts`

### בעיה: "Vertex AI API not enabled"

**פתרון:**
```bash
gcloud services enable aiplatform.googleapis.com
```

### בעיה: Cloud Function timeout

**פתרון:**
הגדל timeout ב-`functions/src/imagenProxy.ts`:

```typescript
export const generateImagenImage = functions
    .runWith({
        timeoutSeconds: 120, // 2 דקות במקום 1
        memory: '1GB' // יותר זיכרון
    })
```

### בעיה: "403 Forbidden"

**פתרון:**
1. ודא שה-Project ID נכון
2. בדוק הרשאות ב-IAM:
   ```bash
   gcloud projects get-iam-policy YOUR_PROJECT_ID
   ```
3. ודא ש-Service Account יש הרשאות `roles/aiplatform.user`

---

## 📈 Monitoring Dashboard

צור Dashboard מותאם ב-Google Cloud:

```bash
# התקן gcloud alpha components
gcloud components install alpha

# צור custom dashboard
gcloud alpha monitoring dashboards create --config-from-file=monitoring-config.json
```

`monitoring-config.json`:
```json
{
  "displayName": "Imagen 3 Usage Dashboard",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Imagen API Calls",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloud_function\" AND resource.labels.function_name=\"generateImagenImage\""
                }
              }
            }]
          }
        }
      }
    ]
  }
}
```

---

## ✅ Deployment Checklist

לפני שמעלים לפרודקשן:

- [ ] Vertex AI API מופעל
- [ ] Cloud Functions deployed בהצלחה
- [ ] Health check עובד
- [ ] Frontend מתחבר ל-Cloud Function
- [ ] בדיקה ידנית עברה בהצלחה
- [ ] Rate limiting מוגדר
- [ ] Budget alerts מוגדרים
- [ ] Monitoring מוגדר
- [ ] Logs נבדקו
- [ ] Authentication מוגדר (אופציונלי אבל מומלץ!)

---

## 💰 Cost Estimation

| שימוש חודשי | DALL-E 3 | Imagen 3 | חיסכון |
|------------|----------|----------|--------|
| 100 תמונות | $4.00 | $2.00 | $2.00 |
| 500 תמונות | $20.00 | $10.00 | $10.00 |
| 1000 תמונות | $40.00 | $20.00 | $20.00 |
| 5000 תמונות | $200.00 | $100.00 | $100.00 |

**בנוסף עלויות Firebase Functions:**
- 2M invocations חינם/חודש
- אחר כך: $0.40 למיליון invocations
- Compute time: $0.0000025 per 100ms

**סה"כ עלויות נוספות צפויות:** $1-5/חודש (זניחות!)

---

## 📞 Support

אם יש בעיות:

1. בדוק את Logs: `firebase functions:log`
2. בדוק Cloud Console Logs
3. בדוק את [Firebase Status](https://status.firebase.google.com/)
4. פתח Issue ב-GitHub

---

## 🎉 סיום

אחרי השלמת כל השלבים, המערכת שלך:
- ✅ משתמשת ב-Imagen 3 (50% זול יותר!)
- ✅ Fallback אוטומטי ל-DALL-E בעת כשל
- ✅ Cache חכם מונע יצירת דאפליקציות
- ✅ Analytics מעקב אחרי שימוש ועלויות
- ✅ מאובטחת עם Rate Limiting

**החיסכון הצפוי שלך:** $20-100/חודש תלוי בשימוש!

---

**עודכן:** 2026-01-04
**גרסה:** 1.0.0
