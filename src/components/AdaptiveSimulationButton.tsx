/**
 * Adaptive Simulation Button
 *
 * Button for teachers to run adaptive learning simulation
 * Creates 3 simulated students and tests all adaptive features
 *
 * Created: 2026-01-24
 */

import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

// Cache for courses (5 minutes)
let coursesCache: {
    data: Array<{ id: string; title: string }>;
    timestamp: number;
    teacherId: string;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Export a function to clear the cache (useful for debugging and when creating new courses)
export const clearCoursesCache = () => {
    coursesCache = null;
    console.log('🔄 Courses cache cleared');
};

export const AdaptiveSimulationButton: React.FC = () => {
    const { currentUser: user, loading: authLoading } = useAuth();
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedCourseId, setSelectedCourseId] = useState<string>('');
    const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [forceRefresh, setForceRefresh] = useState(0);

    // Load teacher's courses
    useEffect(() => {
        const loadCourses = async () => {
            console.log('🔍 Loading courses for user:', user?.uid);
            console.log('🔐 Auth loading:', authLoading);

            // Wait for auth to finish loading
            if (authLoading) {
                console.log('⏳ Waiting for auth to complete...');
                return;
            }

            if (!user?.uid) {
                console.log('❌ No user.uid found, skipping course load');
                setLoadingCourses(false);
                return;
            }

            // Check cache first (unless force refresh is triggered)
            const now = Date.now();
            if (
                forceRefresh === 0 && // Skip cache on force refresh
                coursesCache &&
                coursesCache.teacherId === user.uid &&
                now - coursesCache.timestamp < CACHE_DURATION
            ) {
                console.log('✅ Using cached courses (age:', Math.floor((now - coursesCache.timestamp) / 1000), 'seconds)');
                setCourses(coursesCache.data);
                if (coursesCache.data.length > 0 && !selectedCourseId) {
                    setSelectedCourseId(coursesCache.data[0].id);
                }
                setLoadingCourses(false);
                return;
            }

            // Clear cache if force refreshing
            if (forceRefresh > 0) {
                console.log('🔄 Force refresh - clearing cache');
                coursesCache = null;
            }

            try {
                console.log('📚 Querying courses with teacherId:', user.uid);
                console.log('📧 User email:', user.email);
                console.log('👤 User displayName:', user.displayName);

                const coursesQuery = query(
                    collection(db, 'courses'),
                    where('teacherId', '==', user.uid),
                    orderBy('createdAt', 'desc') // הקורס האחרון שנוצר יופיע ראשון
                );
                const snapshot = await getDocs(coursesQuery);

                console.log('📊 Query returned', snapshot.size, 'courses');

                // Log each course found
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    console.log(`   📘 Course: "${data.title}" (${doc.id})`);
                    console.log(`      teacherId: ${data.teacherId}`);
                    console.log(`      mode: ${data.mode}`);
                    console.log(`      createdAt: ${data.createdAt?.toDate?.()}`);
                });

                if (snapshot.empty) {
                    console.log('⚠️ No courses found with teacherId =', user.uid);
                    console.log('💡 Trying to fetch all courses to check field names...');

                    // Debug: fetch first few courses to see their structure
                    const allCoursesSnapshot = await getDocs(collection(db, 'courses'));
                    console.log('Total courses in database:', allCoursesSnapshot.size);
                    allCoursesSnapshot.docs.slice(0, 3).forEach(doc => {
                        const data = doc.data();
                        console.log('Sample course:', {
                            id: doc.id,
                            title: data.title,
                            teacherId: data.teacherId,
                            createdBy: data.createdBy,
                            allFields: Object.keys(data)
                        });
                    });
                }

                // Filter courses that are Activities (mode='learning') and have units with activity blocks
                const coursesData: Array<{ id: string; title: string }> = [];

                for (const doc of snapshot.docs) {
                    const courseId = doc.id;
                    const courseData = doc.data();

                    // Skip courses without createdAt (old courses or broken data)
                    if (!courseData.createdAt) {
                        console.log(`⏩ Course "${courseData.title}" skipped - missing createdAt timestamp`);
                        continue;
                    }

                    // Special logging for the specific course we're looking for
                    if (courseData.title && courseData.title.includes('ההשפעות ארוכות הטווח')) {
                        console.log(`🔍 FOUND TARGET COURSE: "${courseData.title}"`);
                        console.log(`   mode: ${courseData.mode}`);
                        console.log(`   createdAt: ${courseData.createdAt?.toDate?.()}`);
                        console.log(`   createdAt timestamp: ${courseData.createdAt?.seconds}`);
                        console.log(`   syllabus exists: ${!!courseData.syllabus}`);
                        console.log(`   syllabus is array: ${Array.isArray(courseData.syllabus)}`);
                        console.log(`   syllabus length: ${courseData.syllabus?.length || 0}`);
                        if (courseData.syllabus && courseData.syllabus.length > 0) {
                            console.log(`   First module:`, {
                                title: courseData.syllabus[0].title,
                                hasLearningUnits: !!courseData.syllabus[0].learningUnits,
                                learningUnitsCount: courseData.syllabus[0].learningUnits?.length || 0
                            });
                            if (courseData.syllabus[0].learningUnits && courseData.syllabus[0].learningUnits.length > 0) {
                                const firstUnit = courseData.syllabus[0].learningUnits[0];
                                console.log(`   First unit:`, {
                                    title: firstUnit.title,
                                    hasActivityBlocks: !!firstUnit.activityBlocks,
                                    activityBlocksCount: firstUnit.activityBlocks?.length || 0,
                                    activityBlocksIsArray: Array.isArray(firstUnit.activityBlocks)
                                });
                            }
                        }
                    }

                    // Only include Activities, not Lessons or Tests
                    if (courseData.mode !== 'learning') {
                        console.log(`⚠️ Course "${courseData.title}" skipped - not an Activity (mode: ${courseData.mode})`);
                        continue;
                    }

                    // Check if course has units with blocks - check BOTH main doc and subcollection
                    let hasBlocks = false;

                    // 1. First check main document syllabus
                    if (courseData.syllabus && Array.isArray(courseData.syllabus)) {
                        for (const module of courseData.syllabus) {
                            if (module.learningUnits && Array.isArray(module.learningUnits)) {
                                for (const unit of module.learningUnits) {
                                    if (unit.activityBlocks && Array.isArray(unit.activityBlocks) && unit.activityBlocks.length > 0) {
                                        hasBlocks = true;
                                        console.log(`   📦 Found ${unit.activityBlocks.length} blocks in main document syllabus`);
                                        break;
                                    }
                                }
                                if (hasBlocks) break;
                            }
                        }
                    }

                    // 2. If no blocks in main doc, check subcollection
                    if (!hasBlocks) {
                        const unitsSnapshot = await getDocs(collection(db, 'courses', courseId, 'units'));
                        for (const unitDoc of unitsSnapshot.docs) {
                            const unitData = unitDoc.data();
                            if (unitData.activityBlocks && Array.isArray(unitData.activityBlocks) && unitData.activityBlocks.length > 0) {
                                hasBlocks = true;
                                console.log(`   📦 Found ${unitData.activityBlocks.length} blocks in subcollection`);
                                break;
                            }
                        }
                    }

                    if (hasBlocks) {
                        coursesData.push({
                            id: courseId,
                            title: courseData.title || 'ללא כותרת'
                        });
                        console.log(`✅ Course "${courseData.title}" is a valid Activity with blocks`);
                    } else {
                        console.log(`⚠️ Course "${courseData.title}" skipped - no activity blocks found in main doc or subcollection`);
                    }
                }

                console.log('✅ Loaded courses with activities:', coursesData);

                // CRITICAL: Re-sort by createdAt after filtering
                // The Firestore orderBy is no longer valid after we filtered out courses
                coursesData.sort((a, b) => {
                    const aDoc = snapshot.docs.find(doc => doc.id === a.id);
                    const bDoc = snapshot.docs.find(doc => doc.id === b.id);
                    const aTimestamp = aDoc?.data().createdAt?.seconds || 0;
                    const bTimestamp = bDoc?.data().createdAt?.seconds || 0;
                    return bTimestamp - aTimestamp; // desc (newest first)
                });

                console.log('✅ Re-sorted courses by createdAt (newest first)');

                // Limit to 100 most recent courses for better UX
                const MAX_COURSES_TO_DISPLAY = 100;
                const totalCourses = coursesData.length;
                const displayedCourses = coursesData.slice(0, MAX_COURSES_TO_DISPLAY);

                if (totalCourses > MAX_COURSES_TO_DISPLAY) {
                    console.log(`⚠️ Showing ${MAX_COURSES_TO_DISPLAY} out of ${totalCourses} courses (most recent only)`);
                }

                // Check if target course made it to the final list
                const targetCourse = coursesData.find(c => c.title.includes('ההשפעות ארוכות הטווח'));
                const targetIndex = coursesData.findIndex(c => c.title.includes('ההשפעות ארוכות הטווח'));

                // Log first 10 courses with their timestamps to debug sorting
                console.log('📊 First 10 courses in final list (after filtering):');
                for (let i = 0; i < Math.min(10, coursesData.length); i++) {
                    const course = coursesData[i];
                    const courseDoc = snapshot.docs.find(doc => doc.id === course.id);
                    const timestamp = courseDoc?.data().createdAt;
                    console.log(`   ${i + 1}. "${course.title}"`);
                    console.log(`      createdAt: ${timestamp?.toDate?.()}`);
                    console.log(`      timestamp: ${timestamp?.seconds || 'N/A'}`);
                }

                if (targetCourse) {
                    console.log('🎯 TARGET COURSE IS IN FINAL LIST:', targetCourse);
                    console.log(`📍 Position in list: ${targetIndex + 1} out of ${coursesData.length}`);

                    // Show target course timestamp
                    const targetDoc = snapshot.docs.find(doc => doc.id === targetCourse.id);
                    const targetTimestamp = targetDoc?.data().createdAt;
                    console.log(`🎯 Target course timestamp: ${targetTimestamp?.toDate?.()}`);
                    console.log(`🎯 Target timestamp seconds: ${targetTimestamp?.seconds}`);
                } else {
                    console.log('❌ TARGET COURSE NOT IN FINAL LIST (even though it passed all checks!)');
                }

                // Update cache
                coursesCache = {
                    data: displayedCourses,
                    timestamp: Date.now(),
                    teacherId: user.uid
                };

                setCourses(displayedCourses);

                // Auto-select first course if available
                if (coursesData.length > 0 && !selectedCourseId) {
                    console.log('Auto-selecting first course:', coursesData[0].id);
                    setSelectedCourseId(coursesData[0].id);
                }
            } catch (err) {
                console.error('❌ Error loading courses:', err);
            } finally {
                console.log('🏁 Course loading complete');
                setLoadingCourses(false);
            }
        };

        loadCourses();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.uid, authLoading, forceRefresh]);

    const runSimulation = async () => {
        if (!selectedCourseId) {
            setError('אנא בחר קורס מהרשימה');
            return;
        }

        if (!user?.uid) {
            setError('משתמש לא מחובר. אנא התחבר מחדש.');
            return;
        }

        setIsRunning(true);
        setError(null);
        setResult(null);

        try {
            const functions = getFunctions();
            const runAdaptiveSimulation = httpsCallable(functions, 'runAdaptiveSimulation');

            console.log('🎯 Starting simulation...', {
                courseId: selectedCourseId,
                teacherId: user.uid
            });

            const response = await runAdaptiveSimulation({
                courseId: selectedCourseId,
                teacherId: user.uid,
                numQuestions: 10
            });

            console.log('✅ Simulation completed:', response.data);
            setResult(response.data);

        } catch (err: any) {
            console.error('❌ Simulation error:', err);
            setError(err.message || 'שגיאה בסימולציה');
        } finally {
            setIsRunning(false);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <svg
                            className="w-6 h-6 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                        </svg>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">
                        בדיקת מערכת אדפטיבית
                    </h3>
                    <p className="text-sm text-slate-600 mb-3">
                        הרץ סימולציה של 3 תלמידים עם רמות שונות (מתקשה, ממוצע, מצטיין)
                        ובדוק שהמערכת מתאימה תוכן בצורה נכונה.
                    </p>

                    {/* Course Selector */}
                    <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-slate-700">
                                בחר קורס להרצת הסימולציה
                            </label>
                            <button
                                onClick={() => {
                                    console.log('🔄 Manual refresh triggered');
                                    setForceRefresh(prev => prev + 1);
                                    setLoadingCourses(true);
                                }}
                                disabled={loadingCourses || authLoading}
                                className="text-xs text-purple-600 hover:text-purple-700 disabled:text-slate-400 flex items-center gap-1"
                                title="רענן רשימת קורסים"
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                רענן
                            </button>
                        </div>
                        {authLoading || loadingCourses ? (
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500">
                                {authLoading ? 'מאמת משתמש...' : 'טוען קורסים...'}
                            </div>
                        ) : courses.length === 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-center gap-2 text-sm">
                                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium text-amber-700">
                                        לא נמצאו קורסים
                                    </span>
                                </div>
                                <p className="text-xs text-amber-600 mt-1 mr-6">
                                    יש ליצור קורס קודם כדי להריץ סימולציה
                                </p>
                            </div>
                        ) : (
                            <>
                                <select
                                    value={selectedCourseId}
                                    onChange={(e) => setSelectedCourseId(e.target.value)}
                                    className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                >
                                    {courses.map((course) => (
                                        <option key={course.id} value={course.id}>
                                            {course.title}
                                        </option>
                                    ))}
                                </select>
                                {courses.length >= 50 && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        מוצגים 50 הקורסים האחרונים. אם הקורס שלך לא מופיע, הוא נוצר לפני זמן רב.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Simulation Details */}
                    <div className="mb-3 text-xs text-slate-500 space-y-1">
                        <p>✓ יוצר 3 תלמידים מדומים: שרה כהן, דוד לוי, מאיה אברהם</p>
                        <p>✓ מריץ כל תלמיד על 10 פעילויות מהקורס</p>
                        <p>✓ בודק: BKT, Scaffolding, Enrichment, Variant Selection</p>
                        <p>✓ התלמידים יופיעו בדשבורד שלך עם כל האירועים האדפטיביים</p>
                    </div>

                    {/* Button */}
                    <button
                        onClick={runSimulation}
                        disabled={isRunning || !selectedCourseId || loadingCourses || authLoading}
                        className={`
                            px-4 py-2 rounded-lg font-medium transition-all
                            ${isRunning || !selectedCourseId || loadingCourses || authLoading
                                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md hover:shadow-lg'
                            }
                        `}
                    >
                        {isRunning ? (
                            <span className="flex items-center gap-2">
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                מריץ סימולציה...
                            </span>
                        ) : authLoading ? (
                            'מאמת...'
                        ) : loadingCourses ? (
                            'טוען...'
                        ) : !selectedCourseId ? (
                            '⚠️ בחר קורס'
                        ) : (
                            '🚀 הרץ סימולציה'
                        )}
                    </button>

                    {/* Results */}
                    {result && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-2 mb-2">
                                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-bold text-green-800">
                                        הסימולציה הושלמה בהצלחה! ✅
                                    </p>
                                    <p className="text-sm text-green-700 mt-1">
                                        {result.message}
                                    </p>
                                    <p className="text-sm text-green-700 mt-1">
                                        קורס: <span className="font-semibold">{courses.find(c => c.id === selectedCourseId)?.title || selectedCourseId}</span>
                                    </p>
                                </div>
                            </div>

                            {/* Student Results */}
                            {result.results && (
                                <div className="mt-3 space-y-2">
                                    {result.results.map((student: any, index: number) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between p-2 bg-white rounded border border-green-100"
                                        >
                                            <div className="flex items-center gap-2">
                                                <span className={`text-2xl ${
                                                    student.type === 'struggling' ? '🔴' :
                                                    student.type === 'average' ? '🟡' : '🟢'
                                                }`}>
                                                    {student.type === 'struggling' ? '🔴' :
                                                     student.type === 'average' ? '🟡' : '🟢'}
                                                </span>
                                                <div>
                                                    <p className="font-medium text-slate-800">
                                                        {student.student}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        {student.type === 'struggling' ? 'מתקשה' :
                                                         student.type === 'average' ? 'ממוצע' : 'מצטיין'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-700">
                                                    {(student.finalMastery * 100).toFixed(0)}% שליטה
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {student.correctAnswers}/{student.totalQuestions} נכונות
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <p className="text-xs text-green-600 mt-3">
                                💡 עכשיו תוכל לראות את התלמידים המדומים בדשבורד ולבדוק את האירועים האדפטיביים שלהם
                            </p>
                        </div>
                    )}

                    {/* Error */}
                    {error && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <div>
                                    <p className="font-bold text-red-800">שגיאה</p>
                                    <p className="text-sm text-red-700">{error}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdaptiveSimulationButton;
