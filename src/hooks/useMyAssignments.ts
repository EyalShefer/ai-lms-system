import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import type { Assignment } from '../courseTypes';

export type AssignmentStatus = 'new' | 'in_progress' | 'completed';
export type AssignmentType = 'standard' | 'remediation' | 'challenge';

// Extend the base Assignment interface with the fields we need for the dashboard
export interface StudentAssignment extends Assignment {
    status: AssignmentStatus;
    groupType?: AssignmentType; // internal pedagogical type
    assignedDate?: any; // Timestamp or date string
    progress?: number; // 0-100
    dueDate?: string | number | any;
}

export interface GroupedAssignments {
    new: StudentAssignment[];
    inProgress: StudentAssignment[];
    completed: StudentAssignment[];
}

export const useMyAssignments = (studentId: string | undefined) => {
    const [assignments, setAssignments] = useState<GroupedAssignments>({
        new: [],
        inProgress: [],
        completed: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!studentId) {
            setLoading(false);
            return;
        }

        // Discussion: We assume there is a 'student_assignments' collection that links 
        // assignments to students.

        // Query: Get all assignments for this student
        const q = query(
            collection(db, 'student_assignments'),
            where('studentId', '==', studentId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const all: StudentAssignment[] = [];

            snapshot.forEach((doc) => {
                const data = doc.data();
                all.push({ id: doc.id, ...data } as StudentAssignment);
            });

            // Client-side sorting and grouping to avoid complex indexes for now
            // 1. Sort by assigned date
            all.sort((a, b) => {
                const dateA = a.assignedDate?.seconds || 0;
                const dateB = b.assignedDate?.seconds || 0;
                return dateB - dateA; // Descending (newest first)
            });

            // 2. Group
            const grouped: GroupedAssignments = {
                new: [],
                inProgress: [],
                completed: []
            };

            all.forEach(assign => {
                // Default status to 'new' if missing
                const status = assign.status || 'new';
                if (status === 'in_progress') {
                    grouped.inProgress.push(assign);
                } else if (grouped[status]) {
                    grouped[status].push(assign);
                } else {
                    // Fallback for unknown status
                    grouped.new.push(assign);
                }
            });

            setAssignments(grouped);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching assignments:", err);
            setError(err.message);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [studentId]);

    return { assignments, loading, error };
};
