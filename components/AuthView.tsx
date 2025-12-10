import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

export const AuthView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;
        setMessage("Account created! Please check your email inbox to verify your account before logging in.");
        setIsSignUp(false); // Switch to login view so they can login after verifying
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        // Auth state change is handled in App.tsx via subscription
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      let msg = err.message || "Authentication failed.";
      
      // Supabase specific error handling
      if (msg.includes("Invalid login credentials")) {
        msg = "Invalid email or password. If you just created an account, please verify your email address via the link sent to your inbox.";
      } else if (msg.includes("User already registered")) {
        msg = "This email is already registered. Please sign in instead.";
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setMessage("Password reset email sent! Check your inbox.");
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 transition-all hover:shadow-2xl duration-500">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">AceAcademia</h1>
          <p className="text-gray-500">
            {isSignUp ? 'Create a new account' : 'Welcome back, please login'}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg mb-4 text-sm bg-red-50 text-red-700 border border-red-100 animate-fade-in">
            {error}
          </div>
        )}
        
        {message && (
          <div className="p-3 rounded-lg mb-4 text-sm bg-green-50 text-green-700 border border-green-100 animate-fade-in">
            {message}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Password</label>
              {!isSignUp && (
                <button 
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-xs text-blue-600 hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-200 transform hover:-translate-y-0.5 ${loading ? 'opacity-70 cursor-wait' : ''}`}
          >
            {loading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-gray-100">
          <p className="text-sm text-gray-500 mb-2">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </p>
          <button
            onClick={() => { 
              setIsSignUp(!isSignUp); 
              setError(null); 
              setMessage(null); 
            }}
            className="w-full py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            type="button"
          >
            {isSignUp ? 'Switch to Log In' : 'Create an Account'}
          </button>
        </div>
      </div>
    </div>
  );
};