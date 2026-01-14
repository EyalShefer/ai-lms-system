# AI Models Policy - מדיניות מודלים

## CRITICAL - DO NOT CHANGE WITHOUT EXPLICIT APPROVAL

This document defines the ONLY approved AI models for this system.
**Any change to these models requires explicit approval from the project owner.**

---

## Approved Models

| Purpose | Model ID | Status |
|---------|----------|--------|
| **Text/LLM Generation** | `gemini-3-pro-preview` | APPROVED |
| **Image Generation** | `gemini-3-pro-image-preview` | APPROVED |

---

## Prohibited Models (DO NOT USE)

The following models are **explicitly prohibited** and must NOT be used:

- `gemini-2.5-pro`
- `gemini-2.5-flash`
- `gemini-2.0-flash-001`
- `gemini-1.5-pro`
- `gpt-4o`
- `gpt-4o-mini`
- Any other model not listed in the "Approved Models" section

---

## Implementation Locations

### Backend (Cloud Functions)
- `functions/src/index.ts` - Main MODEL_NAME constant
- `functions/src/services/geminiService.ts` - GEMINI_CONFIG
- `functions/src/services/gemini3TextService.ts` - GEMINI_TEXT_CONFIG
- `functions/src/services/gemini3ImageService.ts` - Image model config
- `functions/src/services/knowledgeBase/*.ts` - All extraction services

### Frontend
- `src/services/ai/geminiApi.ts` - MODEL_NAME and INFOGRAPHIC_MODEL
- `src/services/ai/imagenService.ts` - GEMINI_IMAGE_CONFIG

---

## Verification Command

To verify no prohibited models are in use, run:

```bash
grep -rn "gemini-2\." --include="*.ts" --include="*.tsx" functions/ src/ | grep -v node_modules
grep -rn "gemini-1\." --include="*.ts" --include="*.tsx" functions/ src/ | grep -v node_modules
grep -rn "gpt-4" --include="*.ts" --include="*.tsx" functions/ src/ | grep -v node_modules
```

Expected result: No matches (except in pricing/licensing config files)

---

## Change History

| Date | Change | Approved By |
|------|--------|-------------|
| 2026-01-14 | Initial policy - Gemini 3 Pro only | Eyal Shefer |

---

**Last Updated:** 2026-01-14
**Policy Version:** 1.0
