/**
 * useIsMobile Hook
 *
 * Detects if the user is on a mobile device based on:
 * - Screen width (< 768px by default)
 * - Touch capability
 * - User agent (optional fallback)
 *
 * Returns true if the device is considered mobile.
 */

import { useState, useEffect } from 'react';

interface UseIsMobileOptions {
    breakpoint?: number;  // Default: 768 (md breakpoint in Tailwind)
    includeTablet?: boolean;  // Include tablet-sized devices (< 1024px)
}

export function useIsMobile(options: UseIsMobileOptions = {}): boolean {
    const { breakpoint = 768, includeTablet = false } = options;
    const effectiveBreakpoint = includeTablet ? 1024 : breakpoint;

    const [isMobile, setIsMobile] = useState<boolean>(() => {
        // Initial check (SSR-safe)
        if (typeof window === 'undefined') return false;
        return window.innerWidth < effectiveBreakpoint;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const checkMobile = () => {
            const widthBased = window.innerWidth < effectiveBreakpoint;
            setIsMobile(widthBased);
        };

        // Initial check
        checkMobile();

        // Listen for resize
        window.addEventListener('resize', checkMobile);

        // Also listen for orientation changes on mobile devices
        window.addEventListener('orientationchange', checkMobile);

        return () => {
            window.removeEventListener('resize', checkMobile);
            window.removeEventListener('orientationchange', checkMobile);
        };
    }, [effectiveBreakpoint]);

    return isMobile;
}

/**
 * useMediaQuery Hook
 *
 * More flexible hook for any media query
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const mediaQuery = window.matchMedia(query);
        const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);

        // Set initial value
        setMatches(mediaQuery.matches);

        // Modern API
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        } else {
            // Fallback for older browsers
            mediaQuery.addListener(handleChange);
            return () => mediaQuery.removeListener(handleChange);
        }
    }, [query]);

    return matches;
}

/**
 * Utility to check if device has touch capability
 */
export function isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export default useIsMobile;
