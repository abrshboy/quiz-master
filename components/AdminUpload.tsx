import React, { useState } from 'react';
import { COURSES, YEARS, QuizMode, PRACTICE_PARTS_COUNT, Question } from '../types';
import { uploadQuestions } from '../services/questionService';
import { Icons } from './Icons';

interface AdminUploadProps {
  onBack: () => void;
}

export const AdminUpload: React.FC<AdminUploadProps> = ({ onBack }) => {
  const [course, setCourse] = useState(COURSES[0].id);
  const [year, setYear] = useState(YEARS[0]);
  const [mode, setMode] = useState<QuizMode>(QuizMode.PRACTICE);
  const [part, setPart] = useState(1);
  const [jsonInput, setJsonInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const parsedQuestions = JSON.parse(jsonInput);
      
      if (!Array.isArray(parsedQuestions)) {
        throw new Error("Input must be a JSON array of questions.");
      }

      // Basic validation
      parsedQuestions.forEach((q, i) => {
        if (!q.text || !Array.isArray(q.options) || q.correctAnswerIndex === undefined) {
          throw new Error(`Question at index ${i} is missing required fields (text, options, correctAnswerIndex).`);
        }
      });

      // Augment with IDs if missing
      const processedQuestions: Question[] = parsedQuestions.map((q, i) => ({
        ...q,
        id: q.id || `uploaded-${Date.now()}-${i}`
      }));

      await uploadQuestions(course, year, mode, mode === QuizMode.PRACTICE ? part : undefined, processedQuestions);
      
      setStatus('success');
      setMessage(`Successfully uploaded ${processedQuestions.length} questions!`);
      setJsonInput(''); // Clear input on success
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setMessage(err.message || "Failed to upload questions.");
    }
  };

  const exampleJson = `[
  {
    "text": "What is the capital of France?",
    "options": ["London", "Berlin", "Paris", "Madrid"],
    "correctAnswerIndex": 2
  },
  {
    "text": "Which year did World War II end?",
    "options": ["1942", "1945", "1948", "1950"],
    "correctAnswerIndex": 1
  }
]`;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-lg border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Admin Question Upload</h2>
        <button onClick={onBack} className="text-gray-500 hover:text-gray-800 flex items-center gap-1">
          <Icons.LogOut className="w-4 h-4 rotate-180" /> Back to Dashboard
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Course</label>
          <select 
            value={course} 
            onChange={(e) => setCourse(e.target.value)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {COURSES.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select 
            value={year} 
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value as QuizMode)}
            className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value={QuizMode.PRACTICE}>Practice</option>
            <option value={QuizMode.EXAM}>Exam</option>
          </select>
        </div>

        {mode === QuizMode.PRACTICE && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Part</label>
            <select 
              value={part} 
              onChange={(e) => setPart(Number(e.target.value))}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Array.from({ length: PRACTICE_PARTS_COUNT }).map((_, i) => (
                <option key={i + 1} value={i + 1}>Part {i + 1}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          JSON Question Array 
          <span className="text-gray-400 font-normal ml-2">(Paste JSON below)</span>
        </label>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder={exampleJson}
          className="w-full h-64 p-4 font-mono text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50"
        />
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={status === 'loading' || !jsonInput.trim()}
        className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg ${
          status === 'loading' 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1'
        }`}
      >
        {status === 'loading' ? 'Uploading...' : 'Upload Questions'}
      </button>
    </div>
  );
};
