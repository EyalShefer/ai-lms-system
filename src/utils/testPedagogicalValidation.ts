
import { validateContent, attemptAutoFix, safeGenerationWorkflow } from '../gemini';

// Mock content for testing
const BAD_CONTENT_ELEMENTARY = {
  title: "Quantum Physics for Grade 3",
  content: "The superposition of quantum states leads to probabilistic determinism. Use passive voice: The cat is observed by the scientist."
};

const GOOD_CONTENT_ELEMENTARY = {
  title: "Dogs are Fun",
  content: "Danny plays with the dog. The dog runs fast. Danny is happy."
};

export async function runPedagogicalTests() {
  console.log("%c🚀 Starting Pedagogical Validation Tests...", "color: blue; font-weight: bold; font-size: 14px;");

  // --- TEST 1 ---
  console.group("TEST 1: Validate Bad Content (Expect REJECT)");
  console.log("Input:", BAD_CONTENT_ELEMENTARY);
  const res1 = await validateContent(BAD_CONTENT_ELEMENTARY, "כיתה ג'");
  console.log("Status:", res1.status);
  console.log("Issues:", res1.issues);
  console.groupEnd();

  // --- TEST 2 & 3 ---
  if (res1.status === 'REJECT') {
    console.group("TEST 2: Attempt Auto-Fix");
    const fixed = await attemptAutoFix(BAD_CONTENT_ELEMENTARY, res1);
    console.log("Fixed Content:", fixed);
    console.groupEnd();

    console.group("TEST 3: Validate Fixed Content");
    const resFixed = await validateContent(fixed, "כיתה ג'");
    console.log("Status of Fixed:", resFixed.status);
    console.groupEnd();
  } else {
    console.warn("Test 1 Unexpectedly PASSED - Check your prompt or model rules.");
  }

  // --- TEST 4 ---
  console.group("TEST 4: Safe Workflow Wrapper");
  try {
    const final = await safeGenerationWorkflow(async () => BAD_CONTENT_ELEMENTARY, "כיתה ג'");
    console.log("✅ Workflow Success! Final Content:", final);
  } catch (e) {
    console.error("❌ Workflow Failed:", e);
  }
  console.groupEnd();

  // Use a softer alert or just console logs
  console.log("%c✅ Validation Tests Completed!", "color: green; font-weight: bold; font-size: 14px;");
  alert("Tests Started! Check the F12 Console for details.");
}
