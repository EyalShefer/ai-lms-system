import React, { useEffect, useState } from 'react';
import { logSecurityEvent } from '../services/loggerService';
import { IconLoader } from '../icons'; // We added this earlier

interface GeoGuardProps {
    children: React.ReactNode;
}

const GeoGuard: React.FC<GeoGuardProps> = ({ children }) => {
    const [allowed, setAllowed] = useState<boolean | null>(null);

    useEffect(() => {
        const checkLocation = async () => {
            try {
                // Using ipapi.co (Free tier has limits, for production consider a paid service or backend middleware)
                const response = await fetch('https://ipapi.co/json/');
                const data = await response.json();

                if (data.country === 'IL') {
                    setAllowed(true);
                } else {
                    setAllowed(false);
                    logSecurityEvent('GEO_BLOCK', {
                        ip: data.ip,
                        country: data.country,
                        city: data.city
                    });
                }
            } catch (error) {
                console.error("Geo check failed, defaulting to allow (fail-open) or block (fail-closed)?");
                // For development/demo, we might fail-open or just log and allow. 
                // Let's allow but log error for now, to avoid locking out the user if API fails.
                // OR trigger a manual check. 
                // Let's set allowed(true) for safety in this demo, but log error.
                console.warn("Geo API Error", error);

                // For Strict Security: setAllowed(false)
                // For Usability/Demo: setAllowed(true)
                setAllowed(true);
            }
        };

        checkLocation();
    }, []);

    if (allowed === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 flex-col gap-4">
                <IconLoader className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500">מבצע בדיקת אבטחה...</p>
            </div>
        );
    }

    if (allowed === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md text-center border-t-4 border-red-500">
                    <div className="text-4xl mb-4">⛔</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">הגישה נחסמה</h1>
                    <p className="text-gray-600 mb-6">
                        מערכת זו זמינה לשימוש מישראל בלבד.
                        <br />
                        זוהה ניסיון התחברות מכתובת IP זרה.
                    </p>
                    <div className="text-xs text-gray-400">
                        Event ID: GEO_BLOCK_{new Date().getTime()}
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default GeoGuard;
