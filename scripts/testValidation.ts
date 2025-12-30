// scripts/testValidation.ts
import { validateContent, attemptAutoFix, safeGenerationWorkflow } from '../src/gemini';
import { PEDAGOGICAL_SYSTEM_PROMPT } from '../src/prompts/pedagogicalPrompts';

// Mock content for testing
const BAD_CONTENT_ELEMENTARY = {
    title: "Quantum Physics for Grade 3",
    content: "The superposition of quantum states leads to probabilistic determinism. Use passive voice: The cat is observed by the scientist."
};

const GOOD_CONTENT_ELEMENTARY = {
    title: "Dogs are Fun",
    content: "Danny plays with the dog. The dog runs fast. Danny is happy."
};

async function runTests() {
    console.log("🚀 Starting Validation Tests...");

    console.log("\n--- TEST 1: Validate Bad Content (Expect REJECT) ---");
    const res1 = await validateContent(BAD_CONTENT_ELEMENTARY, "כיתה ג'");
    console.log("Status:", res1.status);
    console.log("Issues:", JSON.stringify(res1.issues, null, 2));

    if (res1.status === 'REJECT') {
        console.log("\n--- TEST 2: Attempt Auto-Fix ---");
        const fixed = await attemptAutoFix(BAD_CONTENT_ELEMENTARY, res1);
        console.log("Fixed Content:", JSON.stringify(fixed, null, 2));

        console.log("\n--- TEST 3: Validate Fixed Content ---");
        const resFixed = await validateContent(fixed, "כיתה ג'");
        console.log("Status of Fixed:", resFixed.status);
    }

    console.log("\n--- TEST 4: Safe Workflow Wrapper ---");
    try {
        const final = await safeGenerationWorkflow(async () => BAD_CONTENT_ELEMENTARY, "כיתה ג'");
        console.log("Workflow Success! Final Content:", JSON.stringify(final, null, 2));
    } catch (e) {
        console.error("Workflow Failed:", e);
    }
}

// Note: This script needs to be run in an environment where 'openai' client is initialized correctly
// or mocked. Since we rely on Vite env vars, running this directly with ts-node might fail without
// setup. For now, this serves as a code artifact for review.
