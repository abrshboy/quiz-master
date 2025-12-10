
import React, { useState, useEffect, useRef } from 'react';
import { QuizMode, Question, UserProgress, PASSING_SCORE, DAILY_CHALLENGE_COUNT } from '../types';
import { fetchQuestions, fetchDailyChallengeQuestions } from '../services/questionService';
import { Icons } from './Icons';
import { updateSessionLocal, clearSessionLocal } from '../services/progressService';

interface QuizProps {
  courseId: string;
  year: number;
  mode: QuizMode;
  part?: number;
  onComplete: (score: number, passed: boolean) => void;
  onExit: () => void;
  onProgressUpdate: (newProgress: UserProgress) => void;
  progress: UserProgress;
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const Quiz: React.FC<QuizProps> = ({ courseId, year, mode, part, onComplete, onExit, onProgressUpdate, progress }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Navigation & Review Features
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Practice and Daily Challenge show immediate feedback. Exam does not.
  const showFeedback = mode === QuizMode.PRACTICE || mode === QuizMode.DAILY_CHALLENGE;
  const sessionKey = `${courseId}-${year}-${mode}-${part || 'full'}`;

  // Confetti Animation Logic
  useEffect(() => {
    if (showConfetti && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const particles: any[] = [];
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

        for (let i = 0; i < 200; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                vx: Math.random() * 4 - 2,
                vy: Math.random() * 4 + 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: Math.random() * 5 + 2
            });
        }

        const animate = () => {
            if (!ctx) return;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let active = false;
            particles.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.y < canvas.height) active = true;
                
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });
            if (active && showConfetti) requestAnimationFrame(animate);
        };
        animate();
        
        const timeout = setTimeout(() => setShowConfetti(false), 5000);
        return () => clearTimeout(timeout);
    }
  }, [showConfetti]);

  // Initialize Quiz
  useEffect(() => {
    const initQuiz = async () => {
      setLoading(true);
      setError(null);

      // Only load saved session if it's not a daily challenge (challenges are one-shot)
      const saved = mode !== QuizMode.DAILY_CHALLENGE ? progress.savedSessions[sessionKey] : null;
      
      if (saved) {
        setQuestions(saved.questions);
        setAnswers(saved.answers);
        setCurrentQuestionIndex(saved.currentQuestionIndex);
        setTimeLeft(saved.timeLeft);
        setLoading(false);
      } else {
        try {
          let fetchedQuestions: Question[] = [];

          if (mode === QuizMode.DAILY_CHALLENGE) {
            fetchedQuestions = await fetchDailyChallengeQuestions(courseId);
          } else {
            fetchedQuestions = await fetchQuestions(courseId, year, mode, part);
          }

          if (fetchedQuestions.length === 0) {
            setError("No questions found for this selection. Please contact the administrator.");
          } else {
            setQuestions(fetchedQuestions);
            // Default time: 1 min per question for Practice/Daily, or custom logic
            const timePerQuestion = 60; 
            setTimeLeft(fetchedQuestions.length * timePerQuestion);
          }
        } catch (err) {
          console.error("Failed to load quiz", err);
          setError("Failed to load questions. Please check your connection.");
        } finally {
          setLoading(false);
        }
      }
    };
    
    initQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Timer Logic
  useEffect(() => {
    if (loading || isSubmitted || questions.length === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isSubmitted, questions.length]);

  // Save Progress (Only for Practice/Exam, not Daily Challenge session persistence for now)
  useEffect(() => {
    if (!loading && questions.length > 0 && !isSubmitted && mode !== QuizMode.DAILY_CHALLENGE) {
      const session = {
        currentQuestionIndex,
        answers,
        timeLeft,
        questions
      };
      const updatedProgress = updateSessionLocal(sessionKey, session, progress);
      onProgressUpdate(updatedProgress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestionIndex, answers, isSubmitted]);

  const handleAnswerSelect = (optionIndex: number) => {
    if (isSubmitted) return;
    if (showFeedback && answers[currentQuestionIndex] !== undefined) return;

    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionIndex
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };
  
  const toggleFlag = () => {
      const newFlagged = new Set(flagged);
      if (newFlagged.has(currentQuestionIndex)) {
          newFlagged.delete(currentQuestionIndex);
      } else {
          newFlagged.add(currentQuestionIndex);
      }
      setFlagged(newFlagged);
  };

  const jumpToQuestion = (index: number) => {
      setCurrentQuestionIndex(index);
      setIsMapOpen(false);
  };

  const handleSubmit = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsSubmitted(true);
    
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (answers[idx] === q.correctAnswerIndex) {
        correctCount++;
      }
    });

    const total = questions.length;
    const scorePercentage = total > 0 ? (correctCount / total) * 100 : 0;
    const passed = scorePercentage >= PASSING_SCORE;

    if (mode !== QuizMode.DAILY_CHALLENGE) {
        const updatedProgress = clearSessionLocal(sessionKey, progress);
        onProgressUpdate(updatedProgress);
    }
    
    // Always show confetti on passing > 50%
    if (passed) setShowConfetti(true);

    onComplete(scorePercentage, passed);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Preparing your quiz...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-center p-6">
        <Icons.XCircle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Oops!</h3>
        <p className="text-gray-600 mb-6">{error}</p>
        <button onClick={onExit} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
          Go Back
        </button>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const isAnswered = answers[currentQuestionIndex] !== undefined;
  const isFlagged = flagged.has(currentQuestionIndex);
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-4xl mx-auto relative">
      {showConfetti && <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-50" />}
      
      {/* Question Map Overlay */}
      {isMapOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex justify-end animate-fade-in" onClick={() => setIsMapOpen(false)}>
              <div className="w-full max-w-sm bg-white h-full p-6 overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-6">
                      <h3 className="font-bold text-xl text-gray-800">Question Map</h3>
                      <button onClick={() => setIsMapOpen(false)} className="p-2 hover:bg-gray-100 rounded-full">
                          <Icons.X className="w-5 h-5 text-gray-500" />
                      </button>
                  </div>
                  
                  <div className="grid grid-cols-5 gap-3">
                      {questions.map((_, idx) => {
                          const statusAnswered = answers[idx] !== undefined;
                          const statusFlagged = flagged.has(idx);
                          const isCurrent = currentQuestionIndex === idx;
                          
                          let bgClass = "bg-gray-100 text-gray-600 hover:bg-gray-200";
                          if (statusFlagged) bgClass = "bg-orange-100 text-orange-600 border border-orange-200";
                          else if (statusAnswered) bgClass = "bg-blue-100 text-blue-600 border border-blue-200";
                          
                          if (isCurrent) bgClass += " ring-2 ring-blue-500 ring-offset-2";
                          
                          return (
                              <button
                                key={idx}
                                onClick={() => jumpToQuestion(idx)}
                                className={`aspect-square rounded-lg font-bold text-sm flex items-center justify-center transition-all ${bgClass}`}
                              >
                                {idx + 1}
                                {statusFlagged && <div className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full"></div>}
                              </button>
                          )
                      })}
                  </div>
                  
                  <div className="mt-8 border-t border-gray-100 pt-6 space-y-3">
                       <div className="flex items-center gap-3 text-sm text-gray-600">
                           <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div> Answered
                       </div>
                       <div className="flex items-center gap-3 text-sm text-gray-600">
                           <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200"></div> Flagged for Review
                       </div>
                       <div className="flex items-center gap-3 text-sm text-gray-600">
                           <div className="w-4 h-4 rounded bg-gray-100"></div> Unanswered
                       </div>
                  </div>
              </div>
          </div>
      )}
      
      {/* Quiz Header */}
      <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 py-3 border-b border-gray-100 mb-6 rounded-b-2xl shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-4xl mx-auto">
             <div className="flex items-center gap-4">
                <button onClick={onExit} className="text-gray-400 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg" title="Exit Exam">
                    <Icons.LogOut className="w-5 h-5" />
                </button>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase">
                            {mode === QuizMode.DAILY_CHALLENGE ? 'Daily Challenge' : `Question ${currentQuestionIndex + 1} of ${questions.length}`}
                        </span>
                        <button onClick={() => setIsMapOpen(true)} className="text-blue-500 hover:text-blue-700 text-xs font-bold flex items-center gap-1">
                            <Icons.Grid className="w-3 h-3" /> View Map
                        </button>
                    </div>
                    <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
            </div>
            
             <div className="flex items-center gap-3">
                 <button 
                    onClick={toggleFlag} 
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isFlagged ? 'bg-orange-100 text-orange-600' : 'text-gray-400 hover:bg-gray-100'}`}
                    title="Flag for later review"
                 >
                     <Icons.Flag className={`w-4 h-4 ${isFlagged ? 'fill-current' : ''}`} />
                     <span className="hidden md:inline">{isFlagged ? 'Flagged' : 'Flag'}</span>
                 </button>

                 <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${timeLeft < 60 ? 'bg-red-50 border-red-100 text-red-600 animate-pulse' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                    <Icons.Clock className="w-4 h-4" />
                    <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
                </div>
            </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 md:p-10 mb-24 md:mb-8 animate-fade-in relative overflow-hidden">
        {/* Background Decorative Element */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-16 -mt-16 opacity-50 pointer-events-none"></div>

        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-8 leading-relaxed relative z-10">
          {currentQuestion?.text}
        </h2>

        <div className="space-y-3 relative z-10">
          {currentQuestion?.options.map((option, idx) => {
            const isSelected = answers[currentQuestionIndex] === idx;
            const isCorrect = currentQuestion.correctAnswerIndex === idx;
            
            let buttonClass = "w-full text-left p-4 md:p-5 rounded-xl border transition-all duration-200 ease-out flex items-start gap-4 group ";
            
            if (showFeedback && isAnswered) {
              if (isSelected && isCorrect) {
                buttonClass += "border-green-500 bg-green-50/50 text-green-900";
              } else if (isSelected && !isCorrect) {
                buttonClass += "border-red-500 bg-red-50/50 text-red-900";
              } else if (!isSelected && isCorrect) {
                 buttonClass += "border-green-300 bg-white text-green-700 ring-1 ring-green-200"; 
              } else {
                buttonClass += "border-gray-100 bg-gray-50 text-gray-400";
              }
            } else {
               if (isSelected) {
                 buttonClass += "border-blue-500 bg-blue-50/50 text-blue-900 shadow-sm ring-1 ring-blue-200";
               } else {
                 buttonClass += "border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-md text-gray-700";
               }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(idx)}
                disabled={showFeedback && isAnswered}
                className={buttonClass}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                        isSelected 
                        ? (showFeedback && !isCorrect ? 'bg-red-500 text-white' : 'bg-blue-600 text-white') 
                        : 'bg-gray-100 text-gray-500 group-hover:bg-blue-200 group-hover:text-blue-700'
                    }`}>
                        {String.fromCharCode(65 + idx)}
                </div>
                <span className="font-medium text-base md:text-lg">{option}</span>
                
                <div className="ml-auto">
                    {showFeedback && isAnswered && isCorrect && (
                       <Icons.CheckCircle className="w-5 h-5 text-green-500 animate-fade-in" />
                    )}
                    {showFeedback && isAnswered && isSelected && !isCorrect && (
                       <Icons.XCircle className="w-5 h-5 text-red-500 animate-fade-in" />
                    )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 md:static md:bg-transparent md:border-0 md:p-0 z-30">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <button
              onClick={handlePrev}
              disabled={currentQuestionIndex === 0}
              className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
                currentQuestionIndex === 0 
                ? 'text-gray-300 cursor-not-allowed' 
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icons.ChevronLeft className="w-5 h-5" /> Previous
            </button>
            
            <div className="flex gap-3">
                {!isLastQuestion && mode === QuizMode.EXAM && (
                    <button
                        onClick={handleSkip}
                        className="px-6 py-3 rounded-xl font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                    >
                        Skip
                    </button>
                )}

                {!isLastQuestion ? (
                <button
                    onClick={handleNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-transform active:scale-95 flex items-center gap-2"
                >
                    Next <Icons.ChevronLeft className="w-4 h-4 rotate-180" />
                </button>
                ) : (
                <button
                    onClick={handleSubmit}
                    className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-semibold shadow-lg transition-transform active:scale-95"
                >
                    Submit {mode === QuizMode.DAILY_CHALLENGE ? 'Challenge' : 'Exam'}
                </button>
                )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default Quiz;
