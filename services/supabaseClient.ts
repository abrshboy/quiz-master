import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://blwkdwqpvmylbxwkfwxg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsd2tkd3Fwdm15bGJ4d2tmd3hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ5NTEzNzUsImV4cCI6MjA4MDUyNzM3NX0.V1CkibxCq6rzRweVDawiSqMnn0ot_cP8Gb5kgeZDgb0';

export const supabase = createClient(supabaseUrl, supabaseKey);