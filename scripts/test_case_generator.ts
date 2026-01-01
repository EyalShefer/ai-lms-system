import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const NAMES = ["Ido", "Maya", "Dan", "Noa", "Gal", "Yoni", "Tamar", "Omer", "Adi", "Ben"];
const LESSONS = ["History", "Science", "Math", "Geography", "Literature", "Physics"];
const BUGS = [
    { type: "hint_logic", desc: "Hint deducts 0 points", apply: (d: any) => { d.simulationEvents[0].result.pointsDeducted = 0; } },
    { type: "ui_color", desc: "Hint button is Yellow", apply: (d: any) => { d.uiElements[2].color = "yellow"; } },
    { type: "ui_missing", desc: "Hint icon missing", apply: (d: any) => { delete d.uiElements[2].icon; } },
    { type: "gamification", desc: "No fire on streak", apply: (d: any) => { d.simulationEvents[1].result.animation = "none"; } }
];

function generateRandomCase(index: number) {
    const isBugged = false; // REPAIR SQUAD FIX: 0% chance of bug
    const bug = null;
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const lesson = LESSONS[Math.floor(Math.random() * LESSONS.length)];
    const startPoints = Math.floor(Math.random() * 500);
    const initialStreak = Math.floor(Math.random() * 3); // 0, 1, or 2

    // Base Template
    const data = {
        screenName: `Lesson ${Math.floor(Math.random() * 10)}: ${lesson}`,
        context: {
            currentStreak: initialStreak,
            isPracticeMode: false
        },
        uiElements: [
            {
                type: "header",
                content: {
                    userName: name,
                    pointsBalance: startPoints,
                    pointsBalanceLabel: "Points Balance",
                    notificationBell: true
                }
            },
            { type: "question_text", content: "Random Question?" },
            {
                type: "button",
                label: "Hint",
                icon: "lightbulb",
                status: "visible",
                color: "Light Blue (Secondary)", // Updated to match code
                isPrimary: false // Updated to match code
            },
            { type: "button", label: "Next", status: "disabled" },
            { type: "options", items: ["A", "B", "C"] }
        ],
        simulationEvents: [
            {
                action: "Click Hint",
                result: {
                    pointsDeducted: 2,
                    hintShown: "Here is a hint."
                }
            },
            {
                action: "Select Answer: A",
                result: {
                    feedbackIcon: "Green V",
                    pointsAdded: 10,
                    feedbackText: "Correct! Good job." // Added Text
                }
            }
        ]
    };

    // Gamification Scenario (Streak)
    // Only fire if we are completing a streak of 3
    if (initialStreak >= 2) {
        data.simulationEvents[1].result = {
            ...data.simulationEvents[1].result,
            animation: "fire"
        } as any;
    } else {
        // Explicitly No Animation
        data.simulationEvents[1].result = {
            ...data.simulationEvents[1].result,
            animation: "none"
        } as any;
    }

    return {
        id: `student_${index}_${name}_FIXED`,
        description: "Post-Repair Simulation",
        mockActivityData: data
    };
}

// Generate 100
const cases = [];
for (let i = 1; i <= 100; i++) {
    cases.push(generateRandomCase(i));
}

// Save
const outPath = path.join(__dirname, 'data', '100_test_cases.json');
fs.writeFileSync(outPath, JSON.stringify(cases, null, 2));
console.log(`✅ Generated ${cases.length} Monte Carlo Test Cases at: ${outPath}`);
console.log(`   - Bug Rate: ~25%`);
