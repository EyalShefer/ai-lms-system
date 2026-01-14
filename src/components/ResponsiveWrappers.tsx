/**
 * ResponsiveWrappers.tsx
 *
 * Components that automatically switch between desktop and mobile versions
 * based on screen size. These provide seamless responsive behavior without
 * requiring conditional logic in parent components.
 *
 * Usage:
 * Instead of importing HomePageRedesign directly, import ResponsiveHomePage
 * and it will automatically render the appropriate version.
 */

import React, { lazy, Suspense } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import type { Assignment } from '../shared/types/courseTypes';
import { AIStarsSpinner } from './ui/Loading/AIStarsSpinner';

// Lazy load mobile components to reduce initial bundle size
const SequentialCoursePlayerMobile = lazy(() => import('./mobile/SequentialCoursePlayerMobile'));
const HomePageRedesignMobile = lazy(() => import('./mobile/HomePageRedesignMobile'));
const StudentHomeMobile = lazy(() => import('./mobile/StudentHomeMobile'));
const LandingPageMobile = lazy(() => import('./mobile/LandingPageMobile'));

// Desktop components (imported normally since they're the default)
import SequentialCoursePlayer from './SequentialCoursePlayer';
import HomePageRedesign from './HomePageRedesign';
import StudentHome from './StudentHome';
import LandingPage from './LandingPage';

// Loading fallback for lazy-loaded mobile components
const MobileLoadingFallback = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="text-center">
            <AIStarsSpinner size="lg" color="primary" className="mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">טוען...</p>
        </div>
    </div>
);

/**
 * ResponsiveSequentialCoursePlayer
 *
 * Renders mobile or desktop course player based on screen size.
 */
interface SequentialPlayerProps {
    assignment?: Assignment;
    onExit?: () => void;
    onEdit?: () => void;
    simulateGuest?: boolean;
}

export const ResponsiveSequentialCoursePlayer: React.FC<SequentialPlayerProps> = (props) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Suspense fallback={<MobileLoadingFallback />}>
                <SequentialCoursePlayerMobile
                    assignment={props.assignment}
                    onExit={props.onExit}
                    simulateGuest={props.simulateGuest}
                />
            </Suspense>
        );
    }

    return <SequentialCoursePlayer {...props} />;
};

/**
 * ResponsiveHomePage
 *
 * Renders mobile or desktop teacher home page based on screen size.
 */
interface HomePageProps {
    onCreateNew: (mode: string, product?: 'lesson' | 'podcast' | 'exam' | 'activity') => void;
    onNavigateToDashboard: () => void;
    onEditCourse?: (courseId: string) => void;
    onNavigateToPrompts?: () => void;
    onNavigateToQA?: () => void;
    onNavigateToKnowledgeBase?: () => void;
    onNavigateToAgents?: () => void;
    onNavigateToUsage?: () => void;
}

export const ResponsiveHomePage: React.FC<HomePageProps> = (props) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Suspense fallback={<MobileLoadingFallback />}>
                <HomePageRedesignMobile {...props} />
            </Suspense>
        );
    }

    return <HomePageRedesign {...props} />;
};

/**
 * ResponsiveStudentHome
 *
 * Renders mobile or desktop student dashboard based on screen size.
 */
interface StudentHomeProps {
    onSelectAssignment: (assignmentId: string, unitId?: string) => void;
    highlightCourseId?: string | null;
}

export const ResponsiveStudentHome: React.FC<StudentHomeProps> = (props) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Suspense fallback={<MobileLoadingFallback />}>
                <StudentHomeMobile {...props} />
            </Suspense>
        );
    }

    return <StudentHome {...props} />;
};

/**
 * ResponsiveLandingPage
 *
 * Renders mobile or desktop landing page based on screen size.
 */
interface LandingPageProps {
    onLogin: () => void;
}

export const ResponsiveLandingPage: React.FC<LandingPageProps> = (props) => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return (
            <Suspense fallback={<MobileLoadingFallback />}>
                <LandingPageMobile {...props} />
            </Suspense>
        );
    }

    return <LandingPage {...props} />;
};
