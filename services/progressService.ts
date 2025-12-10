
import { UserProgress, SavedSession, Activity } from '../types';
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

// Setup listener for auto-sync when back online
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log("Device online. Attempting to sync pending progress...");
        syncPendingData();
    });
}

const syncPendingData = async () => {
    const pendingSync = localStorage.getItem(SYNC_KEY);
    if (pendingSync) {
        try {
            const parsed = JSON.parse(pendingSync);
            const { error } = await supabase
                .from('user_progress')
                .upsert({ 
                    user_id: parsed.userId, 
                    data: parsed.progress,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
            
            if (!error) {
                console.log("Sync successful. Clearing pending queue.");
                localStorage.removeItem(SYNC_KEY);
            }
        } catch (e) {
            console.error("Background sync failed", e);
        }
    }
};

export const getUserProgress = async (userId: string): Promise<UserProgress> => {
  try {
    // Attempt sync first if online
    if (navigator.onLine) {
        await syncPendingData();
    }

    // 1. Try Local Storage (Fastest)
    const local = localStorage.getItem(`${LOCAL_PROGRESS_KEY}_${userId}`);
    
    // 2. Fetch from Supabase
    if (navigator.onLine) {
        const { data, error } = await supabase
          .from('user_progress')
          .select('data')
          .eq('user_id', userId)
          .single();

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
          
          // Update local backup with fresh data
          localStorage.setItem(`${LOCAL_PROGRESS_KEY}_${userId}`, JSON.stringify(merged));
          return merged;
        }
    }

    // 3. Fallback to Local if offline or DB empty/error
    if (local) {
        console.log("Loading progress from local cache.");
        return JSON.parse(local);
    }

    return initialProgress;
  } catch (err) {
    console.error('Unexpected error fetching progress:', err);
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
    if (!navigator.onLine) return; // Skip if offline
    
    try {
        if (newActivity) {
            await supabase.from('activity_log').insert({
                user_id: userId,
                username: username,
                activity_type: newActivity.type,
                xp_gained: newActivity.xp
            });
        }

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
        console.warn("Could not sync leaderboard stats.", e);
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
  // 1. Update local backup immediately (synchronous UI update)
  localStorage.setItem(`${LOCAL_PROGRESS_KEY}_${userId}`, JSON.stringify(progress));

  // 2. Try Remote Save
  if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('user_progress')
          .upsert({ 
            user_id: userId, 
            data: progress,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (!error) {
            // Remove pending sync if successful
            const pending = localStorage.getItem(SYNC_KEY);
            if (pending) {
                const p = JSON.parse(pending);
                if (p.userId === userId) localStorage.removeItem(SYNC_KEY);
            }
            return;
        }
      } catch (err) {
          console.warn('Network error saving progress.');
      }
  }

  // 3. Queue for later if offline or error
  console.log('Queuing progress for sync...');
  localStorage.setItem(SYNC_KEY, JSON.stringify({
      userId,
      progress,
      timestamp: Date.now()
  }));
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
