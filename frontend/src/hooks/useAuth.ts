import { createContext, useContext } from 'react';
import { User } from '../api/client';

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  showConsentModal: boolean;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
  acceptConsent: () => Promise<void>;
  switchDemoRole: (role: string) => void;
  closeConsentModal: () => void;
}

export const DEMO_USERS: Record<string, User> = {
  CLASS_TEACHER: {
    id: 'usr-teacher-sharma',
    username: 'teacher_sharma',
    name: 'Dr. Sharma',
    role: 'CLASS_TEACHER',
    department: 'Computer Science',
    section_ids: ['sec-cs3b'],
    consent_accepted: true,
  },
  SUBJECT_TEACHER: {
    id: 'usr-sub-verma',
    username: 'prof_verma',
    name: 'Prof. Verma',
    role: 'SUBJECT_TEACHER',
    department: 'Physics',
    section_ids: ['sec-cs3b', 'sec-cs3c'],
    consent_accepted: true,
  },
  HOD: {
    id: 'usr-hod-gupta',
    username: 'hod_gupta',
    name: 'Prof. Gupta (HOD)',
    role: 'HOD',
    department: 'Computer Science',
    section_ids: ['sec-cs3a', 'sec-cs3b', 'sec-cs3c'],
    consent_accepted: true,
  },
  COUNSELOR: {
    id: 'usr-counselor-nair',
    username: 'counselor_nair',
    name: 'Dr. Nair (Counselor)',
    role: 'COUNSELOR',
    department: 'Student Affairs',
    consent_accepted: true,
  },
  ADMIN: {
    id: 'usr-admin-dean',
    username: 'dean_academic',
    name: 'Dean Academic',
    role: 'ADMIN',
    department: 'Administration',
    consent_accepted: true,
  },
  STUDENT: {
    id: 'usr-stu-rohan',
    username: 'rohan_sharma',
    name: 'Rohan Sharma',
    role: 'STUDENT',
    department: 'Computer Science',
    section_ids: ['sec-cs3b'],
    consent_accepted: true,
  },
};

export const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
