import React, { useState } from 'react';
import { BookOpen, FileText, HelpCircle, Type, Plus } from 'lucide-react';
import type { Course, Module, LearningUnit } from '../types';
import IngestionWizard from './IngestionWizard';

interface CourseBuilderProps {
    course: Course;
}

type ViewState = 'empty' | 'ingestion' | 'editor';

const CourseBuilder: React.FC<CourseBuilderProps> = ({ course }) => {
    const [activeView, setActiveView] = useState<ViewState>('empty');

    const handleItemClick = (type: string, id: string) => {
        console.log(`Clicked ${type}: ${id}`);
        setActiveView('editor');
    };

    const handleNewUnitClick = () => {
        setActiveView('ingestion');
    };

    return (
        <div className="flex h-screen bg-white text-gray-900 font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-gray-50 border-l border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg font-semibold text-gray-800 truncate" title={course.title}>
                            {course.title}
                        </h2>
                        <button
                            onClick={handleNewUnitClick}
                            className="p-1.5 bg-blue-100 text-blue-600 rounded-md hover:bg-blue-200 transition-colors"
                            title="יחידה חדשה"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-xs text-gray-500">{course.targetAudience}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    <div className="space-y-1">
                        {course.syllabus.map((module: Module) => (
                            <div key={module.id} className="mb-4">
                                <div
                                    className="flex items-center px-2 py-1.5 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 cursor-pointer"
                                    onClick={() => handleItemClick('module', module.id)}
                                >
                                    <BookOpen className="w-4 h-4 ml-2 text-blue-600" />
                                    <span className="truncate">{module.title}</span>
                                </div>

                                <div className="mr-4 mt-1 space-y-1 border-r-2 border-gray-200 pr-2">
                                    {module.learningUnits.map((unit: LearningUnit) => (
                                        <div
                                            key={unit.id}
                                            className="flex items-center px-2 py-1.5 text-sm text-gray-600 rounded-md hover:bg-gray-100 cursor-pointer group"
                                            onClick={() => handleItemClick('unit', unit.id)}
                                        >
                                            {unit.type === 'acquisition' && <FileText className="w-3.5 h-3.5 ml-2 text-green-500" />}
                                            {unit.type === 'practice' && <Type className="w-3.5 h-3.5 ml-2 text-orange-500" />}
                                            {unit.type === 'test' && <HelpCircle className="w-3.5 h-3.5 ml-2 text-red-500" />}
                                            <span className="truncate group-hover:text-gray-900">{unit.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 text-xs text-gray-400 text-center">
                    LMS Course Builder v0.1
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">
                <header className="h-14 border-b border-gray-200 flex items-center px-6 bg-white shadow-sm z-10">
                    <h1 className="text-xl font-bold text-gray-800">Course Builder</h1>
                </header>

                <div className="flex-1 p-8 overflow-y-auto bg-gray-50/50">
                    {activeView === 'empty' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-gray-500 min-h-[400px]">
                                <div className="p-4 rounded-full bg-gray-100 mb-4">
                                    <BookOpen className="w-8 h-8 text-gray-400" />
                                </div>
                                <p className="text-lg font-medium">בחר פריט מהסילבוס</p>
                                <p className="text-sm mt-2">או התחל ליצור תוכן חדש</p>
                            </div>
                        </div>
                    )}

                    {activeView === 'ingestion' && (
                        <IngestionWizard />
                    )}

                    {activeView === 'editor' && (
                        <div className="max-w-4xl mx-auto">
                            <div className="bg-white rounded-xl shadow-sm p-12 flex flex-col items-center justify-center text-gray-500 min-h-[400px]">
                                <p className="text-lg font-medium">עורך תוכן (בקרוב)</p>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CourseBuilder;
