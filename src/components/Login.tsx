import React, { useState } from 'react';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';

const Login: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

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
            setError(err.message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100" dir="rtl">
            <div className="bg-white p-8 rounded-xl shadow-lg w-96">
                <h2 className="text-2xl font-bold text-center mb-6 text-indigo-600">
                    {isLogin ? 'כניסה למערכת' : 'הרשמה למערכת'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">אימייל</label>
                        <input
                            type="email"
                            required
                            className="w-full p-2 border rounded mt-1"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">סיסמה</label>
                        <input
                            type="password"
                            required
                            className="w-full p-2 border rounded mt-1"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && <p className="text-red-500 text-xs">{error}</p>}

                    <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 font-bold">
                        {isLogin ? 'התחבר' : 'הירשם'}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm">
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="text-indigo-500 hover:underline"
                    >
                        {isLogin ? 'אין לך חשבון? הירשם' : 'יש לך חשבון? התחבר'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;