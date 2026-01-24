import { useState, useEffect } from 'react';
import { getSmartCourseAnalytics, type StudentAnalytics } from '../../services/analyticsService';
import { IconAlertTriangle, IconCheck, IconX, IconActivity } from '@tabler/icons-react';
import { IconChevronLeft, IconBrain } from '../../icons'; // Reusing existing
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

// --- Sub-Components ---

// ... imports

const JourneyTrace = ({ student }: { student: StudentAnalytics }) => {
    // Calculate journey stats for clarity
    const successCount = student.journey.filter(n => n.status === 'success').length;
    const failureCount = student.journey.filter(n => n.status === 'failure').length;
    const remediationCount = student.journey.filter(n => n.type === 'remediation').length;
    const totalSteps = student.journey.length;

    return (
        <div className="bg-slate-50 rounded-3xl p-6 shadow-inner border border-slate-200 w-full overflow-hidden" dir="rtl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h3 className="text-slate-800 font-bold text-xl flex items-center gap-2">
                    <IconActivity className="text-blue-600" />
                    מסלול למידה: {student.name}
                </h3>
                {/* Journey stats summary - clarifies these are learning path steps, not individual questions */}
                <div className="flex items-center gap-3 text-sm">
                    <span className="bg-slate-200 text-slate-600 px-2.5 py-1 rounded-full font-medium">
                        {totalSteps} צעדים
                    </span>
                    <span className="bg-lime-100 text-lime-700 px-2.5 py-1 rounded-full font-medium">
                        {successCount} הצלחות
                    </span>
                    {failureCount > 0 && (
                        <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full font-medium">
                            {failureCount} כשלונות
                        </span>
                    )}
                    {remediationCount > 0 && (
                        <span className="bg-yellow-100 text-yellow-700 px-2.5 py-1 rounded-full font-medium">
                            {remediationCount} חיזוקים
                        </span>
                    )}
                </div>
            </div>
            {/* Note: Journey nodes represent learning path milestones (units/activities completed), not individual questions */}
            <p className="text-xs text-slate-500 mb-4">
                * כל צעד מייצג יחידת לימוד או פעילות במסלול (לא שאלות בודדות)
            </p>

            {/* Scroll Container with LTR direction for time progression (Past -> Future) */}
            <div className="overflow-x-auto pb-4" dir="ltr">
                <div className="flex items-center gap-0 w-max px-4 min-w-full">
                    {student.journey.map((node, idx) => {
                        const isRemediation = node.type === 'remediation';

                        return (
                            <div key={idx} className="flex items-center">
                                {/* Node */}
                                <div className={`relative flex flex-col items-center group`}>
                                    {/* Pulse for remediation */}
                                    {isRemediation && <div className="absolute inset-0 bg-yellow-400 blur-md opacity-50 animate-pulse rounded-full" />}

                                    <div className={`w-12 h-12 rounded-full border-4 z-10 flex items-center justify-center shadow-lg relative
                                        ${node.status === 'success' ? 'bg-lime-400 border-lime-600' :
                                            node.status === 'failure' ? 'bg-red-500 border-red-700' :
                                                node.type === 'remediation' ? 'bg-yellow-300 border-yellow-500' : 'bg-slate-200 border-slate-300'}
                                        transition-transform hover:scale-125 cursor-pointer
                                        shrink-0
                                    `}>
                                        {isRemediation ? '🛠️' : node.status === 'success' ? <IconCheck size={20} className="text-slate-900" stroke={3} /> : <IconX size={20} className="text-white" stroke={3} />}
                                    </div>

                                    {/* Node Label */}
                                    <div className="absolute top-full mt-3 text-center w-32 -left-10 z-20 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 block bg-white/95 px-2 py-1 rounded-lg shadow-xl border border-slate-100">
                                            {node.type}
                                        </span>
                                        {node.connection === 'branched' && (
                                            <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 px-2 rounded-full mt-1 inline-block">לולאת חיזוק</span>
                                        )}
                                    </div>
                                </div>

                                {/* Connector Line */}
                                {idx < student.journey.length - 1 && (
                                    <div className={`h-1.5 w-16 mx-1 rounded-full shrink-0
                                        ${node.connection === 'branched' ? 'bg-yellow-200 border-t-2 border-dashed border-yellow-500/50 h-0 w-12 mx-2' : 'bg-slate-200'}
                                    `} />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

const WizdiInsightsWidget = ({ onGenerate }: { onGenerate: () => void }) => {
    return (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl p-6 text-white shadow-lg mb-8 relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
                <IconBrain className="absolute -right-10 -top-10 w-[200px] h-[200px]" />
            </div>

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm">
                        <IconBrain className="w-8 h-8 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                            Wizdi Insights
                            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
                        </h3>
                        <p className="text-indigo-100 text-lg leading-relaxed max-w-2xl">
                            "30% מהכיתה מתקשים בהבנת הנקרא. מומלץ ליצור יחידת תגבור ממוקדת."
                        </p>
                    </div>
                </div>

                <div className="shrink-0">
                    <button
                        onClick={onGenerate}
                        className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg flex items-center gap-2 group"
                    >
                        <IconActivity className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        צור יחידת תגבור
                    </button>
                </div>
            </div>
        </div>
    );
};

export const AdaptiveDashboard = ({ courseId: initialCourseId }: { courseId?: string } = {}) => {
    const { currentUser } = useAuth();
    const [students, setStudents] = useState<StudentAnalytics[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
    const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || '');
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [loadingStudents, setLoadingStudents] = useState(false);

    // Load teacher's courses with enrollments
    useEffect(() => {
        const loadCoursesWithStudents = async () => {
            if (!currentUser?.uid) {
                setLoadingCourses(false);
                return;
            }

            try {
                console.log('📚 Loading courses for teacher:', currentUser.uid);

                // Get all courses where this teacher is the owner
                const coursesQuery = query(
                    collection(db, 'courses'),
                    where('teacherId', '==', currentUser.uid),
                    orderBy('createdAt', 'desc') // הקורס האחרון שנוצר יופיע ראשון
                );
                const coursesSnapshot = await getDocs(coursesQuery);

                console.log('📊 Found', coursesSnapshot.size, 'courses');

                // For each course, check if it has any enrollments
                const coursesWithEnrollments: Array<{ id: string; title: string; enrollmentCount: number }> = [];

                for (const courseDoc of coursesSnapshot.docs) {
                    const courseData = courseDoc.data();

                    // Check for enrollments in this course
                    const enrollmentsQuery = query(
                        collection(db, 'enrollments'),
                        where('courseId', '==', courseDoc.id)
                    );
                    const enrollmentsSnapshot = await getDocs(enrollmentsQuery);

                    if (enrollmentsSnapshot.size > 0) {
                        coursesWithEnrollments.push({
                            id: courseDoc.id,
                            title: courseData.title || 'ללא כותרת',
                            enrollmentCount: enrollmentsSnapshot.size
                        });
                        console.log(`   ✓ Course "${courseData.title}" has ${enrollmentsSnapshot.size} students`);
                    }
                }

                setCourses(coursesWithEnrollments);

                // Auto-select course
                if (coursesWithEnrollments.length > 0) {
                    // Prefer initialCourseId if provided and exists
                    const courseToSelect = initialCourseId && coursesWithEnrollments.some(c => c.id === initialCourseId)
                        ? initialCourseId
                        : coursesWithEnrollments[0].id;

                    setSelectedCourseId(courseToSelect);
                    console.log('🎯 Auto-selected course:', courseToSelect);
                }

            } catch (error) {
                console.error('❌ Error loading courses:', error);
            } finally {
                setLoadingCourses(false);
            }
        };

        loadCoursesWithStudents();
    }, [currentUser?.uid, initialCourseId]);

    // Load students when course changes
    useEffect(() => {
        if (!selectedCourseId) {
            setStudents([]);
            return;
        }

        setLoadingStudents(true);
        console.log('📊 Loading analytics for course:', selectedCourseId);

        getSmartCourseAnalytics(selectedCourseId).then(data => {
            console.log('✅ Loaded students:', data);
            setStudents(data);
            setLoadingStudents(false);
        }).catch(error => {
            console.error('❌ Error loading students:', error);
            setLoadingStudents(false);
        });
    }, [selectedCourseId]);

    const selectedStudent = students.find(s => s.id === selectedStudentId) || students[0];

    // Helper for action button config
    const getStudentAction = (risk: string) => {
        if (risk === 'high') {
            return {
                label: 'צור יחידת חיזוק אישית',
                icon: <IconAlertTriangle className="w-5 h-5" />,
                color: 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200',
                type: 'Remediation'
            };
        } else if (risk === 'low') {
            return {
                label: 'צור יחידת אתגר',
                icon: <IconActivity className="w-5 h-5" />,
                color: 'bg-emerald-100 text-emerald-900 border-emerald-200 hover:bg-emerald-200',
                type: 'Challenge'
            };
        }
        return {
            label: 'צור יחידה מותאמת',
            icon: <IconBrain className="w-5 h-5" />,
            color: 'bg-indigo-100 text-indigo-900 border-indigo-200 hover:bg-indigo-200',
            type: 'Adaptive'
        };
    };

    const handleCreateUnit = (type: string, studentName?: string) => {
        const message = studentName
            ? `Generating ${type} unit for ${studentName}...`
            : `Generating Class ${type} Unit...`;
        console.log(message);
        alert(message);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 p-6 font-sans overflow-x-hidden" dir="rtl">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8 border-b border-slate-200 pb-6 flex flex-col md:flex-row items-end justify-between gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl md:text-4xl font-black text-slate-800 mb-2 flex items-center gap-3">
                        <IconBrain className="w-10 h-10 text-indigo-600" />
                        לוח בקרה אדפטיבי
                    </h1>
                    <p className="text-slate-500 text-lg">
                        מבט על כיתתי בזמן אמת: ביצועים, מסלולי למידה וזיהוי פערים
                    </p>
                </div>

                {/* Course Selector */}
                <div className="min-w-[280px]">
                    <label className="block text-sm font-medium text-slate-600 mb-2">
                        בחר קורס
                    </label>
                    {loadingCourses ? (
                        <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-500">
                            טוען קורסים...
                        </div>
                    ) : courses.length === 0 ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                            אין קורסים עם תלמידים
                        </div>
                    ) : (
                        <select
                            value={selectedCourseId}
                            onChange={(e) => setSelectedCourseId(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
                        >
                            {courses.map((course) => (
                                <option key={course.id} value={course.id}>
                                    {course.title} ({course.enrollmentCount} תלמידים)
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* KPI Cards */}
                <div className="flex gap-4">
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-500">
                            <IconAlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-3xl font-black text-slate-800">{students.filter(s => s.riskLevel === 'high').length}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">תלמידים בסיכון</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Loading State */}
            {loadingStudents && (
                <div className="max-w-7xl mx-auto text-center py-12">
                    <div className="inline-flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                        <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-slate-700 font-medium">טוען נתוני תלמידים...</span>
                    </div>
                </div>
            )}

            {/* No Students State */}
            {!loadingStudents && students.length === 0 && selectedCourseId && (
                <div className="max-w-7xl mx-auto text-center py-12">
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 inline-block">
                        <IconAlertTriangle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                        <p className="text-amber-800 font-bold text-lg mb-2">אין תלמידים בקורס זה</p>
                        <p className="text-amber-600 text-sm">
                            הקורס הנבחר אינו מכיל תלמידים עם נתוני למידה.
                        </p>
                    </div>
                </div>
            )}

            {/* Main Content - Only show when we have students */}
            {!loadingStudents && students.length > 0 && (
                <>
                    {/* Insights Widget */}
                    <div className="max-w-7xl mx-auto">
                        <WizdiInsightsWidget onGenerate={() => handleCreateUnit('Remediation Class')} />
                    </div>

                    <div className="max-w-7xl mx-auto flex flex-col xl:flex-row gap-8 items-start">

                {/* Left: The Heatmap (Matrix) - In RTL this is on the Right physically */}
                <div className="w-full xl:w-5/12 bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm overflow-hidden">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                        <span className="w-1.5 h-8 bg-indigo-600 rounded-full" />
                        מפת שליטה כיתתית
                    </h2>

                    <div className="space-y-4 overflow-x-auto pb-2">
                        {/* Header Row */}
                        <div className="flex items-center gap-4 pl-14 pb-2 border-b border-slate-100 text-xs text-slate-400 font-bold uppercase tracking-widest text-center min-w-[300px]">
                            {Object.keys(students[0]?.mastery || {}).map(topic => (
                                <div key={topic} className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap px-1" title={topic}>
                                    {topic}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {students.map(s => (
                            <div
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`flex items-center gap-4 p-3 rounded-2xl transition-all cursor-pointer border-2 min-w-[300px]
                                    ${selectedStudentId === s.id ? 'bg-indigo-50 border-indigo-500 shadow-md transform scale-[1.02]' : 'border-transparent hover:bg-slate-50'}
                                `}
                            >
                                {/* Avatar */}
                                <div className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden shrink-0 border-2 border-white shadow-sm">
                                    <img src={s.avatar} alt={s.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                                </div>

                                {/* Name + Risk */}
                                <div className="w-24 shrink-0">
                                    <div className="font-bold text-slate-800 text-sm truncate flex items-center gap-1">
                                        {s.name}
                                        {s.isSimulated && (
                                            <span className="text-[8px] px-1 py-0.5 rounded bg-purple-100 text-purple-700 font-bold uppercase" title="תלמיד מדומה">
                                                SIM
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                        <span className={`text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold uppercase
                                            ${s.riskLevel === 'high' ? 'bg-red-50 text-red-600' :
                                                s.riskLevel === 'medium' ? 'bg-orange-50 text-orange-600' : 'bg-lime-50 text-lime-700'}
                                        `}>
                                            {s.riskLevel === 'high' ? 'סיכון' : s.riskLevel === 'medium' ? 'בינוני' : 'מצוין'}
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold
                                            ${s.riskLevel === 'high' ? 'bg-blue-100 text-blue-700' :
                                                s.riskLevel === 'low' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}
                                        `}>
                                            {s.riskLevel === 'high' ? '📚' : s.riskLevel === 'low' ? '🚀' : '📖'}
                                        </span>
                                    </div>
                                </div>

                                {/* Mastery Cells */}
                                <div className="flex-1 flex justify-between gap-2">
                                    {Object.entries(s.mastery).map(([topic, score]) => (
                                        <div key={topic} className="flex-1 flex justify-center">
                                            <div className={`h-3 w-full rounded-full bg-slate-100 overflow-hidden relative group shadow-inner border border-slate-200`}>
                                                <div
                                                    className={`absolute inset-0 rounded-full ${score > 0.8 ? 'bg-emerald-400' : score > 0.5 ? 'bg-amber-400' : 'bg-red-400'}`}
                                                    style={{ width: `${score * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <IconChevronLeft className="text-slate-300 w-5 h-5 shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right: Detail View (Journey) - In RTL this is on the Left physically */}
                {/* Fixed width problem: min-w-0 prevents flex item from overflowing parent */}
                <div className="w-full xl:w-7/12 flex flex-col gap-6 min-w-0">
                    {selectedStudent && (
                        <div className="animate-in slide-in-from-right-8 fade-in duration-500">
                            <div className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-xl relative overflow-hidden">
                                {/* Decor */}
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                                <div className="flex flex-col md:flex-row items-start justify-between mb-8 gap-6">
                                    <div className="flex items-center gap-6">
                                        <img src={selectedStudent.avatar} alt={selectedStudent.name} className="w-20 h-20 md:w-24 md:h-24 rounded-3xl border-4 border-white shadow-lg" loading="lazy" decoding="async" />
                                        <div>
                                            <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-3">
                                                {selectedStudent.name}
                                                {selectedStudent.isSimulated && (
                                                    <span className="text-xs px-3 py-1 rounded-lg bg-purple-100 text-purple-700 font-bold uppercase flex items-center gap-1.5 border border-purple-200" title={`תלמיד מדומה - פרופיל: ${selectedStudent.simulationProfile}`}>
                                                        <span className="text-base">🤖</span>
                                                        סימולציה
                                                    </span>
                                                )}
                                            </h2>
                                            <div className="text-slate-500 flex flex-wrap items-center gap-3 mt-2 font-medium text-sm md:text-base">
                                                <span>פעילות אחרונה: {new Date(selectedStudent.lastActive).toLocaleTimeString()}</span>
                                                <span className="text-slate-300 hidden md:inline">|</span>
                                                <span className="text-indigo-600 font-mono bg-indigo-50 px-2 py-0.5 rounded-lg">ID: {selectedStudent.id}</span>
                                                {selectedStudent.isSimulated && selectedStudent.simulationProfile && (
                                                    <>
                                                        <span className="text-slate-300 hidden md:inline">|</span>
                                                        <span className="text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg text-xs font-bold">
                                                            פרופיל: {selectedStudent.simulationProfile === 'struggling' ? 'מתקשה' :
                                                                     selectedStudent.simulationProfile === 'average' ? 'ממוצע' : 'מצטיין'}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action & Stats Column */}
                                    <div className="flex flex-col gap-3 w-full md:w-auto">
                                        <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100">
                                            <div className="text-3xl md:text-4xl font-black font-mono text-indigo-600">
                                                {Math.round((selectedStudent.courseMastery !== undefined
                                                    ? selectedStudent.courseMastery
                                                    : (Object.values(selectedStudent.mastery).length > 0
                                                        ? Object.values(selectedStudent.mastery).reduce((a, b) => a + b, 0) / Object.values(selectedStudent.mastery).length
                                                        : 0)) * 100)}%
                                            </div>
                                            <div className="text-slate-400 uppercase font-bold text-xs tracking-wider">
                                                {selectedStudent.courseMastery !== undefined ? 'שליטה בקורס' : 'שליטה ממוצעת'}
                                            </div>
                                        </div>

                                        {/* Dynamic Action Button */}
                                        <button
                                            onClick={() => handleCreateUnit(getStudentAction(selectedStudent.riskLevel).type, selectedStudent.name)}
                                            className={`w-full py-3 px-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm
                                                ${getStudentAction(selectedStudent.riskLevel).color}
                                            `}
                                        >
                                            {getStudentAction(selectedStudent.riskLevel).icon}
                                            {getStudentAction(selectedStudent.riskLevel).label}
                                        </button>
                                    </div>
                                </div>

                                {/* Performance Metrics */}
                                {selectedStudent.performance && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-2xl font-black text-emerald-600">
                                                {Math.round(selectedStudent.performance.accuracy * 100)}%
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold uppercase">דיוק</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-2xl font-black text-blue-600">
                                                {selectedStudent.performance.avgResponseTime}s
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold uppercase">זמן תגובה</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-2xl font-black text-purple-600">
                                                {selectedStudent.performance.totalQuestions}
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold uppercase">שאלות</div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                                            <div className="text-2xl font-black text-amber-600">
                                                {Math.round(selectedStudent.performance.hintDependency * 100)}%
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold uppercase">תלות ברמזים</div>
                                        </div>
                                    </div>
                                )}

                                {/* Error Patterns */}
                                {selectedStudent.errorPatterns && Object.keys(selectedStudent.errorPatterns).length > 0 && (
                                    <div className="mb-6 bg-red-50 border border-red-100 p-4 rounded-2xl">
                                        <h4 className="text-red-800 font-bold mb-3 flex items-center gap-2">
                                            <IconAlertTriangle className="w-5 h-5" />
                                            דפוסי שגיאות נפוצים
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(selectedStudent.errorPatterns).map(([pattern, count]) => (
                                                <span key={pattern} className="bg-white px-3 py-1.5 rounded-full text-sm border border-red-200 flex items-center gap-2">
                                                    <span className="font-medium text-red-700">{pattern}</span>
                                                    <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* The Traces */}
                                <JourneyTrace student={selectedStudent} />

                                <div className="mt-8 bg-blue-50 border border-blue-100 p-6 rounded-2xl text-blue-900 flex gap-4">
                                    <div className="bg-white p-3 rounded-full h-fit text-blue-500 shadow-sm shrink-0"><IconBrain className="w-6 h-6" /></div>
                                    <div>
                                        <strong className="block text-lg font-bold mb-1 text-blue-800">תובנות המערכת (AI)</strong>
                                        <p className="leading-relaxed opacity-90 text-sm md:text-base">
                                            {selectedStudent.riskLevel === 'high'
                                                ? `התלמיד מגלה קושי (דיוק ${Math.round((selectedStudent.performance?.accuracy || 0) * 100)}%). ${selectedStudent.performance?.hintDependency && selectedStudent.performance.hintDependency > 0.5 ? 'תלות גבוהה ברמזים.' : ''} מומלץ: תוכן מותאם עם תמיכה. ${Object.keys(selectedStudent.errorPatterns || {}).length > 0 ? `שגיאות נפוצות: ${Object.keys(selectedStudent.errorPatterns || {}).slice(0, 2).join(', ')}.` : ''}`
                                                : selectedStudent.riskLevel === 'low'
                                                    ? `התלמיד מצטיין! דיוק ${Math.round((selectedStudent.performance?.accuracy || 0) * 100)}%, זמן תגובה מהיר (${selectedStudent.performance?.avgResponseTime || 0}s). מומלץ: תוכן העמקה עם אתגרים נוספים.`
                                                    : `התלמיד מתקדם בצורה יציבה (דיוק ${Math.round((selectedStudent.performance?.accuracy || 0) * 100)}%). מקבל תוכן במסלול יישום. ${selectedStudent.performance?.hintDependency && selectedStudent.performance.hintDependency > 0.3 ? 'שימוש מתון ברמזים.' : ''}`
                                            }
                                        </p>
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="text-xs font-bold text-blue-600">מסלול מומלץ:</span>
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                                                selectedStudent.riskLevel === 'high' ? 'bg-blue-200 text-blue-800' :
                                                selectedStudent.riskLevel === 'low' ? 'bg-purple-200 text-purple-800' : 'bg-slate-200 text-slate-700'
                                            }`}>
                                                {selectedStudent.riskLevel === 'high' ? 'הבנה' :
                                                 selectedStudent.riskLevel === 'low' ? 'העמקה' : 'יישום'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
                </>
            )}
        </div>
    );
};
