/**
 * Wizdi Router Component
 * Handles routing for Wizdi embed pages
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import WizdiEmbed from './WizdiEmbed';

/**
 * Wizdi Routes
 *
 * /wizdi/teacher - Teacher dashboard embed
 * /wizdi/student - Student dashboard embed
 * /wizdi/task/:taskId - Specific task view
 * /wizdi/course/:courseId - Course viewer
 */
export const WizdiRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Teacher view */}
      <Route path="teacher" element={<WizdiEmbed view="teacher" />} />

      {/* Student view */}
      <Route path="student" element={<WizdiEmbed view="student" />} />

      {/* Task view - shows specific task */}
      <Route path="task/:taskId" element={<WizdiTaskView />} />

      {/* Course view */}
      <Route path="course/:courseId" element={<WizdiCourseView />} />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to="student" replace />} />
    </Routes>
  );
};

/**
 * Task View for Wizdi
 * Shows a specific task in embed mode
 */
const WizdiTaskView: React.FC = () => {
  // Get taskId from URL params
  const taskId = window.location.pathname.split('/').pop();

  return (
    <div className="wizdi-task-view" dir="rtl">
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            משימה: {taskId}
          </h2>
          <p className="text-slate-600">
            תצוגת המשימה תיטען כאן
          </p>
          {/*
            In full implementation:
            <TaskPlayer taskId={taskId} wizdiMode={true} />
          */}
        </div>
      </div>
    </div>
  );
};

/**
 * Course View for Wizdi
 * Shows course content in embed mode
 */
const WizdiCourseView: React.FC = () => {
  const pathParts = window.location.pathname.split('/');
  const courseId = pathParts[pathParts.indexOf('course') + 1];

  return (
    <div className="wizdi-course-view" dir="rtl">
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-slate-800 mb-4">
            קורס: {courseId}
          </h2>
          <p className="text-slate-600">
            תוכן הקורס ייטען כאן
          </p>
          {/*
            In full implementation:
            <CoursePlayer courseId={courseId} wizdiMode={true} />
          */}
        </div>
      </div>
    </div>
  );
};

export default WizdiRoutes;
