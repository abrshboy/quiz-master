
import React from 'react';
import { User, UserProgress, COURSES, ViewState, QuizMode } from '../types';
import { Icons } from './Icons';
import { isDailyChallengeAvailable } from '../services/progressService';

interface DashboardProps {
  user: User;
  progress: UserProgress;
  onSelectCourse: (courseId: string) => void;
  onNavigate: (view: ViewState) => void;
  onStartDailyChallenge: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, progress, onSelectCourse, onNavigate, onStartDailyChallenge }) => {
  const currentLevel = Math.max(...progress.unlockedYears);
  const isDailyAvailable = isDailyChallengeAvailable(progress);
  
  // Calculate Progress for each course
  const getCourseProgress = (courseId: string) => {
      return progress.unlockedYears.length > 1 ? 25 * (progress.unlockedYears.length - 1) : 10;
  };

  const formatDate = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Section */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Hello, {user.username.split(' ')[0]} <span className="inline-block animate-bounce">👋</span>
          </h1>
          <p className="text-gray-500 mt-2 text-lg">Let's continue your learning journey.</p>
        </div>
        <div className="flex gap-4">
             <div className="flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-2xl border border-orange-100 shadow-sm">
                <div className="p-1 bg-orange-100 rounded-full"><Icons.TrendingUp className="w-4 h-4" /></div>
                <div>
                    <span className="block text-xs font-semibold text-orange-400 uppercase tracking-wider">Streak</span>
                    <span className="font-bold text-lg leading-none">{progress.streak || 0} Days</span>
                </div>
            </div>
             <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm">
                <div className="p-1 bg-blue-100 rounded-full"><Icons.Award className="w-4 h-4" /></div>
                <div>
                    <span className="block text-xs font-semibold text-blue-400 uppercase tracking-wider">Total XP</span>
                    <span className="font-bold text-lg leading-none">{progress.totalXp || 0}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Course Cards */}
        <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <Icons.Briefcase className="w-5 h-5 text-gray-400" /> My Courses
                </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {COURSES.map((course) => {
                const Icon = Icons[course.icon as keyof typeof Icons];
                const percent = getCourseProgress(course.id);
                
                return (
                    <button
                    key={course.id}
                    onClick={() => onSelectCourse(course.id)}
                    className={`relative overflow-hidden p-6 rounded-3xl text-left transition-all duration-300 group ${
                        course.active 
                        ? 'bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100' 
                        : 'bg-gray-50 border border-gray-100 opacity-70 cursor-not-allowed'
                    }`}
                    >
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gray-100">
                        <div className={`h-full transition-all duration-1000 ${course.active ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ width: `${percent}%` }}></div>
                    </div>

                    <div className="flex justify-between items-start mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                            course.active ? course.color : 'bg-gray-200 text-gray-400'
                        }`}>
                            <Icon className="w-6 h-6" />
                        </div>
                        {course.active && (
                             <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                                 Lvl {currentLevel - 2014}
                             </span>
                        )}
                    </div>
                    
                    <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">{course.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">
                        {course.active ? `${percent}% Complete` : 'Coming Soon'}
                    </p>
                    </button>
                );
                })}
            </div>
        </div>

        {/* Right Column: Recent Activity & Calendar */}
        <div className="space-y-6">
            {/* Daily Challenge Card */}
            <div className={`rounded-3xl p-6 shadow-lg transition-all ${isDailyAvailable ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-indigo-200' : 'bg-white border border-gray-100 text-gray-500 grayscale'}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className={`font-bold text-lg mb-1 ${isDailyAvailable ? 'text-white' : 'text-gray-800'}`}>Daily Challenge</h3>
                        <p className={`text-sm mb-4 ${isDailyAvailable ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {isDailyAvailable ? 'Complete 10 questions to earn 50 XP!' : 'Come back tomorrow for new questions.'}
                        </p>
                    </div>
                    <div className={`p-2 rounded-xl ${isDailyAvailable ? 'bg-white/20' : 'bg-gray-100'}`}>
                        <Icons.Award className="w-6 h-6" />
                    </div>
                </div>
                
                {isDailyAvailable ? (
                    <>
                        <div className="w-full bg-white/20 h-2 rounded-full mb-4">
                            <div className="bg-white h-full rounded-full w-0"></div>
                        </div>
                        <button 
                            onClick={onStartDailyChallenge}
                            className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors"
                        >
                            Start Now
                        </button>
                    </>
                ) : (
                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 p-3 rounded-xl justify-center">
                        <Icons.CheckCircle className="w-5 h-5" /> Completed
                    </div>
                )}
            </div>

             {/* Recent Activity */}
             <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Icons.Activity className="w-5 h-5 text-purple-500" /> Recent Activity
                </h2>
                
                {progress.recentActivities && progress.recentActivities.length > 0 ? (
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {progress.recentActivities.slice(0, 5).map((activity, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className={`p-2 rounded-full shrink-0 ${
                                    activity.type === 'EXAM_PASS' ? 'bg-green-100 text-green-600' : 
                                    (activity.type === 'EXAM_FAIL' ? 'bg-red-100 text-red-600' : 
                                    (activity.type === 'DAILY_CHALLENGE' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'))
                                }`}>
                                    {activity.type === 'EXAM_PASS' || activity.type === 'DAILY_CHALLENGE' ? <Icons.CheckCircle className="w-4 h-4" /> : <Icons.Activity className="w-4 h-4" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-gray-800 truncate">{activity.description}</div>
                                    <div className="text-xs text-gray-500 flex justify-between">
                                        <span>+{activity.xpGained} XP</span>
                                        <span>{formatDate(activity.timestamp)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-400 text-sm">
                        No recent activity. Start a quiz!
                    </div>
                )}
                 <button 
                    onClick={() => onNavigate(ViewState.PROFILE)}
                    className="w-full mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-2 rounded-lg transition-colors"
                >
                    View Full History
                 </button>
            </div>
        </div>

      </div>
    </div>
  );
};
