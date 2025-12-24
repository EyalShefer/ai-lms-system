import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type SecurityEventType = 'PII_ATTEMPT' | 'GEO_BLOCK' | 'SYSTEM_ERROR' | 'LOGIN_ATTEMPT';

export const logSecurityEvent = async (type: SecurityEventType, details: any) => {
    try {
        await addDoc(collection(db, 'security_logs'), {
            type,
            details,
            timestamp: serverTimestamp(),
            // In a real app, we would add userId here if available
            userAgent: navigator.userAgent
        });
        console.warn(`Security Event Logged: ${type}`, details);
    } catch (error) {
        console.error("Failed to log security event:", error);
    }
};
