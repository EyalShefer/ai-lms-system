
import 'dotenv/config'; // Try to load .env if possible, or we rely on process.env
// We might need to manually load .env if dotenv is not there.
// But the user has `vite`, so `.env` should be in root.
import fs from 'fs';
import path from 'path';

// Manual .env parser because we can't be sure about dotenv
const loadEnv = () => {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envFile = fs.readFileSync(envPath, 'utf8');
        envFile.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value && !process.env[key.trim()]) {
                process.env[key.trim()] = value.trim();
            }
        });
    } catch (e) {
        console.log("Could not load .env file manually");
    }
};

loadEnv();

const API_KEY = process.env.VITE_ELEVENLABS_API_KEY;

if (!API_KEY) {
    console.error("No API Key found in VITE_ELEVENLABS_API_KEY");
    process.exit(1);
}

async function fetchVoices() {
    console.log("Fetching voices...");
    try {
        const response = await fetch('https://api.elevenlabs.io/v1/voices', {
            headers: {
                'xi-api-key': API_KEY
            }
        });

        if (!response.ok) {
            console.error("Failed to fetch voices:", response.status, response.statusText);
            const err = await response.text();
            console.error(err);
            return;
        }

        const data = await response.json();
        const voices = data.voices;

        console.log(`Found ${voices.length} voices.`);

        // Filter for potential Hebrew voices or just list names
        // I'll list all "premade" voices and any that look Hebrew
        const interestingVoices = voices.map((v: any) => ({
            name: v.name,
            id: v.voice_id,
            category: v.category,
            labels: v.labels
        }));

        console.log("--- Voices List ---");
        interestingVoices.forEach((v: any) => {
            console.log(`Name: ${v.name}, ID: ${v.id}, Category: ${v.category}`);
            if (v.labels) console.log(`  Labels: ${JSON.stringify(v.labels)}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

fetchVoices();
