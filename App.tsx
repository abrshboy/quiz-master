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
import { ProfileDashboard } from './components/ProfileDashboard';
import { 
  getUserProgress, 
  saveUserProgress, 
  unlockNextYearLocal, 
  unlockNextPartLocal,
  initialProgress
} from './services/progressService';
import { supabase } from './services/supabaseClient';

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
    // Check active session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleUserLogin(session.user);
      } else {
        setLoadingProgress(false);
      }
    };
    
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Only trigger login logic if we don't already have the user or if the user changed
        setUser(prev => {
          if (prev?.id !== session.user.id) {
             handleUserLogin(session.user);
             return prev; // State update happens in handleUserLogin
          }
          return prev;
        });
      } else {
        setUser(null);
        setView(ViewState.AUTH);
        setProgress(initialProgress);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleUserLogin = async (authUser: any) => {
    const newUser: User = {
      id: authUser.id,
      email: authUser.email || '',
      username: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student',
    };
    setUser(newUser);
    
    setLoadingProgress(true);
    try {
        const loadedProgress = await getUserProgress(newUser.id);
        setProgress(loadedProgress);
    } catch (e) {
        console.error("Failed to load progress", e);
    } finally {
        setLoadingProgress(false);
        // Only switch view if we are still on AUTH page
        setView(prev => prev === ViewState.AUTH ? ViewState.DASHBOARD : prev);
    }
  };

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
        setView(ViewState.QUIZ);
      }
    }
  };

  const handleQuizComplete = async (score: number, passed: boolean) => {
    setLastScore({ score, passed });
    
    let newProgress = { ...progress };

    if (passed && selectedYear && selectedMode) {
      if (selectedMode === QuizMode.EXAM) {
        // Unlock next year logic
        newProgress = unlockNextYearLocal(selectedYear, newProgress);
        
        // Add to completed exams if not already there
        if (!newProgress.completedExams.includes(selectedYear)) {
          newProgress.completedExams = [...newProgress.completedExams, selectedYear];
        }
      } else if (selectedMode === QuizMode.PRACTICE && selectedPart) {
        // Unlock next part logic
        newProgress = unlockNextPartLocal(selectedYear, selectedPart, newProgress);
        
        // Save score
        const scoreKey = `${selectedYear}-${selectedPart}`;
        const currentBest = newProgress.practiceScores[scoreKey] || 0;
        if (score > currentBest) {
          newProgress.practiceScores[scoreKey] = score;
        }
      }
      
      await handleUpdateProgress(newProgress);
    }

    setView(ViewState.RESULT);
  };

  const handleQuizExit = () => {
    // If exiting mid-quiz, just go back to dashboard or appropriate menu
    // Progress is auto-saved by the Quiz component via onProgressUpdate hook
    setView(ViewState.DASHBOARD);
    setSelectedYear(null);
    setSelectedMode(null);
    setSelectedPart(null);
    setSelectedCourse(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setView(ViewState.AUTH);
    setUser(null);
  };

  // --- Render Helpers ---

  const renderDashboard = () => (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Welcome, {user?.username}</h1>
          <p className="text-gray-600 mt-1">Select a course to begin your learning journey</p>
        </div>
        <div className="flex gap-3">
             {user?.email === ADMIN_EMAIL && (
            <button 
              onClick={() => setView(ViewState.ADMIN)}
              className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 transition shadow-lg flex items-center gap-2"
            >
              <Icons.Shield className="w-4 h-4" /> Admin
            </button>
          )}
          <button 
            onClick={() => setView(ViewState.PROFILE)}
            className="bg-white text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 border border-gray-200 transition shadow-sm flex items-center gap-2"
          >
            <Icons.User className="w-4 h-4" /> Profile
          </button>
          <button 
            onClick={handleLogout}
            className="bg-white text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 border border-gray-200 transition shadow-sm flex items-center gap-2"
          >
             <Icons.LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {COURSES.map((course) => {
          const Icon = Icons[course.icon as keyof typeof Icons];
          return (
            <button
              key={course.id}
              onClick={() => handleCourseSelect(course.id)}
              className={`p-6 rounded-2xl border-2 text-left transition-all duration-300 group ${
                course.active 
                  ? 'bg-white border-transparent hover:border-blue-500 shadow-lg hover:shadow-xl hover:-translate-y-1' 
                  : 'bg-gray-50 border-gray-200 opacity-70 cursor-not-allowed'
              }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                course.active ? 'bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white' : 'bg-gray-200 text-gray-400'
              }`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">{course.title}</h3>
              <p className="text-sm text-gray-500">
                {course.active ? 'Available for practice and exams' : 'Coming Soon'}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderYearSelect = () => (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <button 
        onClick={() => setView(ViewState.DASHBOARD)} 
        className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Courses
      </button>
      
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Academic Year</h2>
      
      <div className="space-y-4">
        {YEARS.map((year) => {
          const isUnlocked = progress.unlockedYears.includes(year);
          const isCompleted = progress.completedExams.includes(year);
          
          return (
            <button
              key={year}
              onClick={() => handleYearSelect(year)}
              disabled={!isUnlocked}
              className={`w-full p-5 rounded-xl border-2 flex justify-between items-center transition-all ${
                isUnlocked
                  ? 'bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer'
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-100 text-green-600' : (isUnlocked ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-400')
                }`}>
                  {isCompleted ? <Icons.CheckCircle className="w-6 h-6" /> : (isUnlocked ? <Icons.Unlock className="w-5 h-5" /> : <Icons.Lock className="w-5 h-5" />)}
                </div>
                <div className="text-left">
                  <span className="block text-lg font-bold text-gray-800">{year} Curriculum</span>
                  <span className="text-sm text-gray-500">
                    {isCompleted ? 'Completed' : (isUnlocked ? 'Available' : 'Locked - Finish previous year')}
                  </span>
                </div>
              </div>
              {isUnlocked && <Icons.ChevronLeft className="w-5 h-5 rotate-180 text-gray-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderModeSelect = () => (
    <div className="max-w-2xl mx-auto p-6 animate-fade-in">
      <button 
        onClick={() => setView(ViewState.YEAR_SELECT)} 
        className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Years
      </button>

      <h2 className="text-2xl font-bold text-gray-800 mb-2">Select Mode</h2>
      <p className="text-gray-600 mb-8">Choose how you want to test your knowledge for {selectedYear}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={() => handleModeSelect(QuizMode.PRACTICE)}
          className="p-8 bg-white rounded-2xl border-2 border-transparent hover:border-blue-500 shadow-lg hover:shadow-xl transition-all group text-left"
        >
          <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Icons.Briefcase className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Practice Mode</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Master the content part by part. Instant feedback on every question. 
            No penalties for wrong answers.
          </p>
        </button>

        <button
          onClick={() => handleModeSelect(QuizMode.EXAM)}
          className="p-8 bg-white rounded-2xl border-2 border-transparent hover:border-purple-500 shadow-lg hover:shadow-xl transition-all group text-left"
        >
          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
            <Icons.Clock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Exam Mode</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            The real deal. 100 questions, timed. No feedback until the end. 
            Pass this to unlock the next year.
          </p>
        </button>
      </div>
    </div>
  );

  const renderPracticeList = () => (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <button 
        onClick={() => setView(ViewState.MODE_SELECT)} 
        className="mb-6 text-gray-500 hover:text-gray-800 flex items-center gap-2 transition-colors"
      >
        <Icons.ChevronLeft className="w-5 h-5" /> Back to Modes
      </button>

      <h2 className="text-2xl font-bold text-gray-800 mb-6">Select Practice Part</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className={`p-4 rounded-xl border flex justify-between items-center transition-all ${
                isUnlocked 
                  ? 'bg-white border-gray-200 hover:border-blue-400 hover:shadow-md' 
                  : 'bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                   score !== undefined && score >= PASSING_SCORE ? 'bg-green-100 text-green-700' : (isUnlocked ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500')
                }`}>
                  {partNum}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-700">Part {partNum}</div>
                  {score !== undefined && (
                    <div className="text-xs text-gray-500">Best: {score.toFixed(0)}%</div>
                  )}
                </div>
              </div>
              {!isUnlocked && <Icons.Lock className="w-4 h-4 text-gray-400" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderResult = () => (
    <div className="max-w-md mx-auto p-8 text-center animate-fade-in mt-12">
      <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 shadow-xl ${
        lastScore?.passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
      }`}>
        {lastScore?.passed ? <Icons.CheckCircle className="w-12 h-12" /> : <Icons.XCircle className="w-12 h-12" />}
      </div>
      
      <h2 className="text-3xl font-bold text-gray-800 mb-2">
        {lastScore?.passed ? 'Congratulations!' : 'Keep Trying!'}
      </h2>
      
      <p className="text-gray-600 mb-8">
        You scored <span className="font-bold text-gray-900">{lastScore?.score.toFixed(1)}%</span>. 
        {lastScore?.passed ? ' You have passed this section.' : ' You need 51% to pass.'}
      </p>

      <div className="space-y-3">
        {lastScore?.passed && selectedMode === QuizMode.EXAM && (
           <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm">
             🎉 New Year Unlocked! You can now access the next year's curriculum.
           </div>
        )}
        
        <button
          onClick={() => setView(ViewState.DASHBOARD)}
          className="w-full bg-gray-800 text-white py-3 rounded-xl font-medium hover:bg-gray-900 transition shadow-lg"
        >
          Return to Dashboard
        </button>
        
        <button
          onClick={() => {
            if (selectedMode === QuizMode.PRACTICE) setView(ViewState.PRACTICE_LIST);
            else setView(ViewState.MODE_SELECT);
          }}
          className="w-full bg-white text-gray-700 border border-gray-300 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );

  // Main Render Switch
  if (view === ViewState.AUTH) {
    return <AuthView />;
  }
  
  if (loadingProgress) {
    return (
       <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
            <p className="text-gray-500">Syncing your progress...</p>
          </div>
       </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Header Bar */}
      {view !== ViewState.QUIZ && (
         <header className="bg-white border-b border-gray-200 px-6 py-4 mb-4">
             <div className="max-w-6xl mx-auto flex justify-between items-center">
                 <div className="font-bold text-xl text-blue-600 tracking-tight cursor-pointer" onClick={() => setView(ViewState.DASHBOARD)}>
                    AceAcademia
                 </div>
                 {user && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 font-bold">
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="hidden sm:inline">{user.username}</span>
                    </div>
                 )}
             </div>
         </header>
      )}

      {view === ViewState.DASHBOARD && renderDashboard()}
      {view === ViewState.YEAR_SELECT && renderYearSelect()}
      {view === ViewState.MODE_SELECT && renderModeSelect()}
      {view === ViewState.PRACTICE_LIST && renderPracticeList()}
      {view === ViewState.RESULT && renderResult()}
      
      {view === ViewState.QUIZ && selectedCourse && selectedYear && selectedMode && (
        <div className="p-4">
          <Quiz
            courseId={selectedCourse}
            year={selectedYear}
            mode={selectedMode}
            part={selectedPart || undefined}
            onComplete={handleQuizComplete}
            onExit={handleQuizExit}
            onProgressUpdate={handleUpdateProgress}
            progress={progress}
          />
        </div>
      )}

      {view === ViewState.ADMIN && (
        <AdminUpload onBack={() => setView(ViewState.DASHBOARD)} />
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
    </div>
  );
}

export default App;