// This file is deprecated. Please use services/progressService.ts
import { UserProgress } from '../types';

export const loadProgress = (): UserProgress => {
    return {} as UserProgress;
};

export const saveProgress = (progress: UserProgress) => {
    // No-op
};
