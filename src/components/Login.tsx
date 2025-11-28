import React, { useState } from 'react';
import { auth } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // פונקציה לכניסה עם גוגל
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            // אין צורך לעשות כלום אחרי זה, ה-AuthContext יזהה את השינוי לבד
        } catch (err: any) {
            console.error(err);
            setError("הכניסה עם גוגל נכשלה. נסה שוב.");
        }
    };

    // פונקציה לכניסה רגילה (מייל/סיסמה)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
        } catch (err: any) {
            // תרגום פשוט לשגיאות נפוצות
            if (err.code === 'auth/wrong-password') setError('סיסמה שגויה');
            else if (err.code === 'auth/user-not-found') setError('משתמש לא נמצא');
            else if (err.code === 'auth/email-already-in-use') setError('המייל הזה כבר קיים במערכת');
            else setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-100" dir="rtl">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-96 border border-white/50">
                <h2 className="text-3xl font-extrabold text-center mb-8 text-gray-800">
                    ברוכים הבאים <span className="text-indigo-600">AI-LMS</span> 🚀
                </h2>

                {/* כפתור גוגל - האופציה המועדפת */}
                <button
                    onClick={handleGoogleLogin}
                    className="w-full bg-white border border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm mb-6"
                >
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google" />
                    התחבר עם Google
                </button>

                <div className="flex items-center gap-4 mb-6">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <span className="text-sm text-gray-400">או דרך המייל</span>
                    <div className="h-px bg-gray-200 flex-1"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            required
                            placeholder="כתובת אימייל"
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            required
                            placeholder="סיסמה"
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded text-center">{error}</div>}

                    <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5">
                        {isLogin ? 'כניסה' : 'הרשמה'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-gray-500 hover:text-indigo-600 transition-colors"
                    >
                        {isLogin ? 'אין לך חשבון עדיין? צור חשבון' : 'יש לך כבר חשבון? התחבר'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;