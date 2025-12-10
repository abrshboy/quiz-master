import React, { useState, useEffect, useRef } from 'react';
import { QuizMode, Question, UserProgress, PASSING_SCORE } from '../types';
import { fetchQuestions } from '../services/questionService';
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
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  const showFeedback = mode === QuizMode.PRACTICE;
  const sessionKey = `${courseId}-${year}-${mode}-${part || 'full'}`;

  // Initialize Quiz
  useEffect(() => {
    const initQuiz = async () => {
      setLoading(true);
      setError(null);

      const saved = progress.savedSessions[sessionKey];
      
      if (saved) {
        setQuestions(saved.questions);
        setAnswers(saved.answers);
        setCurrentQuestionIndex(saved.currentQuestionIndex);
        setTimeLeft(saved.timeLeft);
        setLoading(false);
      } else {
        try {
          const fetchedQuestions = await fetchQuestions(
            courseId, 
            year, 
            mode, 
            part
          );

          if (fetchedQuestions.length === 0) {
            setError("No questions found for this selection. Please contact the administrator.");
          } else {
            setQuestions(fetchedQuestions);
            // Default time: 1 min per question for Practice, or custom logic
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

  // Save Progress
  useEffect(() => {
    if (!loading && questions.length > 0 && !isSubmitted) {
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

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
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

    const updatedProgress = clearSessionLocal(sessionKey, progress);
    onProgressUpdate(updatedProgress);

    onComplete(scorePercentage, passed);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-gray-500 font-medium">Loading Questions...</p>
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
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md shadow-gray-200/50 p-5 mb-6 sticky top-4 z-20 border border-gray-100 backdrop-blur-md bg-opacity-95">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-4">
            <button onClick={onExit} className="text-gray-500 hover:text-red-500 transition-colors flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-red-50">
              <Icons.LogOut className="w-4 h-4" /> Exit
            </button>
            <div className="h-6 w-px bg-gray-200"></div>
            <span className="text-gray-700 font-semibold text-sm tracking-wide">
              QUESTION <span className="text-blue-600 text-base ml-1">{currentQuestionIndex + 1}</span> / {questions.length}
            </span>
          </div>
          
          <div className={`flex items-center space-x-2 px-4 py-1.5 rounded-full border ${timeLeft < 60 ? 'bg-red-50 border-red-100 text-red-600 animate-pulse' : 'bg-blue-50 border-blue-100 text-blue-600'}`}>
            <Icons.Clock className="w-4 h-4" />
            <span className="font-mono font-bold text-lg">{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner border border-gray-200">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)] relative" 
            style={{ width: `${progressPercent}%` }}
          >
              <div className="absolute top-0 right-0 bottom-0 w-full bg-white opacity-10 animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 mb-6 border border-gray-100 transition-all duration-300">
        <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-8 leading-relaxed">
          {currentQuestion?.text}
        </h2>

        <div className="space-y-4">
          {currentQuestion?.options.map((option, idx) => {
            const isSelected = answers[currentQuestionIndex] === idx;
            const isCorrect = currentQuestion.correctAnswerIndex === idx;
            
            let buttonClass = "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ease-out flex justify-between items-center group relative overflow-hidden ";
            
            if (showFeedback && isAnswered) {
              if (isSelected && isCorrect) {
                buttonClass += "border-green-500 bg-green-50 text-green-900 shadow-sm";
              } else if (isSelected && !isCorrect) {
                buttonClass += "border-red-500 bg-red-50 text-red-900 shadow-sm";
              } else if (!isSelected && isCorrect) {
                 buttonClass += "border-green-200 bg-white text-green-700 opacity-90"; 
              } else {
                buttonClass += "border-gray-100 bg-gray-50 text-gray-400 opacity-50";
              }
            } else {
               // Normal Interactive State with Hover
               if (isSelected) {
                 buttonClass += "border-blue-500 bg-blue-50 text-blue-800 shadow-md scale-[1.005] z-10";
               } else {
                 buttonClass += "border-gray-100 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-lg hover:-translate-y-0.5 text-gray-700";
               }
            }

            return (
              <button
                key={idx}
                onClick={() => handleAnswerSelect(idx)}
                disabled={showFeedback && isAnswered}
                className={buttonClass}
              >
                <div className="flex items-center gap-4 z-10 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                        isSelected 
                        ? (showFeedback && !isCorrect ? 'border-red-500 bg-red-500 text-white' : 'border-blue-500 bg-blue-500 text-white') 
                        : 'border-gray-200 text-gray-400 bg-gray-50 group-hover:border-blue-400 group-hover:text-blue-500 group-hover:bg-white'
                    }`}>
                        {String.fromCharCode(65 + idx)}
                    </div>
                    <span className="font-medium text-lg">{option}</span>
                </div>
                
                {showFeedback && isAnswered && isCorrect && (
                   <Icons.CheckCircle className="w-6 h-6 text-green-500 animate-fade-in" />
                )}
                {showFeedback && isAnswered && isSelected && !isCorrect && (
                   <Icons.XCircle className="w-6 h-6 text-red-500 animate-fade-in" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrev}
          disabled={currentQuestionIndex === 0}
          className={`px-6 py-3 rounded-xl font-medium flex items-center transition-all duration-200 ${
            currentQuestionIndex === 0 
            ? 'text-gray-300 cursor-not-allowed bg-gray-50' 
            : 'bg-white text-gray-700 hover:bg-gray-50 hover:shadow-md border border-gray-200 hover:-translate-y-0.5'
          }`}
        >
          Previous
        </button>

        {!isLastQuestion ? (
          <button
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0"
          >
            Next Question
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-green-200 transition-all duration-200 transform hover:-translate-y-1 active:translate-y-0"
          >
            Submit Exam
          </button>
        )}
      </div>
    </div>
  );
};

export default Quiz;
