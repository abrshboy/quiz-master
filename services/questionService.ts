
import { supabase } from './supabaseClient';
import { Question, QuizMode } from '../types';

export const fetchQuestions = async (
  courseId: string,
  year: number,
  mode: QuizMode,
  part?: number
): Promise<Question[]> => {
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

    if (error) {
      console.error('Error fetching questions:', error);
      throw error;
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Unpack the JSONB content field
    return data.map((row: any) => row.content as Question);
  } catch (err) {
    console.error('Unexpected error:', err);
    return [];
  }
};

// Fetches 10 random questions from the database (simulated randomness via client-side shuffle for now)
export const fetchDailyChallengeQuestions = async (courseId: string): Promise<Question[]> => {
    try {
        // Fetch a broad set of questions (e.g., from a random year/mode to ensure we get data)
        // Ideally, we'd use a postgres function for random(), but client-side shuffle works for smaller datasets.
        
        // We'll fetch from year 2015 as it's guaranteed to be there initially
        const { data, error } = await supabase
            .from('questions')
            .select('content')
            .eq('course_id', courseId)
            .limit(50); // Get a pool to choose from

        if (error) throw error;
        
        if (!data || data.length === 0) return [];

        const allQuestions = data.map((row: any) => row.content as Question);
        
        // Shuffle array
        const shuffled = allQuestions.sort(() => 0.5 - Math.random());
        
        // Return first 10
        return shuffled.slice(0, 10);
    } catch (err) {
        console.error("Error fetching daily challenge:", err);
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
};
