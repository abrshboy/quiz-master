
import React, { useState, useEffect } from 'react';
import { Icons } from './Icons';
import { fetchAdminStats, AdminStats } from '../services/adminService';
import { AdminUpload } from './AdminUpload';

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [mode, setMode] = useState<'STATS' | 'UPLOAD'>('STATS');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (mode === 'STATS') {
      loadStats();
    }
  }, [mode]);

  const loadStats = async () => {
    setLoading(true);
    const data = await fetchAdminStats();
    setStats(data);
    setLoading(false);
  };

  if (mode === 'UPLOAD') {
    return <AdminUpload onBack={() => setMode('STATS')} />;
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 mb-2 transition-colors">
              <Icons.ChevronLeft className="w-5 h-5" /> Back to App
           </button>
           <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
           <p className="text-gray-500">Monitor system performance and manage content.</p>
        </div>
        
        <button 
          onClick={() => setMode('UPLOAD')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center gap-2"
        >
           <Icons.FileText className="w-5 h-5" />
           Manage Questions
        </button>
      </div>

      {loading ? (
         <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
         </div>
      ) : (
        <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                            <Icons.Users className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded-lg">Active</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-800 mb-1">{stats?.totalUsers}</div>
                    <div className="text-sm text-gray-500">Total Registered Students</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Icons.FileText className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-3xl font-bold text-gray-800 mb-1">{stats?.totalQuestions}</div>
                    <div className="text-sm text-gray-500">Total Questions in DB</div>
                </div>

                 <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl">
                            <Icons.Activity className="w-6 h-6" />
                        </div>
                        <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-lg">7 Days</span>
                    </div>
                    <div className="text-3xl font-bold text-gray-800 mb-1">{stats?.recentAttempts}</div>
                    <div className="text-sm text-gray-500">Quiz Attempts (Last 7d)</div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                            <Icons.Building className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="text-xl font-bold text-gray-800 mb-1 truncate">{stats?.mostActiveDepartment}</div>
                    <div className="text-sm text-gray-500">Most Active Department</div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity Feed */}
                <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Icons.Activity className="w-5 h-5 text-gray-400" /> Live User Activity
                    </h3>
                    
                    <div className="space-y-4">
                        {stats?.recentActivity.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">No recent activity found.</div>
                        ) : (
                            stats?.recentActivity.map((act) => (
                                <div key={act.id} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {act.username ? act.username.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-800">
                                            <span className="font-bold">{act.username}</span> 
                                            <span className="text-gray-600 font-normal"> {act.activity_type === 'EXAM_PASS' ? 'passed an exam' : 'completed a session'}</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            XP Gained: <span className="text-blue-600 font-bold">+{act.xp_gained}</span>
                                        </div>
                                    </div>
                                    <div className="text-xs text-gray-400 whitespace-nowrap">
                                        {formatDate(act.created_at)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                
                {/* Departments Overview (Simple List) */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
                     <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Icons.BarChart className="w-5 h-5 text-gray-400" /> Dept. Overview
                    </h3>
                    <div className="p-6 bg-blue-50 rounded-2xl text-center mb-6">
                        <div className="text-4xl font-bold text-blue-600 mb-2">{stats?.totalDepartments}</div>
                        <div className="text-sm text-blue-800 font-medium">Tracking Departments</div>
                    </div>
                    
                    <p className="text-sm text-gray-500 leading-relaxed">
                        The <strong>{stats?.mostActiveDepartment}</strong> department is currently leading in engagement. Consider adding more targeted questions for other departments to boost participation.
                    </p>
                    
                    <button onClick={() => setMode('UPLOAD')} className="mt-6 w-full py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-colors flex items-center justify-center gap-2">
                        Add Content <Icons.ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </>
      )}
    </div>
  );
};
