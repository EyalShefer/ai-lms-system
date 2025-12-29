import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useMyAssignments, type StudentAssignment } from '../hooks/useMyAssignments';
import AssignmentCard from './AssignmentCard';

const LoadingSkeleton = () => (
    <div className="animate-pulse flex gap-6 mt-6">
        {[1, 2, 3].map((i) => (
            <div key={i} className="min-w-[280px] h-[200px] bg-gray-200 rounded-2xl"></div>
        ))}
    </div>
);

interface StudentHomeProps {
    onSelectAssignment: (assignmentId: string) => void;
}

const StudentHome: React.FC<StudentHomeProps> = ({ onSelectAssignment }) => {
    const { currentUser } = useAuth();
    const { assignments, loading, error } = useMyAssignments(currentUser?.uid);

    // Combine New + InProgress for the main "Active" view
    // We want InProgress first if it exists? Or maybe New first? 
    // Let's mix them but prioritize InProgress typically in a real app, 
    // but the prompt asked for "New first" in the hook.
    // Let's just concat them:
    const activeAssignments = [...assignments.new, ...assignments.inProgress];

    // Sort slightly: specific logic? For now rely on hook's sort.

    const handleCardClick = (assignment: StudentAssignment) => {
        console.log("Clicked assignment:", assignment.id);
        onSelectAssignment(assignment.id);
    };

    const firstName = currentUser?.displayName?.split(' ')[0] || 'תלמיד';

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
                <LoadingSkeleton />
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500 p-10 text-center text-xl">אופס! לא הצלחנו לטעון את המשימות שלך. ({error})</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

                {/* Header / Greeting */}
                <header className="mb-10">
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
                        היי {firstName}, 👋
                    </h1>
                    <p className="text-xl text-gray-500 font-light">
                        מוכן לכבוש יעדים חדשים היום?
                    </p>
                </header>

                {/* --- UP NEXT SECTION (Horizontal Scroll) --- */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                            🚀 המשימות שלי להיום
                            <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-3 py-1 rounded-full">
                                {activeAssignments.length}
                            </span>
                        </h2>
                    </div>

                    {activeAssignments.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 text-center border border-dashed border-gray-300">
                            <div className="text-6xl mb-4">🎉</div>
                            <h3 className="text-xl font-bold text-gray-700">הכל נקי! סיימת את כל המשימות</h3>
                            <p className="text-gray-500 mt-2">זמן מצוין לנוח או לבקש אתגר נוסף מהמורה.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto pb-8 -mx-4 px-4 scrollbar-hide">
                            <div className="flex gap-6 w-max">
                                {activeAssignments.map((assign) => (
                                    <AssignmentCard
                                        key={assign.id}
                                        assignment={assign}
                                        onClick={handleCardClick}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* --- ACHIEVEMENTS / HISTORY SECTION (Vertical List) --- */}
                {assignments.completed.length > 0 && (
                    <section>
                        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            🏆 היכל התהילה
                            <span className="text-sm font-normal text-gray-400">(המשימות שהושלמו)</span>
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-80 hover:opacity-100 transition-opacity duration-300">
                            {assignments.completed.map((assign) => (
                                <AssignmentCard
                                    key={assign.id}
                                    assignment={assign}
                                    onClick={handleCardClick}
                                />
                            ))}
                        </div>
                    </section>
                )}

            </div>
        </div>
    );
};

export default StudentHome;
