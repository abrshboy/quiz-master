import React, { useState, useEffect } from 'react';
import { 
  ViewState, 
  User, 
  CourseId, 
  COURSES, 
  YEARS, 
  QuizMode, 
  PRACTICE_PARTS_COUNT, 
  UserProgress,
  PASSING_SCORE
} from './types';
import { Icons } from './components/Icons';
import Quiz from './components/Quiz';
import { AuthView } from './components/AuthView';
import { AdminUpload } from './components/AdminUpload';
import { 
  getUserProgress, 
  saveUserProgress, 
  unlockNextYearLocal, 
  unlockNextPartLocal,
  initialProgress
} from './services/progressService';
import { supabase } from './services/supabaseClient';

// Replace with your preferred admin email or remove check to allow all authenticated users
const ADMIN_EMAIL = 'admin@aceacademia.com';

function App() {
  const [view, setView] = useState<ViewState>(ViewState.AUTH);
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<UserProgress>(initialProgress);
  const [loadingProgress, setLoadingProgress] = useState(false);
  
  // Selection State
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<QuizMode | null>(null);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  
  // Result State
  const [lastScore, setLastScore] = useState<{score: number, passed: boolean} | null>(null);

  // Initialize Auth Listener
  useEffect(() => {
    // Check for initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        handleUserSession(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            handleUserSession(session.user);
        } else {
            setUser(null);
            setView(ViewState.AUTH);
            setProgress(initialProgress);
        }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUserSession = async (supabaseUser: any) => {
    setUser({ username: supabaseUser.email?.split('@')[0] || 'Student', email: supabaseUser.email! });
    
    // Only fetch progress if we don't have it or if the user changed
    // We set loading state to avoid flicker
    setLoadingProgress(true);
    const data = await getUserProgress(supabaseUser.id);
    setProgress(data);
    setLoadingProgress(false);
    
    // Move to dashboard if currently on Auth screen
    setView((prev) => prev === ViewState.AUTH ? ViewState.DASHBOARD : prev);
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setView(ViewState.AUTH);
  }

  // Navigation Handlers
  const handleCourseSelect = (id: string, active: boolean) => {
    if (!active) return;
    setSelectedCourse(id);
    setView(ViewState.YEAR_SELECT);
  };

  const handleYearSelect = (year: number) => {
    if (!progress.unlockedYears.includes(year)) return;
    setSelectedYear(year);
    setView(ViewState.MODE_SELECT);
  };

  const handleModeSelect = (mode: QuizMode) => {
    setSelectedMode(mode);
    if (mode === QuizMode.PRACTICE) {
      setView(ViewState.PRACTICE_LIST);
    } else {
      setView(ViewState.QUIZ);
    }
  };

  const handlePartSelect = (part: number) => {
    const currentYear = selectedYear || 2015;
    const maxUnlocked = progress.unlockedPracticeParts[currentYear] || 1;
    if (part > maxUnlocked) return;
    setSelectedPart(part);
    setView(ViewState.QUIZ);
  };

  // Called by Quiz when it updates session data (intermediate save)
  const handleProgressUpdate = async (newProgress: UserProgress) => {
      setProgress(newProgress);
      // Debounce saving to DB could be good here, but for now we direct save
      const currentUser = await supabase.auth.getUser();
      if (currentUser.data.user) {
          await saveUserProgress(currentUser.data.user.id, newProgress);
      }
  };

  const handleQuizComplete = async (score: number, passed: boolean) => {
    setLastScore({ score, passed });
    
    let newProgress = { ...progress };

    if (selectedMode === QuizMode.PRACTICE && passed) {
        newProgress = unlockNextPartLocal(selectedYear!, selectedPart!, newProgress);
    } else if (selectedMode === QuizMode.EXAM && passed) {
        newProgress = unlockNextYearLocal(selectedYear!, newProgress);
        if (!newProgress.completedExams.includes(selectedYear!)) {
            newProgress.completedExams.push(selectedYear!);
        }
    }
    
    // Optimistic Update
    setProgress(newProgress);
    setView(ViewState.RESULT);

    // Persist
    const currentUser = await supabase.auth.getUser();
    if (currentUser.data.user) {
        await saveUserProgress(currentUser.data.user.id, newProgress);
    }
  };

  const resetSelection = () => {
    setView(ViewState.DASHBOARD);
    setSelectedCourse(null);
    setSelectedYear(null);
    setSelectedMode(null);
    setSelectedPart(null);
  }

  const renderDashboard = () => (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
             <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back, {user?.username}</h1>
             <p className="text-gray-500">Select a course to continue your studies.</p>
        </div>
        <div className="flex gap-3">
          {user?.email === ADMIN_EMAIL && (
            <button 
              onClick={() => setView(ViewState.ADMIN)}
              className="text-sm bg-gray-800 text-white hover:bg-black transition-colors px-4 py-2 rounded-lg font-medium shadow-md"
            >
              Admin Dashboard
            </button>
          )}
          <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-500 flex items-center gap-1 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100">
              <Icons.LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
      
      {loadingProgress ? (
          <div className="flex justify-center p-12">
               <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
          </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COURSES.map((course) => {
            const Icon = Icons[course.icon as keyof typeof Icons];
            return (
                <div 
                key={course.id} 
                onClick={() => handleCourseSelect(course.id, course.active)}
                className={`relative bg-white rounded-2xl p-6 shadow-sm border transition-all duration-300 group overflow-hidden ${
                    course.active 
                    ? 'cursor-pointer hover:shadow-xl hover:-translate-y-1 border-gray-200 hover:border-blue-200' 
                    : 'opacity-75 cursor-not-allowed border-gray-100 bg-gray-50'
                }`}
                >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors duration-300 ${course.active ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-200 text-gray-400'}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <h3 className={`text-xl font-bold mb-2 ${course.active ? 'text-gray-800' : 'text-gray-800'}`}>{course.title}</h3>
                <p className="text-gray-500 text-sm">{course.active ? 'Available Now' : 'Coming Soon'}</p>
                
                {!course.active && (
                    <div className="absolute top-4 right-4 bg-yellow-100 text-yellow-700 text-xs font-bold px-2 py-1 rounded">
                        LOCKED
                    </div>
                )}
                </div>
            );
            })}
        </div>
      )}
    </div>
  );

  const renderYearSelect = () => (
    <div className="p-6 max-w-4xl mx-auto">
      <button onClick={() => setView(ViewState.DASHBOARD)} className="mb-6 flex items-center text-gray-500 hover:text-gray-800 transition-colors">
        <Icons.ChevronLeft className="w-5 h-5 mr-1" /> Back to Courses
      </button>
      <h2 className="text-2xl font-bold text-gray-800 mb-8">Select Academic Year</h2>
      
      <div className="space-y-4">
        {YEARS.map((year) => {
          const isUnlocked = progress.unlockedYears.includes(year);
          const isCompleted = progress.completedExams.includes(year);
          
          return (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              disabled={!isUnlocked}
              className={`w-full flex items-center justify-between p-6 rounded-xl border-2 text-left transition-all duration-300 group ${
                isUnlocked 
                  ? 'bg-white border-blue-100 hover:border-blue-500 shadow-sm hover:shadow-md hover:scale-[1.01]' 
                  : 'bg-gray-100 border-gray-200 cursor-not-allowed opacity-60'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isUnlocked ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-300 text-gray-500'}`}>
                   {isUnlocked ? <Icons.Unlock className="w-5 h-5"/> : <Icons.Lock className="w-5 h-5"/>}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{year} Curriculum</h3>
                  <p className="text-sm text-gray-500">{isUnlocked ? (isCompleted ? "Exam Passed" : "In Progress") : "Complete previous year to unlock"}</p>
                </div>
              </div>
              {isCompleted && <Icons.CheckCircle className="w-6 h-6 text-green-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderModeSelect = () => (
    <div className="p-6 max-w-4xl mx-auto">
       <button onClick={() => setView(ViewState.YEAR_SELECT)} className="mb-6 flex items-center text-gray-500 hover:text-gray-800 transition-colors">
        <Icons.ChevronLeft className="w-5 h-5 mr-1" /> Back to Years
      </button>
      <h2 className="text-2xl font-bold text-gray-800 mb-8">Select Mode for {selectedYear}</h2>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div 
            onClick={() => handleModeSelect(QuizMode.PRACTICE)}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:border-green-400 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icons.Briefcase className="w-24 h-24 text-green-600" />
            </div>
            <div className="bg-green-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-green-600 group-hover:scale-110 transition-transform duration-300">
                <Icons.Briefcase className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Practice Mode</h3>
            <p className="text-gray-500 mb-4">10 parts, 10 questions each. Immediate feedback. 10 minutes per part.</p>
             <span className="text-green-600 font-semibold text-sm group-hover:underline">Start Practice &rarr;</span>
        </div>

        <div 
            onClick={() => handleModeSelect(QuizMode.EXAM)}
            className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 hover:border-purple-400 cursor-pointer transition-all hover:shadow-xl hover:-translate-y-1 group relative overflow-hidden"
        >
             <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Icons.Cpu className="w-24 h-24 text-purple-600" />
            </div>
             <div className="bg-purple-100 w-16 h-16 rounded-2xl flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition-transform duration-300">
                <Icons.Cpu className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-2">Exam Mode</h3>
            <p className="text-gray-500 mb-4">100 questions. No feedback until the end. 100 minutes. Pass mark: 51%.</p>
            <span className="text-purple-600 font-semibold text-sm group-hover:underline">Start Exam &rarr;</span>
        </div>
      </div>
    </div>
  );

  const renderPracticeList = () => {
    const unlockedLevel = progress.unlockedPracticeParts[selectedYear!] || 1;
    
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <button onClick={() => setView(ViewState.MODE_SELECT)} className="mb-6 flex items-center text-gray-500 hover:text-gray-800 transition-colors">
                <Icons.ChevronLeft className="w-5 h-5 mr-1" /> Back to Modes
            </button>
            <h2 className="text-2xl font-bold text-gray-800 mb-8">Practice Sessions ({selectedYear})</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Array.from({ length: PRACTICE_PARTS_COUNT }).map((_, i) => {
                    const partNum = i + 1;
                    const isUnlocked = partNum <= unlockedLevel;
                    return (
                        <button
                            key={partNum}
                            disabled={!isUnlocked}
                            onClick={() => handlePartSelect(partNum)}
                            className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all duration-300 ${
                                isUnlocked 
                                ? 'bg-white border-blue-100 hover:border-blue-500 hover:shadow-lg hover:-translate-y-1 cursor-pointer text-blue-600' 
                                : 'bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed text-gray-400'
                            }`}
                        >
                            <span className={`text-2xl font-bold mb-1`}>{partNum}</span>
                            <span className="text-xs text-gray-500 uppercase font-semibold">Part</span>
                            {!isUnlocked && <Icons.Lock className="w-4 h-4 text-gray-400 mt-2" />}
                        </button>
                    )
                })}
            </div>
        </div>
    );
  };

  const renderResult = () => {
    const passed = lastScore?.passed;
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
             <div className="bg-white p-10 rounded-3xl shadow-xl max-w-lg w-full text-center border border-gray-100 animate-fade-in">
                <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 shadow-inner ${passed ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {passed ? <Icons.CheckCircle className="w-12 h-12" /> : <Icons.XCircle className="w-12 h-12" />}
                </div>
                
                <h2 className={`text-3xl font-bold mb-2 ${passed ? 'text-gray-800' : 'text-gray-800'}`}>
                    {passed ? 'Congratulations!' : 'Keep Practicing'}
                </h2>
                <p className="text-gray-500 mb-8">
                    {passed 
                        ? `You have passed this ${selectedMode} session.` 
                        : `You didn't meet the passing criteria of ${PASSING_SCORE}%.`}
                </p>

                <div className="bg-gray-50 rounded-xl p-6 mb-8 border border-gray-100">
                    <span className="block text-sm text-gray-500 uppercase tracking-wider font-semibold mb-1">Your Score</span>
                    <span className={`text-5xl font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>
                        {lastScore?.score.toFixed(1)}%
                    </span>
                </div>

                <div className="space-y-3">
                    <button onClick={resetSelection} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-blue-200 hover:-translate-y-0.5">
                        Back to Dashboard
                    </button>
                    {selectedMode === QuizMode.PRACTICE && !passed && (
                         <button onClick={() => setView(ViewState.QUIZ)} className="w-full bg-white hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-lg border border-gray-300 transition-colors">
                            Retry Part
                        </button>
                    )}
                </div>
             </div>
        </div>
    );
  };

  // Main Render Switch
  if (view === ViewState.AUTH) return <AuthView />;
  if (view === ViewState.DASHBOARD) return renderDashboard();
  if (view === ViewState.YEAR_SELECT) return renderYearSelect();
  if (view === ViewState.MODE_SELECT) return renderModeSelect();
  if (view === ViewState.PRACTICE_LIST) return renderPracticeList();
  if (view === ViewState.RESULT) return renderResult();
  if (view === ViewState.ADMIN) return <AdminUpload onBack={() => setView(ViewState.DASHBOARD)} />;
  if (view === ViewState.QUIZ) {
    return (
        <div className="p-4 md:p-6 min-h-screen">
             <Quiz 
                courseId={selectedCourse!}
                year={selectedYear!}
                mode={selectedMode!}
                part={selectedPart || undefined}
                onComplete={handleQuizComplete}
                onExit={() => setView(ViewState.DASHBOARD)}
                onProgressUpdate={handleProgressUpdate}
                progress={progress}
             />
        </div>
    );
  }

  return <div>Unknown View</div>;
}

export default App;
