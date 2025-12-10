
import { supabase } from './supabaseClient';
import { DEPARTMENTS } from '../types';

export interface AdminStats {
  totalUsers: number;
  totalQuestions: number;
  totalDepartments: number;
  recentAttempts: number;
  mostActiveDepartment: string;
  recentActivity: any[];
}

export const fetchAdminStats = async (): Promise<AdminStats> => {
  try {
    // 1. Total Users (Count rows in leaderboard as proxy for active users)
    const { count: userCount, error: userError } = await supabase
      .from('leaderboard')
      .select('*', { count: 'exact', head: true });
    
    // 2. Total Questions
    const { count: questionCount, error: qError } = await supabase
      .from('questions')
      .select('*', { count: 'exact', head: true });

    // 3. Recent Attempts (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { count: attemptsCount, error: aError } = await supabase
      .from('activity_log')
      .select('*', { count: 'exact', head: true })
      .gt('created_at', sevenDaysAgo.toISOString());

    // 4. Recent Activity Feed
    const { data: recentActivity, error: raError } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. Most Active Department (Calculated from Leaderboard distribution)
    // Since we can't easily group-by with simple client, we fetch department column and aggregate locally
    // Limit to 1000 for performance, which gives a good enough sample
    const { data: deptData, error: dError } = await supabase
        .from('leaderboard')
        .select('department')
        .limit(1000);

    let mostActiveDept = 'General';
    if (deptData) {
        const counts: Record<string, number> = {};
        deptData.forEach((row: any) => {
            const d = row.department || 'General';
            counts[d] = (counts[d] || 0) + 1;
        });
        
        let maxCount = 0;
        Object.entries(counts).forEach(([dept, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostActiveDept = dept;
            }
        });
    }

    if (userError || qError || aError || raError || dError) {
      console.error("Partial error fetching admin stats");
    }

    return {
      totalUsers: userCount || 0,
      totalQuestions: questionCount || 0,
      totalDepartments: DEPARTMENTS.length,
      recentAttempts: attemptsCount || 0,
      mostActiveDepartment: mostActiveDept,
      recentActivity: recentActivity || []
    };

  } catch (err) {
    console.error("Error in admin service:", err);
    return {
      totalUsers: 0,
      totalQuestions: 0,
      totalDepartments: DEPARTMENTS.length,
      recentAttempts: 0,
      mostActiveDepartment: 'General',
      recentActivity: []
    };
  }
};
