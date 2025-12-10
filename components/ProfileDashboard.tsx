
import React, { useState } from 'react';
import { User, UserProgress, YEARS, DEPARTMENTS } from '../types';
import { supabase } from '../services/supabaseClient';
import { resetUserProgress } from '../services/progressService';
import { syncLeaderboardProfile } from '../services/leaderboardService';
import { Icons } from './Icons';

interface ProfileDashboardProps {
  user: User;
  progress: UserProgress;
  onBack: () => void;
  onUpdateUser: (updatedUser: User) => void;
  onResetProgress: () => void;
}

type Tab = 'overview' | 'settings' | 'security';

export const ProfileDashboard: React.FC<ProfileDashboardProps> = ({ 
  user, 
  progress, 
  onBack, 
  onUpdateUser,
  onResetProgress 
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  
  // Settings Form State
  const [displayName, setDisplayName] = useState(user.username);
  const [department, setDepartment] = useState(progress.department || 'General');
  
  // Password Form State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      });

      if (error) throw error;
      
      // Update local storage/DB for department via progress/leaderboard
      await syncLeaderboardProfile(user.id, displayName, department);
      
      // Also update user_progress local part if needed for persistence
      // We will let App.tsx handle progress state, but we should sync to DB here
      await supabase.from('user_progress').upsert({
          user_id: user.id,
          data: { ...progress, department }
      });

      onUpdateUser({ ...user, username: displayName });
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' });
      return;
    }
    if (newPassword.length < 6) {
        setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
        return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Password changed successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm("ARE YOU SURE? This will permanently delete all your quiz history, unlocked levels, and scores. This action cannot be undone.")) {
        setLoading(true);
        try {
            await resetUserProgress(user.id);
            onResetProgress();
            setMessage({ type: 'success', text: 'All progress has been reset.' });
            setActiveTab('overview');
        } catch(err: any) {
            setMessage({ type: 'error', text: 'Failed to reset progress.' });
        } finally {
            setLoading(false);
        }
    }
  };

  // Stats Calculations
  const completedExamsCount = progress.completedExams.length;
  const currentYear = progress.unlockedYears[progress.unlockedYears.length - 1];
  const totalPracticeParts = Object.values(progress.unlockedPracticeParts).reduce((a: number, b: number) => a + (b - 1), 0); // Roughly completed parts

  const renderSidebar = () => (
    <div className="w-full md:w-64 bg-white rounded-2xl shadow-sm border border-gray-100 p-4 h-fit">
      <div className="flex flex-col items-center py-6 border-b border-gray-100 mb-4">
        <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3">
          <Icons.User className="w-10 h-10" />
        </div>
        <h3 className="font-bold text-gray-800 text-lg text-center truncate w-full px-2">{user.username}</h3>
        <p className="text-gray-500 text-xs truncate w-full px-2 text-center">{department}</p>
      </div>
      
      <nav className="space-y-1">
        <button 
          onClick={() => setActiveTab('overview')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'overview' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Icons.Activity className="w-5 h-5" />
          <span>Overview</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Icons.Settings className="w-5 h-5" />
          <span>Settings</span>
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'security' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          <Icons.Shield className="w-5 h-5" />
          <span>Security</span>
        </button>
      </nav>
      
      <div className="mt-8 pt-4 border-t border-gray-100">
        <button onClick={onBack} className="w-full flex items-center space-x-3 px-4 py-3 text-gray-500 hover:text-gray-800 transition-colors">
            <Icons.LogOut className="w-4 h-4 rotate-180" />
            <span>Back to Dashboard</span>
        </button>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Academic Overview</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl shadow-lg shadow-blue-200">
                <div className="opacity-80 mb-2 font-medium text-sm uppercase tracking-wide">Current Level</div>
                <div className="text-4xl font-bold">{currentYear}</div>
                <div className="text-sm opacity-70 mt-1">Curriculum Year</div>
            </div>
            
             <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-gray-500 mb-2 font-medium text-sm uppercase tracking-wide">Exams Passed</div>
                <div className="text-4xl font-bold text-gray-800">{completedExamsCount}</div>
                <div className="text-sm text-green-500 mt-1 flex items-center gap-1">
                    <Icons.CheckCircle className="w-4 h-4" /> Ready for next challenge
                </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="text-gray-500 mb-2 font-medium text-sm uppercase tracking-wide">Practice Parts</div>
                <div className="text-4xl font-bold text-gray-800">{totalPracticeParts}</div>
                <div className="text-sm text-blue-500 mt-1">Completed sections</div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-800 mb-4">Progress Timeline</h3>
            <div className="space-y-4">
                {YEARS.map(year => {
                    const isUnlocked = progress.unlockedYears.includes(year);
                    const isPassed = progress.completedExams.includes(year);
                    return (
                        <div key={year} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-4 shrink-0 ${isPassed ? 'bg-green-100 text-green-600' : (isUnlocked ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400')}`}>
                                {isPassed ? <Icons.CheckCircle className="w-5 h-5" /> : (isUnlocked ? <Icons.Unlock className="w-4 h-4" /> : <Icons.Lock className="w-4 h-4" />)}
                            </div>
                            <div className="flex-1">
                                <div className="flex justify-between">
                                    <span className={`font-medium ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>{year} Curriculum</span>
                                    <span className="text-xs text-gray-500">{isPassed ? 'Completed' : (isUnlocked ? 'In Progress' : 'Locked')}</span>
                                </div>
                                <div className="w-full bg-gray-100 h-2 rounded-full mt-2 overflow-hidden">
                                    <div className={`h-full rounded-full ${isPassed ? 'bg-green-500 w-full' : (isUnlocked ? 'bg-blue-500 w-1/3' : 'w-0')}`}></div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Profile Settings</h2>
        
        <form onSubmit={handleUpdateProfile} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
                <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Enter your name"
                />
            </div>
            
             <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
                <select 
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">This determines which leaderboard you appear on.</p>
            </div>

             <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input 
                    type="email" 
                    value={user.email}
                    disabled
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
            </div>
            <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
                {loading ? 'Saving...' : 'Save Changes'}
            </button>
        </form>

        <div className="bg-red-50 p-6 rounded-2xl border border-red-100">
            <h3 className="font-bold text-red-800 mb-2">Danger Zone</h3>
            <p className="text-sm text-red-600 mb-4">Resetting your progress will delete all unlocked levels and exam history. This action cannot be undone.</p>
            <button 
                onClick={handleReset}
                disabled={loading}
                className="flex items-center gap-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
            >
                <Icons.Trash className="w-4 h-4" /> Reset All Progress
            </button>
        </div>
    </div>
  );

  const renderSecurity = () => (
     <div className="space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800">Security</h2>
        
        <form onSubmit={handleUpdatePassword} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Change Password</h3>
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                />
            </div>
             <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="••••••••"
                />
            </div>
            <button 
                type="submit" 
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
                {loading ? 'Updating...' : 'Update Password'}
            </button>
        </form>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
       {message && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl animate-fade-in text-white font-medium ${message.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {message.text}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-8">
        {renderSidebar()}
        <div className="flex-1">
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'settings' && renderSettings()}
            {activeTab === 'security' && renderSecurity()}
        </div>
      </div>
    </div>
  );
};
