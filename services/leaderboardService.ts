
import { supabase } from './supabaseClient';
import { LeaderboardEntry } from '../types';

export const fetchOverallLeaderboard = async (limit = 20): Promise<LeaderboardEntry[]> => {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_xp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching overall leaderboard:', error);
    return [];
  }
  return data as LeaderboardEntry[];
};

export const fetchDepartmentLeaderboard = async (department: string, limit = 20): Promise<LeaderboardEntry[]> => {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .eq('department', department)
    .order('total_xp', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching department leaderboard:', error);
    return [];
  }
  return data as LeaderboardEntry[];
};

export const fetchSpeedLeaderboard = async (limit = 20): Promise<LeaderboardEntry[]> => {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('fastest_exam_time', { ascending: true })
    .neq('fastest_exam_time', 99999) // Filter out default values
    .limit(limit);

  if (error) {
    console.error('Error fetching speed leaderboard:', error);
    return [];
  }
  return data as LeaderboardEntry[];
};

// Sync basic profile data to leaderboard table
export const syncLeaderboardProfile = async (userId: string, username: string, department: string = 'General') => {
  const { error } = await supabase
    .from('leaderboard')
    .upsert(
      { user_id: userId, username, department },
      { onConflict: 'user_id' }
    );
  
  if (error) {
    console.error('Error syncing profile to leaderboard:', error);
  }
};
