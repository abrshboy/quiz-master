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
