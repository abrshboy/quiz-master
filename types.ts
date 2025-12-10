
export enum CourseId {
  MANAGEMENT = 'management',
  MARKETING = 'marketing',
  ACCOUNTING = 'accounting',
  CS = 'cs',
  ARCHITECTURE = 'architecture'
}

export enum ViewState {
  AUTH = 'AUTH',
  DASHBOARD = 'DASHBOARD',
  YEAR_SELECT = 'YEAR_SELECT',
  MODE_SELECT = 'MODE_SELECT',
  PRACTICE_LIST = 'PRACTICE_LIST',
  QUIZ = 'QUIZ',
  RESULT = 'RESULT',
  ADMIN = 'ADMIN',
  PROFILE = 'PROFILE'
}

export enum QuizMode {
  PRACTICE = 'practice',
  EXAM = 'exam'
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number; // 0-3
}

export interface UserProgress {
  unlockedYears: number[]; // e.g. [2015, 2016]
  unlockedPracticeParts: Record<number, number>; // Year -> MaxUnlockedPart (1-10)
  completedExams: number[]; // Years where exam is passed
  practiceScores: Record<string, number>; // key: "year-part", value: score
  savedSessions: Record<string, SavedSession>; // key: "year-mode-part"
  
  // New Gamification Fields
  streak: number;
  lastLoginDate: string; // ISO Date string
  totalXp: number; // Experience points based on correct answers
}

export interface SavedSession {
  currentQuestionIndex: number;
  answers: Record<number, number>; // questionIndex -> answerIndex
  timeLeft: number;
  questions: Question[];
}

export interface User {
  id: string;
  username: string; // This is the Display Name
  email: string;
}

export const COURSES = [
  { id: CourseId.MANAGEMENT, title: 'Management', icon: 'Briefcase', active: true, color: 'text-blue-600 bg-blue-100' },
  { id: CourseId.MARKETING, title: 'Marketing', icon: 'Megaphone', active: false, color: 'text-pink-600 bg-pink-100' },
  { id: CourseId.ACCOUNTING, title: 'Accounting', icon: 'Calculator', active: false, color: 'text-emerald-600 bg-emerald-100' },
  { id: CourseId.CS, title: 'Computer Science', icon: 'Cpu', active: false, color: 'text-purple-600 bg-purple-100' },
  { id: CourseId.ARCHITECTURE, title: 'Architecture', icon: 'Ruler', active: false, color: 'text-orange-600 bg-orange-100' },
];

export const YEARS = [2015, 2016, 2017, 2018];
export const PRACTICE_PARTS_COUNT = 10;
export const PRACTICE_QUESTIONS_PER_PART = 10;
export const EXAM_QUESTIONS_COUNT = 100; 
export const PASSING_SCORE = 51;
