
import React from 'react';
import { User, UserProgress, COURSES, ViewState } from '../types';
import { Icons } from './Icons';

interface DashboardProps {
  user: User;
  progress: UserProgress;
  onSelectCourse: (courseId: string) => void;
  onNavigate: (view: ViewState) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, progress, onSelectCourse, onNavigate }) => {
  const currentLevel = Math.max(...progress.unlockedYears);
  
  // Calculate Progress for each course (Mock calculation based on general progress)
  const getCourseProgress = (courseId: string) => {
      // Logic could be more complex based on specific course data if available
      return progress.unlockedYears.length > 1 ? 25 * (progress.unlockedYears.length - 1) : 10;
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
                    {/* Progress Bar Background */}
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
             <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Icons.Activity className="w-5 h-5 text-purple-500" /> Recent Activity
                </h2>
                {progress.completedExams.length > 0 ? (
                    <div className="space-y-4">
                        {progress.completedExams.slice(-3).reverse().map((year, idx) => (
                             <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="bg-green-100 text-green-600 p-2 rounded-full">
                                    <Icons.CheckCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-gray-800">Passed {year} Exam</div>
                                    <div className="text-xs text-gray-500">Management Course</div>
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

            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200">
                <h3 className="font-bold text-lg mb-2">Daily Challenge</h3>
                <p className="text-indigo-100 text-sm mb-4">Complete one practice session today to keep your streak alive!</p>
                <div className="w-full bg-white/20 h-2 rounded-full mb-4">
                    <div className="bg-white h-full rounded-full w-0"></div>
                </div>
                <button className="w-full bg-white text-indigo-600 font-bold py-3 rounded-xl hover:bg-indigo-50 transition-colors">
                    Start Now
                </button>
            </div>
        </div>

      </div>
    </div>
  );
};
