
import { UserProgress, SavedSession, Activity, LeaderboardEntry } from '../types';
import { supabase } from './supabaseClient';

export const initialProgress: UserProgress = {
  unlockedYears: [2015],
  unlockedPracticeParts: { 2015: 1 },
  completedExams: [],
  practiceScores: {},
  savedSessions: {},
  streak: 0,
  lastLoginDate: new Date().toISOString(),
  totalXp: 0,
  recentActivities: [],
  dailyChallengeLastCompleted: null,
  department: 'General',
  highestExamScore: 0,
  fastestExamTime: 99999
};

const SYNC_KEY = 'ace_progress_sync_pending';
const LOCAL_PROGRESS_KEY = 'ace_user_progress_local';

export const getUserProgress = async (userId: string): Promise<UserProgress> => {
  try {
    // 1. Check for Pending Sync
    const pendingSync = localStorage.getItem(SYNC_KEY);
    if (pendingSync) {
        console.log("Found pending progress sync, attempting to upload...");
        try {
            const parsed = JSON.parse(pendingSync);
            // Only sync if it matches current user
            if (parsed.userId === userId) {
                const { error } = await supabase
                    .from('user_progress')
                    .upsert({ 
                        user_id: userId, 
                        data: parsed.progress,
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });
                
                if (!error) {
                    console.log("Sync successful, clearing pending state.");
                    localStorage.removeItem(SYNC_KEY);
                }
            }
        } catch (e) {
            console.error("Sync failed", e);
        }
    }

    // 2. Fetch from Supabase
    const { data, error } = await supabase
      .from('user_progress')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return initialProgress;
      // If network error, try to load from local storage
      if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
          console.warn("Network error fetching progress, falling back to local.");
          const local = localStorage.getItem(`${LOCAL_PROGRESS_KEY}_${userId}`);
          if (local) return JSON.parse(local);
      }
      return initialProgress;
    }

    if (data) {
      const progress = data.data as UserProgress;
      const merged = {
          ...initialProgress,
          ...progress,
          streak: progress.streak || 0,
          totalXp: progress.totalXp || 0,
          recentActivities: progress.recentActivities || [],
          dailyChallengeLastCompleted: progress.dailyChallengeLastCompleted || null,
          department: progress.department || 'General',
          highestExamScore: progress.highestExamScore || 0,
          fastestExamTime: progress.fastestExamTime || 99999
      };
      
      // Update local backup
      localStorage.setItem(`${LOCAL_PROGRESS_KEY}_${userId}`, JSON.stringify(merged));
      return merged;
    }

    return initialProgress;
  } catch (err) {
    console.error('Unexpected error fetching progress:', err);
    // Fallback
    const local = localStorage.getItem(`${LOCAL_PROGRESS_KEY}_${userId}`);
    if (local) return JSON.parse(local);
    return initialProgress;
  }
};

export const updateStreak = (progress: UserProgress): UserProgress => {
    const today = new Date();
    const lastLogin = new Date(progress.lastLoginDate);
    
    // Reset hours to compare just dates
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
    
    const diffTime = Math.abs(todayDate.getTime() - lastLoginDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    let newStreak = progress.streak;

    if (diffDays === 1) {
        newStreak += 1; // Consecutive day
    } else if (diffDays > 1) {
        newStreak = 1; // Broken streak, restart
    } else if (progress.streak === 0) {
        newStreak = 1;
    }

    return {
        ...progress,
        streak: newStreak,
        lastLoginDate: new Date().toISOString()
    };
};

export const logActivity = (
    progress: UserProgress, 
    type: Activity['type'], 
    description: string, 
    xp: number
): UserProgress => {
    const newActivity: Activity = {
        id: Date.now().toString(),
        type,
        description,
        timestamp: new Date().toISOString(),
        xpGained: xp
    };

    const updatedActivities = [newActivity, ...progress.recentActivities].slice(0, 20);

    return {
        ...progress,
        recentActivities: updatedActivities,
        totalXp: (progress.totalXp || 0) + xp
    };
};

export const syncLeaderboardStats = async (
    userId: string,
    username: string,
    progress: UserProgress,
    newActivity?: { type: string; xp: number }
) => {
    try {
        // 1. Insert Activity Log
        if (newActivity) {
            await supabase.from('activity_log').insert({
                user_id: userId,
                username: username,
                activity_type: newActivity.type,
                xp_gained: newActivity.xp
            });
        }

        // 2. Upsert Leaderboard Stats
        const totalPracticeParts = Object.values(progress.unlockedPracticeParts).reduce((a, b) => a + (b - 1), 0);

        const { error } = await supabase.from('leaderboard').upsert({
            user_id: userId,
            username: username,
            department: progress.department || 'General',
            total_xp: progress.totalXp,
            highest_score: progress.highestExamScore || 0,
            fastest_exam_time: progress.fastestExamTime || 99999,
            practice_parts_completed: totalPracticeParts,
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (error) console.error("Failed to sync leaderboard:", error);
    } catch (e) {
        console.warn("Offline: Could not sync leaderboard stats.");
    }
};

export const isDailyChallengeAvailable = (progress: UserProgress): boolean => {
    if (!progress.dailyChallengeLastCompleted) return true;
    
    const lastCompleted = new Date(progress.dailyChallengeLastCompleted);
    const today = new Date();
    
    return lastCompleted.getDate() !== today.getDate() || 
           lastCompleted.getMonth() !== today.getMonth() || 
           lastCompleted.getFullYear() !== today.getFullYear();
};

export const saveUserProgress = async (userId: string, progress: UserProgress) => {
  // Always update local backup immediately for UI responsiveness
  localStorage.setItem(`${LOCAL_PROGRESS_KEY}_${userId}`, JSON.stringify(progress));

  try {
    const { error } = await supabase
      .from('user_progress')
      .upsert({ 
        user_id: userId, 
        data: progress,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
        console.warn('Error saving progress remotely:', error);
        throw error;
    } else {
        // If save success, remove any pending sync
        const pending = localStorage.getItem(SYNC_KEY);
        if (pending) {
            const p = JSON.parse(pending);
            if (p.userId === userId) localStorage.removeItem(SYNC_KEY);
        }
    }
  } catch (err) {
    console.error('Offline or Error: Saving progress locally for later sync.');
    localStorage.setItem(SYNC_KEY, JSON.stringify({
        userId,
        progress,
        timestamp: Date.now()
    }));
  }
};

export const resetUserProgress = async (userId: string): Promise<void> => {
    await saveUserProgress(userId, initialProgress);
};

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
