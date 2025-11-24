import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env file manually
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "../.env");
let API_KEY;

try {
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    if (match) {
      API_KEY = match[1].trim();
    }
  }
} catch (error) {
  console.error("Error reading .env file:", error);
}

if (!API_KEY) {
  console.error("Error: VITE_GEMINI_API_KEY not found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
    try {
        console.log("Fetching available models...");
        const modelsToTry = ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"];

        for (const modelName of modelsToTry) {
            console.log(`Testing model: ${modelName}`);
            try {
                const m = genAI.getGenerativeModel({ model: modelName });
                await m.generateContent("Hello");
                console.log(`✅ SUCCESS: ${modelName} is working!`);
            } catch (e) {
                console.log(`❌ FAILED: ${modelName} - ${e.message.split('\n')[0]}`);
            }
        }

    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
