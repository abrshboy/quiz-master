
import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, User } from '../types';
import { fetchOverallLeaderboard, fetchDepartmentLeaderboard, fetchSpeedLeaderboard } from '../services/leaderboardService';
import { Icons } from './Icons';
import { DEPARTMENTS } from '../types';

interface LeaderboardProps {
  currentUser: User;
  onBack: () => void;
}

type LeaderboardType = 'OVERALL' | 'DEPARTMENT' | 'SPEED';

export const Leaderboard: React.FC<LeaderboardProps> = ({ currentUser, onBack }) => {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('OVERALL');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(DEPARTMENTS[1]); // Default to first actual dept

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab, selectedDept]);

  const loadLeaderboard = async () => {
    setLoading(true);
    let results: LeaderboardEntry[] = [];
    
    try {
      if (activeTab === 'OVERALL') {
        results = await fetchOverallLeaderboard();
      } else if (activeTab === 'DEPARTMENT') {
        results = await fetchDepartmentLeaderboard(selectedDept);
      } else if (activeTab === 'SPEED') {
        results = await fetchSpeedLeaderboard();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setData(results);
      setLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds === 99999) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
       {/* Header */}
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
              <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 mb-2 transition-colors">
                  <Icons.ChevronLeft className="w-5 h-5" /> Back to Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
              <p className="text-gray-500">See who's top of the class.</p>
          </div>
          
          <div className="flex bg-white p-1 rounded-xl shadow-sm border border-gray-200">
             <button 
                onClick={() => setActiveTab('OVERALL')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'OVERALL' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 All Time
             </button>
             <button 
                onClick={() => setActiveTab('DEPARTMENT')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'DEPARTMENT' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 Department
             </button>
             <button 
                onClick={() => setActiveTab('SPEED')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'SPEED' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
             >
                 Speed
             </button>
          </div>
       </div>

       {activeTab === 'DEPARTMENT' && (
           <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 overflow-x-auto">
               <span className="text-sm font-bold text-gray-500 uppercase tracking-wide shrink-0">Filter:</span>
               {DEPARTMENTS.filter(d => d !== 'General').map(dept => (
                   <button
                        key={dept}
                        onClick={() => setSelectedDept(dept)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${selectedDept === dept ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'}`}
                   >
                       {dept}
                   </button>
               ))}
           </div>
       )}

       {/* Ranking List */}
       <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
           {loading ? (
               <div className="flex flex-col items-center justify-center h-64">
                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600 mb-2"></div>
                   <p className="text-gray-400 text-sm">Loading rankings...</p>
               </div>
           ) : data.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                   <Icons.Trophy className="w-12 h-12 mb-2 opacity-20" />
                   <p>No records found for this category yet.</p>
               </div>
           ) : (
               <div className="divide-y divide-gray-50">
                   <div className="grid grid-cols-12 gap-4 p-4 text-xs font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50">
                       <div className="col-span-1 text-center">Rank</div>
                       <div className="col-span-6 md:col-span-5">Student</div>
                       <div className="col-span-5 md:col-span-6 text-right pr-4">
                           {activeTab === 'SPEED' ? 'Time' : 'Score / XP'}
                       </div>
                   </div>
                   
                   {data.map((entry, index) => {
                       const isCurrentUser = entry.user_id === currentUser.id;
                       const rank = index + 1;
                       let rankColor = 'bg-gray-100 text-gray-500';
                       if (rank === 1) rankColor = 'bg-yellow-100 text-yellow-700';
                       if (rank === 2) rankColor = 'bg-gray-200 text-gray-700';
                       if (rank === 3) rankColor = 'bg-orange-100 text-orange-700';

                       return (
                           <div key={entry.user_id} className={`grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors ${isCurrentUser ? 'bg-blue-50/30' : ''}`}>
                               <div className="col-span-1 flex justify-center">
                                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rankColor}`}>
                                       {rank}
                                   </div>
                                </div>
                                <div className="col-span-6 md:col-span-5 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0">
                                        {entry.username.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className={`font-bold truncate ${isCurrentUser ? 'text-blue-600' : 'text-gray-800'}`}>
                                            {entry.username} {isCurrentUser && '(You)'}
                                        </div>
                                        <div className="text-xs text-gray-500 truncate">{entry.department}</div>
                                    </div>
                                </div>
                                <div className="col-span-5 md:col-span-6 text-right pr-4">
                                    {activeTab === 'SPEED' ? (
                                        <div className="flex items-center justify-end gap-2 text-gray-800 font-mono font-bold">
                                            <Icons.Zap className="w-4 h-4 text-yellow-500" />
                                            {formatTime(entry.fastest_exam_time)}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-end">
                                            <div className="font-bold text-gray-800 text-lg">{entry.total_xp} XP</div>
                                            <div className="text-xs text-gray-500">Best: {entry.highest_score.toFixed(0)}%</div>
                                        </div>
                                    )}
                                </div>
                           </div>
                       );
                   })}
               </div>
           )}
       </div>
    </div>
  );
};
