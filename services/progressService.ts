import { UserProgress, SavedSession } from '../types';
import { supabase } from './supabaseClient';

export const initialProgress: UserProgress = {
  unlockedYears: [2015],
  unlockedPracticeParts: { 2015: 1 },
  completedExams: [],
  practiceScores: {},
  savedSessions: {}
};

export const getUserProgress = async (userId: string): Promise<UserProgress> => {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
         // No row found, return initial
         return initialProgress;
      }
      if (error.code === '42P01') {
         console.warn("Supabase table 'user_progress' not found. Please run the provided SQL script.");
      } else {
         console.error('Error fetching progress:', error);
      }
      return initialProgress;
    }

    if (data) {
      return data.data as UserProgress;
    }

    return initialProgress;
  } catch (err) {
    console.error('Unexpected error fetching progress:', err);
    return initialProgress;
  }
};

export const saveUserProgress = async (userId: string, progress: UserProgress) => {
  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert({ 
        user_id: userId, 
        data: progress,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
       if (error.code === '42P01') {
         console.error("Supabase table 'user_progress' not found. Data cannot be saved until SQL script is run.");
      } else {
         console.error('Error saving progress:', error);
      }
    }
  } catch (err) {
    console.error('Unexpected error saving progress:', err);
  }
};

export const resetUserProgress = async (userId: string): Promise<void> => {
    // Reset by saving the initial state over the existing state
    await saveUserProgress(userId, initialProgress);
};

// Helper to update local progress object for logic before saving
export const unlockNextYearLocal = (currentYear: number, progress: UserProgress): UserProgress => {
  const nextYear = currentYear + 1;
  if (!progress.unlockedYears.includes(nextYear)) {
    return {
      ...progress,
      unlockedYears: [...progress.unlockedYears, nextYear],
      unlockedPracticeParts: {
        ...progress.unlockedPracticeParts,
        [nextYear]: 1
      }
    };
  }
  return progress;
};

export const unlockNextPartLocal = (year: number, currentPart: number, progress: UserProgress): UserProgress => {
  const currentMax = progress.unlockedPracticeParts[year] || 1;
  if (currentPart >= currentMax && currentPart < 10) {
    return {
      ...progress,
      unlockedPracticeParts: {
        ...progress.unlockedPracticeParts,
        [year]: currentPart + 1
      }
    };
  }
  return progress;
};

export const updateSessionLocal = (key: string, session: SavedSession, progress: UserProgress): UserProgress => {
    return {
        ...progress,
        savedSessions: {
            ...progress.savedSessions,
            [key]: session
        }
    };
}

export const clearSessionLocal = (key: string, progress: UserProgress): UserProgress => {
    const newSessions = { ...progress.savedSessions };
    delete newSessions[key];
    return {
        ...progress,
        savedSessions: newSessions
    };
}