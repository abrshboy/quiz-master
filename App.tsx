
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
  PASSING_SCORE,
  EXAM_QUESTIONS_COUNT
} from './types';
import { Icons } from './components/Icons';
import Quiz from './components/Quiz';
import { Dashboard } from './components/Dashboard';
import { AuthView } from './components/AuthView';
import { AdminDashboard } from './components/AdminDashboard';
import { ProfileDashboard } from './components/ProfileDashboard';
import { Leaderboard } from './components/Leaderboard';
import { 
  getUserProgress, 
  saveUserProgress, 
  unlockNextYearLocal, 
  unlockNextPartLocal,
  initialProgress,
  updateStreak,
  logActivity,
  syncLeaderboardStats
} from './services/progressService';
import { supabase } from './services/supabaseClient';

const ADMIN_EMAIL = 'admin@aceacademia.com';

function App() {
  const [view, setView] = useState<ViewState>(ViewState.AUTH);
  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<UserProgress>(initialProgress);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  
  // Selection State
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMode, setSelectedMode] = useState<QuizMode | null>(null);
  const [selectedPart, setSelectedPart] = useState<number | null>(null);
  
  // Result State
  const [lastScore, setLastScore] = useState<{score: number, passed: boolean} | null>(null);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);

  // Consolidated Login Logic
  const handleUserLogin = async (authUser: any) => {
    if (!authUser) return;

    const newUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      username: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student',
    };
    
    // Set user immediately to prevent AuthView from lingering if logic takes time
    setUser(newUser);
    setLoadingProgress(true);

    try {
        let loadedProgress = await getUserProgress(newUser.id);
        loadedProgress = updateStreak(loadedProgress);
        
        await saveUserProgress(newUser.id, loadedProgress);
        await syncLeaderboardStats(newUser.id, newUser.username, loadedProgress);
        
        setProgress(loadedProgress);
        setView(ViewState.DASHBOARD);
    } catch (e) {
        console.error("Failed to load progress", e);
        // Fallback safety to prevent white screen
        setProgress(initialProgress);
        setView(ViewState.DASHBOARD);
    } finally {
        setLoadingProgress(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user && mounted) {
                await handleUserLogin(session.user);
            } else if (mounted) {
                setLoadingProgress(false);
            }
        } catch (error) {
            console.error("Auth init error:", error);
            if (mounted) setLoadingProgress(false);
        } finally {
            if (mounted) setIsAppReady(true);
        }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log(`Auth Event: ${event}`);

      if (event === 'SIGNED_IN' && session?.user) {
         // Using functional update to check if we really need to re-login
         setUser(currentUser => {
             if (currentUser?.id !== session.user.id) {
                 // Trigger async login but don't await it inside the setter
                 handleUserLogin(session.user);
             }
             return currentUser;
         });
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setView(ViewState.AUTH);
        setProgress(initialProgress);
        setLoadingProgress(false);
      }
    });

    return () => {
        mounted = false;
        subscription.unsubscribe();
    };
  }, []);

  const handleUpdateProgress = async (newProgress: UserProgress) => {
    setProgress(newProgress);
    if (user) {
      await saveUserProgress(user.id, newProgress);
    }
  };

  const handleCourseSelect = (courseId: string) => {
    const course = COURSES.find(c => c.id === courseId);
    if (course && course.active) {
      setSelectedCourse(courseId);
      setView(ViewState.YEAR_SELECT);
    } else {
      alert("This course is coming soon!");
    }
  };

  const handleYearSelect = (year: number) => {
    if (progress.unlockedYears.includes(year)) {
      setSelectedYear(year);
      setView(ViewState.MODE_SELECT);
    }
  };

  const handleModeSelect = (mode: QuizMode) => {
    setSelectedMode(mode);
    setQuizStartTime(Date.now());
    if (mode === QuizMode.PRACTICE) {
      setView(ViewState.PRACTICE_LIST);
    } else {
      setView(ViewState.QUIZ);
    }
  };

  const handlePartSelect = (part: number) => {
    if (selectedYear) {
      const maxPart = progress.unlockedPracticeParts[selectedYear] || 1;
      if (part <= maxPart) {
        setSelectedPart(part);
        setQuizStartTime(Date.now());
        setView(ViewState.QUIZ);
      }
    }
  };

  const handleStartDailyChallenge = () => {
    setSelectedCourse(COURSES[0].id);
    setSelectedYear(2015); 
    setSelectedMode(QuizMode.DAILY_CHALLENGE);
    setQuizStartTime(Date.now());
    setView(ViewState.QUIZ);
  };

  const handleQuizComplete = async (score: number, passed: boolean) => {
    setLastScore({ score, passed });
    const timeTakenSeconds = Math.floor((Date.now() - quizStartTime) / 1000);
    
    let newProgress = { ...progress };
    let xpGained = 0;
    let activityDesc = '';
    let activityType: any = 'PRACTICE';

    if (selectedMode === QuizMode.DAILY_CHALLENGE) {
        xpGained = 50;
        activityDesc = `Completed Daily Challenge`;
        activityType = 'DAILY_CHALLENGE';
        newProgress.dailyChallengeLastCompleted = new Date().toISOString();
        newProgress = updateStreak(newProgress); 

    } else if (selectedMode === QuizMode.EXAM) {
        const currentHighScore = newProgress.highestExamScore || 0;
        if (score > currentHighScore) {
            newProgress.highestExamScore = score;
        }

        const currentBestTime = newProgress.fastestExamTime || 99999;
        if (passed && timeTakenSeconds < currentBestTime) {
            newProgress.fastestExamTime = timeTakenSeconds;
        }

        if (passed) {
            xpGained = 150;
            activityDesc = `Passed ${selectedYear} Exam`;
            activityType = 'EXAM_PASS';
            newProgress = unlockNextYearLocal(selectedYear!, newProgress);
            if (!newProgress.completedExams.includes(selectedYear!)) {
                newProgress.completedExams = [...newProgress.completedExams, selectedYear!];
            }
        } else {
            xpGained = 10;
            activityDesc = `Attempted ${selectedYear} Exam`;
            activityType = 'EXAM_FAIL';
        }
    } else if (selectedMode === QuizMode.PRACTICE) {
        xpGained = 20;
        activityDesc = `Completed Practice Part ${selectedPart}`;
        activityType = 'PRACTICE';
        if (passed && selectedPart) {
            newProgress = unlockNextPartLocal(selectedYear!, selectedPart, newProgress);
            const scoreKey = `${selectedYear}-${selectedPart}`;
            const currentBest = newProgress.practiceScores[scoreKey] || 0;
            if (score > currentBest) {
                newProgress.practiceScores[scoreKey] = score;
            }
        }
    }

    newProgress = logActivity(newProgress, activityType, activityDesc, xpGained);

    await handleUpdateProgress(newProgress);
    if (user) {
        await syncLeaderboardStats(user.id, user.username, newProgress, { type: activityType, xp: xpGained });
    }

    setView(ViewState.RESULT);
  };

  const handleQuizExit = () => {
    setView(ViewState.DASHBOARD);
    setSelectedYear(null);
    setSelectedMode(null);
    setSelectedPart(null);
    setSelectedCourse(null);
  };

  const handleLogout = async () => {
    setLoadingProgress(true);
    await supabase.auth.signOut();
  };

  const renderYearSelect = () => (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button 
        onClick={() => setView(ViewState.DASHBOARD)} 
        className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors font-medium px-4 py-2 hover:bg-gray-100 rounded-lg w-fit"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Dashboard
      </button>
      
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900">Select Academic Year</h2>
        <p className="text-gray-500 mt-2">Choose where you want to continue your studies</p>
      </div>
      
      <div className="space-y-4">
        {YEARS.map((year) => {
          const isUnlocked = progress.unlockedYears.includes(year);
          const isCompleted = progress.completedExams.includes(year);
          
          return (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              disabled={!isUnlocked}
              className={`w-full p-6 rounded-2xl border flex justify-between items-center transition-all group ${
                isUnlocked
                  ? 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                  isCompleted ? 'bg-green-100 text-green-600' : (isUnlocked ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400')
                }`}>
                  {isCompleted ? <Icons.CheckCircle className="w-8 h-8" /> : (isUnlocked ? <Icons.Unlock className="w-6 h-6" /> : <Icons.Lock className="w-6 h-6" />)}
                </div>
                <div className="text-left">
                  <span className={`block text-xl font-bold ${isUnlocked ? 'text-gray-800' : 'text-gray-400'}`}>{year} Curriculum</span>
                  <span className="text-sm text-gray-500 font-medium">
                    {isCompleted ? 'Completed' : (isUnlocked ? 'Available' : 'Locked - Finish previous year')}
                  </span>
                </div>
              </div>
              {isUnlocked && <Icons.ChevronLeft className="w-6 h-6 rotate-180 text-gray-300 group-hover:text-blue-500 transition-colors" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderModeSelect = () => (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <button 
        onClick={() => setView(ViewState.YEAR_SELECT)} 
        className="mb-8 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors font-medium px-4 py-2 hover:bg-gray-100 rounded-lg w-fit"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Years
      </button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <button
          onClick={() => handleModeSelect(QuizMode.PRACTICE)}
          className="p-8 bg-white rounded-3xl border border-gray-100 hover:border-blue-500 shadow-lg hover:shadow-2xl transition-all group text-left hover:-translate-y-1"
        >
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Icons.Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">Practice Mode</h3>
          <p className="text-gray-500 leading-relaxed">
            Master the content part by part with instant feedback. Perfect for learning at your own pace.
          </p>
        </button>

        <button
          onClick={() => handleModeSelect(QuizMode.EXAM)}
          className="p-8 bg-white rounded-3xl border border-gray-100 hover:border-purple-500 shadow-lg hover:shadow-2xl transition-all group text-left hover:-translate-y-1"
        >
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Icons.Clock className="w-8 h-8" />
          </div>
          <h3 className="text-2xl font-bold text-gray-800 mb-3">Exam Mode</h3>
          <p className="text-gray-500 leading-relaxed">
            Simulate the real exam environment. 100 timed questions with no hints. Pass to unlock the next level.
          </p>
        </button>
      </div>
    </div>
  );

  const renderPracticeList = () => (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <button 
        onClick={() => setView(ViewState.MODE_SELECT)} 
        className="mb-8 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors font-medium px-4 py-2 hover:bg-gray-100 rounded-lg w-fit"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Modes
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-6 px-2">Select Practice Part</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: PRACTICE_PARTS_COUNT }).map((_, idx) => {
          const partNum = idx + 1;
          const maxUnlocked = (selectedYear && progress.unlockedPracticeParts[selectedYear]) || 1;
          const isUnlocked = partNum <= maxUnlocked;
          const score = selectedYear ? progress.practiceScores[`${selectedYear}-${partNum}`] : undefined;

          return (
            <button
              key={partNum}
              onClick={() => handlePartSelect(partNum)}
              disabled={!isUnlocked}
              className={`p-5 rounded-2xl border flex flex-col items-center justify-center text-center gap-3 transition-all min-h-[140px] ${
                isUnlocked 
                  ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-lg hover:-translate-y-1' 
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
               <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                   score !== undefined && score >= PASSING_SCORE ? 'bg-green-100 text-green-700' : (isUnlocked ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500')
                }`}>
                  {partNum}
                </div>
                <div>
                  <div className="font-bold text-gray-800 text-lg">Part {partNum}</div>
                  {score !== undefined ? (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-full mt-1 ${score >= PASSING_SCORE ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                        Score: {score.toFixed(0)}%
                    </div>
                  ) : (
                      isUnlocked && <div className="text-xs text-blue-500 mt-1">Start</div>
                  )}
                </div>
              {!isUnlocked && <Icons.Lock className="w-4 h-4 text-gray-300 absolute top-4 right-4" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="max-w-md mx-auto p-8 text-center animate-fade-in mt-12 bg-white rounded-3xl shadow-xl border border-gray-100">
      <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl ${
        lastScore?.passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
        {lastScore?.passed ? <Icons.CheckCircle className="w-12 h-12" /> : <Icons.XCircle className="w-12 h-12" />}
      </div>
      
      <h2 className="text-3xl font-bold text-gray-800 mb-2">
        {lastScore?.passed ? 'Congratulations!' : 'Nice Try!'}
      </h2>
      
      <p className="text-gray-600 mb-8 text-lg">
        You scored <span className={`font-bold ${lastScore?.passed ? 'text-green-600' : 'text-red-500'}`}>{lastScore?.score.toFixed(1)}%</span>. 
      </p>

      <div className="space-y-4">
        <button
          onClick={() => {
            if (selectedMode === QuizMode.PRACTICE) setView(ViewState.PRACTICE_LIST);
            else if (selectedMode === QuizMode.DAILY_CHALLENGE) setView(ViewState.DASHBOARD);
            else setView(ViewState.MODE_SELECT);
          }}
          className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200"
        >
          {selectedMode === QuizMode.DAILY_CHALLENGE ? 'Finish' : 'Try Again'}
        </button>

         <button
          onClick={() => setView(ViewState.DASHBOARD)}
          className="w-full bg-white text-gray-700 border border-gray-200 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition"
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  // --- Main Render Switch ---

  if (!isAppReady || loadingProgress) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-gray-500 font-medium">
               {user ? "Syncing your progress..." : "Initializing..."}
            </p>
          </div>
       </div>
    );
  }

  // Ensure View is correct relative to user state
  if ((view === ViewState.AUTH || !user)) {
      return <AuthView />;
  }

  // Quiz View is Full Screen
  if (view === ViewState.QUIZ && selectedCourse && (selectedYear || selectedMode === QuizMode.DAILY_CHALLENGE) && selectedMode) {
     return (
        <div className="min-h-screen bg-[#f8fafc]">
          <Quiz
            courseId={selectedCourse}
            year={selectedYear || 0}
            mode={selectedMode}
            part={selectedPart || undefined}
            onComplete={handleQuizComplete}
            onExit={handleQuizExit}
            onProgressUpdate={handleUpdateProgress}
            progress={progress}
          />
        </div>
     )
  }

  // --- Sidebar Layout ---
  return (
    <div className="min-h-screen bg-[#f8fafc] flex">
       {/* Mobile Sidebar Overlay */}
       {sidebarOpen && (
         <div className="fixed inset-0 bg-black/20 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
       )}

       {/* Sidebar */}
       <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-72 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 h-full flex flex-col justify-between">
              <div>
                  <div className="flex items-center gap-3 px-2 mb-10">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-200">
                        A
                      </div>
                      <span className="font-bold text-xl text-gray-800 tracking-tight">AceAcademia</span>
                  </div>

                  <nav className="space-y-1">
                      <button 
                        onClick={() => { setView(ViewState.DASHBOARD); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 ${view === ViewState.DASHBOARD ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                      >
                          <Icons.LayoutDashboard className="w-5 h-5" /> Dashboard
                      </button>
                      
                       <button 
                        onClick={() => { setView(ViewState.LEADERBOARD); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 ${view === ViewState.LEADERBOARD ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                      >
                          <Icons.Trophy className="w-5 h-5" /> Leaderboard
                      </button>

                       <button 
                        onClick={() => { setView(ViewState.PROFILE); setSidebarOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 ${view === ViewState.PROFILE ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                      >
                          <Icons.User className="w-5 h-5" /> Profile
                      </button>

                       {user?.email === ADMIN_EMAIL && (
                        <button 
                            onClick={() => { setView(ViewState.ADMIN); setSidebarOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl font-medium transition-all duration-200 ${view === ViewState.ADMIN ? 'bg-blue-50 text-blue-700 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            <Icons.Shield className="w-5 h-5" /> Admin Panel
                        </button>
                      )}
                  </nav>
              </div>

              <div className="border-t border-gray-100 pt-6">
                   <div className="flex items-center gap-3 px-2 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                            {user?.username.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{user?.username}</p>
                            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                        </div>
                   </div>
                   <button 
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors font-medium text-sm"
                   >
                       <Icons.LogOut className="w-4 h-4" /> Sign Out
                   </button>
              </div>
          </div>
       </aside>

       {/* Main Content Area */}
       <main className="flex-1 p-4 lg:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
            {/* Mobile Header Toggle */}
            <div className="lg:hidden flex justify-between items-center mb-6">
                 <div className="flex items-center gap-2 font-bold text-gray-800 text-lg">
                    AceAcademia
                 </div>
                 <button onClick={() => setSidebarOpen(true)} className="p-2 bg-white rounded-lg border border-gray-200 shadow-sm">
                     <Icons.Menu className="w-6 h-6 text-gray-600" />
                 </button>
            </div>

            {view === ViewState.DASHBOARD && (
                <Dashboard 
                    user={user!} 
                    progress={progress} 
                    onSelectCourse={handleCourseSelect}
                    onNavigate={(v) => setView(v)}
                    onStartDailyChallenge={handleStartDailyChallenge}
                />
            )}
            
            {view === ViewState.LEADERBOARD && user && (
                <Leaderboard 
                    currentUser={user}
                    onBack={() => setView(ViewState.DASHBOARD)}
                />
            )}
            
            {view === ViewState.YEAR_SELECT && renderYearSelect()}
            {view === ViewState.MODE_SELECT && renderModeSelect()}
            {view === ViewState.PRACTICE_LIST && renderPracticeList()}
            {view === ViewState.RESULT && renderResult()}
            
            {view === ViewState.ADMIN && (
                <AdminDashboard onBack={() => setView(ViewState.DASHBOARD)} />
            )}

            {view === ViewState.PROFILE && user && (
                <ProfileDashboard 
                    user={user}
                    progress={progress}
                    onBack={() => setView(ViewState.DASHBOARD)}
                    onUpdateUser={(u) => setUser(u)}
                    onResetProgress={() => setProgress(initialProgress)}
                />
            )}
       </main>
    </div>
  );
}

export default App;
