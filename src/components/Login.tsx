import React from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const Login: React.FC = () => {
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed:", error);
            alert("ההתחברות נכשלה. בדוק את הקונסול.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100" dir="rtl">
            <div className="bg-white p-10 rounded-2xl shadow-xl text-center max-w-md w-full border border-gray-200">
                <h1 className="text-4xl mb-2">👋</h1>
                <h2 className="text-2xl font-bold text-gray-800 mb-6">ברוכים הבאים ל-AI-LMS</h2>
                <p className="text-gray-500 mb-8">מערכת ליצירת מערכי שיעור חכמים</p>

                <button
                    onClick={handleGoogleLogin}
                    className="w-full py-3 px-4 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 transition-all flex items-center justify-center gap-3 font-bold text-gray-700"
                >
                    {/* אייקון גוגל רשמי */}
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
                    כניסה עם Google
                </button>
            </div>
        </div>
    );
};

export default Login;