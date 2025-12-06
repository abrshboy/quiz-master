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
  RESULT = 'RESULT'
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
}

export interface SavedSession {
  currentQuestionIndex: number;
  answers: Record<number, number>; // questionIndex -> answerIndex
  timeLeft: number;
  questions: Question[];
}

export interface User {
  username: string;
  email: string;
}

export const COURSES = [
  { id: CourseId.MANAGEMENT, title: 'Management', icon: 'Briefcase', active: true },
  { id: CourseId.MARKETING, title: 'Marketing', icon: 'Megaphone', active: false },
  { id: CourseId.ACCOUNTING, title: 'Accounting', icon: 'Calculator', active: false },
  { id: CourseId.CS, title: 'Computer Science', icon: 'Cpu', active: false },
  { id: CourseId.ARCHITECTURE, title: 'Architecture', icon: 'Ruler', active: false },
];

export const YEARS = [2015, 2016, 2017, 2018];
export const PRACTICE_PARTS_COUNT = 10;
export const PRACTICE_QUESTIONS_PER_PART = 10;
export const EXAM_QUESTIONS_COUNT = 100; // In a real scenario, fetching 100 takes time, but we simulate logic.
export const PASSING_SCORE = 51;