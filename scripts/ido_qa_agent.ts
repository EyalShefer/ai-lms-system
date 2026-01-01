import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize OpenAI
const apiKey = process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.error("❌ Error: Missing API Key. Set VITE_OPENAI_API_KEY or OPENAI_API_KEY in .env");
    process.exit(1);
}

const openai = new OpenAI({ apiKey });

// --- 1. Load System Manifesto ---
const manifestPath = path.join(__dirname, 'data', 'system_manifesto.md');
let systemManifesto = "";

try {
    systemManifesto = fs.readFileSync(manifestPath, 'utf-8');
    console.log("✅ Loaded System Manifesto");
} catch (e) {
    console.warn("⚠️ Could not load System Manifesto from file. Using default/empty.");
    systemManifesto = "System Rules: All buttons must be blue. Hints cost 2 points.";
}


// --- 2. Load Test Cases ---
const testCasesPath = path.join(__dirname, 'data', '100_test_cases.json');
let testCases: any[] = [];
try {
    const rawData = fs.readFileSync(testCasesPath, 'utf-8');
    testCases = JSON.parse(rawData);
    console.log(`✅ Loaded ${testCases.length} Test Cases`);
} catch (e) {
    console.warn("⚠️ Could not load Test Cases. Using default single mock.");
    // Fallback Mock...
    testCases = [{
        id: "fallback_mock",
        mockActivityData: { /* ... same as before or minimal ... */ }
    }];
}

// --- 3. Construct the "Ido" System Prompt per Case ---
async function runIdoSimulation(testCase: any) {
    console.log(`\n🧪 Testing Case: ${testCase.id} (${testCase.description}) ...`);

    const prompt = `
You are "Ido", a sharp 14-year-old QA tester.
You possess Deep System Knowledge based on the "System Manifesto".

Input Sources:
1. The System Manifesto (The Rules):
${systemManifesto}

2. The Activity Data (The Test Subject):
${JSON.stringify(testCase.mockActivityData, null, 2)}

---
Your Mission:
Perform the Simulation Protocol.
Phase 1: Readiness Check (Static Analysis)
Phase 2: Dynamic Simulation (Analyze 'simulationEvents')
Phase 3: Output Report (JSON Format ONLY for aggregation)

Output ONLY valid JSON in this format:
{
  "case_id": "${testCase.id}",
  "status": "PASS" | "FAIL",
  "issues_found": ["List of bugs..."],
  "ido_feedback": "Short summary"
}
    `;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const result = completion.choices[0].message.content || "{}";
        return JSON.parse(result);

    } catch (error) {
        console.error(`❌ Case ${testCase.id} Failed:`, error);
        return { case_id: testCase.id, status: "ERROR", error: String(error) };
    }
}

// --- Main Runner ---
async function runAllTests() {
    console.log("🚀 Starting Bulk QA Simulation...");
    const results = [];

    for (const testCase of testCases) {
        const result = await runIdoSimulation(testCase);
        results.push(result);
        console.log(`   👉 Status: ${result.status} | Issues: ${result.issues_found?.length || 0}`);
    }

    console.log("\n📊 --- Final Aggregated Report --- 📊");
    console.table(results.map(r => ({ id: r.case_id, status: r.status, issues: r.issues_found?.length })));

    // Save Aggregated Report
    const reportPath = path.join(__dirname, 'data', 'bulk_report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`✅ Bulk Report saved to: ${reportPath}`);
}

// Run
runAllTests();

