import React from 'react';
import { Upload, FileText, Sparkles } from 'lucide-react';

const IngestionWizard: React.FC = () => {
    return (
        <div className="max-w-3xl mx-auto w-full">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-600" />
                        יצירת יחידת לימוד חדשה
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        העלה תוכן או הדבק טקסט כדי ליצור יחידת לימוד באופן אוטומטי
                    </p>
                </div>

                <div className="p-8 space-y-8">
                    {/* Drag & Drop Zone */}
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-blue-500 hover:bg-blue-50/30 transition-colors cursor-pointer group">
                        <div className="p-4 rounded-full bg-blue-50 text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                            <Upload className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">גרור קובץ לכאן</h3>
                        <p className="text-sm text-gray-500 mt-1">תומך בקבצי PDF, DOCX</p>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">או</span>
                        </div>
                    </div>

                    {/* Text Area */}
                    <div className="space-y-3">
                        <label htmlFor="content-text" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            הדבק טקסט חופשי
                        </label>
                        <textarea
                            id="content-text"
                            rows={6}
                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-3 border resize-none"
                            placeholder="הדבק כאן את תוכן השיעור..."
                        ></textarea>
                    </div>

                    {/* Action Button */}
                    <div className="flex justify-end pt-4">
                        <button className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                            <Sparkles className="w-5 h-5 ml-2" />
                            נתח תוכן באמצעות AI
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IngestionWizard;
