import React, { useState } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';

const Login: React.FC = () => {
    const { mockLogin } = useAuth();
    const [showEmailLogin, setShowEmailLogin] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Login failed:", error);
            alert("ההתחברות נכשלה. בדוק את הקונסול.");
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error: any) {
            console.error("Email login failed:", error);
            if (error.code === 'auth/user-not-found') {
                setError('משתמש לא נמצא');
            } else if (error.code === 'auth/wrong-password') {
                setError('סיסמה שגויה');
            } else if (error.code === 'auth/invalid-email') {
                setError('כתובת אימייל לא תקינה');
            } else {
                setError('ההתחברות נכשלה. נסה שוב.');
            }
        } finally {
            setLoading(false);
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
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" loading="eager" decoding="async" />
                    כניסה עם Google
                </button>

                {/* Email/Password Login Section */}
                <div className="mt-6">
                    <button
                        onClick={() => setShowEmailLogin(!showEmailLogin)}
                        className="text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                        {showEmailLogin ? 'הסתר' : 'כניסה עם אימייל וסיסמה'}
                    </button>

                    {showEmailLogin && (
                        <form onSubmit={handleEmailLogin} className="mt-4 space-y-3">
                            <input
                                type="email"
                                placeholder="אימייל"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                                required
                            />
                            <input
                                type="password"
                                placeholder="סיסמה"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-right"
                                required
                            />
                            {error && (
                                <p className="text-red-500 text-sm">{error}</p>
                            )}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-bold disabled:opacity-50"
                            >
                                {loading ? 'מתחבר...' : 'התחבר'}
                            </button>
                        </form>
                    )}
                </div>

                {import.meta.env.DEV && (
                    <button
                        onClick={mockLogin}
                        className="w-full mt-4 py-3 px-4 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm hover:bg-yellow-100 transition-all flex items-center justify-center gap-3 font-bold text-yellow-800"
                    >
                        ⚡ Dev Login (Bypass)
                    </button>
                )}
            </div>
        </div>
    );
};

export default Login;