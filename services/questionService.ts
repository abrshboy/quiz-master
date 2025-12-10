
import { supabase } from './supabaseClient';
import { Question, QuizMode } from '../types';

const CACHE_PREFIX = 'ace_questions_';
const CACHE_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 Days

const getCacheKey = (courseId: string, year: number, mode: QuizMode, part?: number) => {
  return `${CACHE_PREFIX}${courseId}_${year}_${mode}_${part || 'all'}`;
};

export const fetchQuestions = async (
  courseId: string,
  year: number,
  mode: QuizMode,
  part?: number
): Promise<Question[]> => {
  const cacheKey = getCacheKey(courseId, year, mode, part);
  const isOffline = !navigator.onLine;

  // 1. FAST PATH: Check Cache
  try {
    const cachedRaw = localStorage.getItem(cacheKey);
    if (cachedRaw) {
      const { data, timestamp } = JSON.parse(cachedRaw);
      
      // If offline, return cache immediately regardless of expiry
      if (isOffline) {
        console.log(`[Offline] Serving cached questions for ${cacheKey}`);
        return data as Question[];
      }

      // If online, check expiry (Speed Optimization)
      if (Date.now() - timestamp < CACHE_EXPIRY_MS) {
        console.log(`[Cache Hit] Serving questions for ${cacheKey}`);
        return data as Question[];
      }
    }
  } catch (e) {
    console.warn("Error reading from cache", e);
  }

  // If we are offline but cache was missed/error, we can't do anything
  if (isOffline) {
      console.warn("Offline and no cache available.");
      return [];
  }

  // 2. NETWORK PATH: Fetch from Supabase
  try {
    let query = supabase
      .from('questions')
      .select('content')
      .eq('course_id', courseId)
      .eq('year', year)
      .eq('mode', mode);

    if (mode === QuizMode.PRACTICE && part) {
      query = query.eq('part', part);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (!data || data.length === 0) {
      return [];
    }

    // Unpack the JSONB content field
    const questions = data.map((row: any) => row.content as Question);

    // 3. Update Cache
    try {
      localStorage.setItem(cacheKey, JSON.stringify({
        timestamp: Date.now(),
        data: questions
      }));
    } catch (cacheErr) {
      console.warn("Failed to save to local cache (quota exceeded?)", cacheErr);
    }

    return questions;

  } catch (err) {
    console.error('Network request failed, trying fallback cache...', err);
    
    // 4. Fallback: Try to load even expired cache if network failed
    try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
            const { data } = JSON.parse(cachedRaw);
            return data as Question[];
        }
    } catch (e) { /* ignore */ }

    return [];
  }
};

// Fetches 10 random questions from the database
export const fetchDailyChallengeQuestions = async (courseId: string): Promise<Question[]> => {
    const cacheKey = `${CACHE_PREFIX}daily_${courseId}_${new Date().toDateString()}`;

    // Check Daily Cache
    try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
             const { data } = JSON.parse(cachedRaw);
             return data;
        }
    } catch (e) { console.warn(e); }

    if (!navigator.onLine) return [];

    try {
        // Fetch a broad set of questions
        const { data, error } = await supabase
            .from('questions')
            .select('content')
            .eq('course_id', courseId)
            .limit(50); 

        if (error) throw error;
        
        if (!data || data.length === 0) return [];

        const allQuestions = data.map((row: any) => row.content as Question);
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        const result = shuffled.slice(0, 10);

        localStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: result
        }));

        return result;
    } catch (err) {
        console.error("Error fetching daily challenge:", err);
         const fallbackKey = Object.keys(localStorage).find(k => k.startsWith(`${CACHE_PREFIX}${courseId}`));
         if (fallbackKey) {
             const cached = localStorage.getItem(fallbackKey);
             if (cached) {
                 const { data } = JSON.parse(cached);
                 return data.slice(0, 10);
             }
         }
        return [];
    }
}

export const uploadQuestions = async (
  courseId: string,
  year: number,
  mode: QuizMode,
  part: number | undefined,
  questions: Question[]
) => {
  const rows = questions.map((q) => ({
    course_id: courseId,
    year,
    mode,
    part: mode === QuizMode.PRACTICE ? part : null,
    content: q
  }));

  const { error } = await supabase.from('questions').insert(rows);

  if (error) {
    throw error;
  }
  
  // Invalidate cache for this section
  const cacheKey = getCacheKey(courseId, year, mode, part);
  localStorage.removeItem(cacheKey);
};
