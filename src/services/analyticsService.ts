
export interface StudentAnalytics {
    id: string;
    name: string;
    avatar: string; // url or initial
    mastery: Record<string, number>; // Topic -> 0.0-1.0
    lastActive: string;
    riskLevel: 'low' | 'medium' | 'high';
    journey: JourneyNode[];
}

export interface JourneyNode {
    id: string;
    type: 'question' | 'content' | 'remediation' | 'challenge';
    status: 'success' | 'failure' | 'skipped' | 'viewed';
    timestamp: number;
    metadata?: any;
    connection?: 'direct' | 'branched';
}

// Mock Topics
const TOPICS = ['גרפים', 'הצבּה', 'משתנים', 'משוואות'];

// Mock Students
const STUDENTS = [
    { id: 's1', name: 'נועה כהן', risk: 'low' },
    { id: 's2', name: 'דניאל לוי', risk: 'high' },
    { id: 's3', name: 'מיה פרץ', risk: 'medium' },
    { id: 's4', name: 'יוני אברהם', risk: 'low' },
    { id: 's5', name: 'שרה קליין', risk: 'high' },
    { id: 's6', name: 'דוד גולן', risk: 'medium' },
    { id: 's7', name: 'רוני טל', risk: 'low' },
];

// TODO: Replace with real Firestore call
// Example:
// const q = query(collection(db, 'course_analytics'), where('courseId', '==', courseId));
// const snapshot = await getDocs(q);
// return snapshot.docs.map(doc => doc.data() as StudentAnalytics);
export const getCourseAnalytics = async (courseId: string) => {
    // Simulate API delay
    await new Promise(r => setTimeout(r, 500));

    return STUDENTS.map(s => {
        const mastery: Record<string, number> = {};
        TOPICS.forEach(t => {
            // Random mastery heavily influenced by "risk"
            const base = s.risk === 'low' ? 0.8 : s.risk === 'medium' ? 0.5 : 0.2;
            mastery[t] = Math.min(1, Math.max(0, base + (Math.random() * 0.4 - 0.2)));
        });

        return {
            id: s.id,
            name: s.name,
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`,
            mastery,
            lastActive: new Date().toISOString(),
            riskLevel: s.risk,
            journey: generateMockJourney(s.risk)
        } as StudentAnalytics;
    });
};

const generateMockJourney = (risk: string): JourneyNode[] => {
    const nodes: JourneyNode[] = [];
    const now = Date.now();
    let time = now - 1000 * 60 * 60; // 1 hour ago

    // Linear path usually, with branches for high risk
    for (let i = 1; i <= 5; i++) {
        // Main Node
        const success = risk === 'low' ? Math.random() > 0.1 : risk === 'medium' ? Math.random() > 0.4 : Math.random() > 0.7;

        nodes.push({
            id: `step-${i}`,
            type: 'question',
            status: success ? 'success' : 'failure',
            timestamp: time,
            connection: 'direct'
        });
        time += 1000 * 60 * 5;

        // Remediation Branch
        if (!success) {
            nodes.push({
                id: `remedial-${i}`,
                type: 'remediation', // The "Bridge"
                status: 'viewed',
                timestamp: time,
                connection: 'branched'
            });
            time += 1000 * 60 * 3;

            // Retry (usually success after help)
            nodes.push({
                id: `retry-${i}`,
                type: 'question',
                status: 'success',
                timestamp: time,
                connection: 'branched'
            });
            time += 1000 * 60 * 2;
        }
    }
    return nodes;
};
