
import { UserProgress, SavedSession } from '../types';
import { supabase } from './supabaseClient';

export const initialProgress: UserProgress = {
  unlockedYears: [2015],
  unlockedPracticeParts: { 2015: 1 },
  completedExams: [],
  practiceScores: {},
  savedSessions: {},
  streak: 0,
  lastLoginDate: new Date().toISOString(),
  totalXp: 0
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
      const progress = data.data as UserProgress;
      
      // Calculate Streak on Load
      const lastLogin = new Date(progress.lastLoginDate || new Date().toISOString());
      const today = new Date();
      const diffTime = Math.abs(today.getTime() - lastLogin.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let newStreak = progress.streak || 0;
      
      // If same day, keep streak. If 1 day diff, increment. If >1 day, reset.
      // Logic handled in updateStreak function below, but we verify here for display
      
      return {
          ...progress,
          // Ensure new fields exist if migrating old data
          streak: progress.streak || 0,
          totalXp: progress.totalXp || 0
      };
    }

    return initialProgress;
  } catch (err) {
    console.error('Unexpected error fetching progress:', err);
    return initialProgress;
  }
};

export const updateStreak = (progress: UserProgress): UserProgress => {
    const today = new Date();
    const lastLogin = new Date(progress.lastLoginDate);
    
    // Reset hours to compare just dates
    today.setHours(0,0,0,0);
    lastLogin.setHours(0,0,0,0);
    
    const diffTime = Math.abs(today.getTime() - lastLogin.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let newStreak = progress.streak;

    if (diffDays === 1) {
        newStreak += 1; // Consecutive day
    } else if (diffDays > 1) {
        newStreak = 1; // Broken streak, restart (1 because it's today)
    } else if (progress.streak === 0) {
        newStreak = 1; // First day
    }
    // If diffDays === 0, same day, do nothing to streak

    return {
        ...progress,
        streak: newStreak,
        lastLoginDate: new Date().toISOString()
    };
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
