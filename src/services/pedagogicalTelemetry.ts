import { db } from '../firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, where } from 'firebase/firestore';
import type { AuditResult } from '../utils/pedagogicalValidator';

const COLLECTION_NAME = 'pedagogical_audits';

export interface AuditSessionLog {
    unitId: string;
    unitTitle: string;
    mode: 'learning' | 'exam';
    avgScore: number;
    timestamp: any;
    failedRules: {
        ruleId: string;
        ruleName: string;
        blockId: string;
        blockType: string;
        message: string;
    }[];
}

export const PedagogicalTelemetry = {
    /**
     * Upload an audit session to Firestore
     */
    logAuditSession: async (
        unitId: string,
        unitTitle: string,
        mode: 'learning' | 'exam',
        results: AuditResult[]
    ) => {
        try {
            const avgScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);

            // Extract only the failures/warnings
            const failedRules = results.flatMap(r =>
                r.rules
                    .filter(rule => rule.status !== 'PASS')
                    .map(rule => ({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        blockId: r.blockId,
                        blockType: 'unknown', // Ideally passed from caller, but validator result doesn't have it yet easily
                        message: rule.message
                    }))
            );

            const logData: Omit<AuditSessionLog, 'timestamp'> & { timestamp: any } = {
                unitId,
                unitTitle,
                mode,
                avgScore,
                timestamp: serverTimestamp(),
                failedRules
            };

            await addDoc(collection(db, COLLECTION_NAME), logData);
            console.log("📈 Pedagogical Audit Logged:", logData);
            return true;
        } catch (error) {
            console.error("❌ Failed to log pedagogical audit:", error);
            return false;
        }
    },

    /**
     * Get recent audits for the Insights Dashboard
     */
    getRecentAudits: async (limitCount = 20): Promise<AuditSessionLog[]> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), orderBy('timestamp', 'desc'), limit(limitCount));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as unknown as AuditSessionLog));
        } catch (error) {
            console.error("❌ Failed to fetch audits:", error);
            return [];
        }
    },

    /**
     * Analyze common failures from recent data
     */
    getCommonFailures: async () => {
        const logs = await PedagogicalTelemetry.getRecentAudits(50);
        const failureCounts: Record<string, number> = {};

        logs.forEach(log => {
            log.failedRules.forEach(f => {
                failureCounts[f.ruleName] = (failureCounts[f.ruleName] || 0) + 1;
            });
        });

        return Object.entries(failureCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([name, count]) => ({ name, count }));
    }
};
