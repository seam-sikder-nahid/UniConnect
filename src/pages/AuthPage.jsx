// src/pages/AuthPage.jsx
import { useState } from 'react';
import LoginForm from '../components/auth/LoginForm';
import SignupForm from '../components/auth/SignupForm';

export default function AuthPage() {
  const [tab, setTab] = useState('login');

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-600 via-primary-700 to-surface-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-400 rounded-full opacity-20 blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-accent-500 rounded-full opacity-10 blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white rounded-full opacity-5 blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-primary-600 font-display font-bold text-lg">U</span>
            </div>
            <h1 className="text-white font-display text-2xl font-bold tracking-tight">UniConnect</h1>
          </div>
          <p className="text-primary-200 text-sm">Uttara University's Digital Hub</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Tab switcher */}
          <div className="flex border-b border-surface-200">
            {[['login', 'Sign In'], ['signup', 'Create Account']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
                  tab === key
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50/50'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {tab === 'login' ? <LoginForm /> : <SignupForm onSuccess={() => setTab('login')} />}
          </div>
        </div>

        <p className="text-center text-primary-200 text-xs mt-4">
          Protected by university-grade security. Only @uttarauniversity.edu.bd and @uttara.ac.bd emails allowed.
        </p>
      </div>
    </div>
  );
}
