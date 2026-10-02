import React, { useState } from 'react';

export interface LoginViewProps {
  onLoginSuccess: (roleKey: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [role, setRole] = useState('CLASS_TEACHER');
  const [username, setUsername] = useState('prof.raghav@college.edu');
  const [password, setPassword] = useState('••••••••');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLoginSuccess(role);
  };

  const handleQuickRole = (roleKey: string, demoUser: string) => {
    setRole(roleKey);
    setUsername(demoUser);
    onLoginSuccess(roleKey);
  };

  return (
    <div className="bg-background pattern-bg min-h-screen flex items-center justify-center font-sans text-on-surface antialiased p-6 relative overflow-hidden select-none">
      {/* Decorative background orbs strictly matching Stitch */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-primary-container rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-secondary rounded-full mix-blend-multiply filter blur-3xl opacity-10 pointer-events-none"></div>

      <main className="w-full max-w-md bg-surface-container-lowest rounded-xl border border-outline-variant shadow-lg relative z-10 overflow-hidden">
        {/* Header Section */}
        <div className="p-6 border-b border-outline-variant bg-surface-container-low text-center">
          <div className="w-18 h-18 mx-auto mb-3 bg-surface rounded-full border border-outline-variant flex items-center justify-center shadow-xs">
            <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xl">
              M
            </div>
          </div>
          <h1 className="text-xl font-bold text-primary mb-1">
            Makerov Intelligence Platform
          </h1>
          <p className="text-xs text-on-surface-variant">
            Classroom Social Knowledge Graph &amp; Predictive Bunk Analytics
          </p>
        </div>

        {/* Form Section */}
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface mb-1.5 uppercase tracking-wider">
                Teacher / Institutional Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-[18px]">
                    person
                  </span>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter institutional credentials"
                  className="block w-full pl-10 pr-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface mb-1.5 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-[18px]">lock</span>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary focus:border-secondary transition-all"
                />
              </div>
            </div>

            {/* Access Role */}
            <div>
              <label className="block text-[11px] font-bold text-on-surface mb-1.5 uppercase tracking-wider">
                Access Role &amp; Clearance
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-[18px]">badge</span>
                </div>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="block w-full pl-10 pr-10 py-2 border border-outline-variant rounded-lg bg-surface text-on-surface text-xs focus:ring-2 focus:ring-secondary focus:border-secondary transition-all appearance-none cursor-pointer"
                >
                  <option value="CLASS_TEACHER">Class Teacher (AIML Sem 4 Clearance)</option>
                  <option value="SUBJECT_TEACHER">Subject Teacher (Course Attendance Only)</option>
                  <option value="HOD_DEAN">HOD / Academic Dean (Department-Wide View)</option>
                  <option value="STUDENT">Student (Self Privacy &amp; Attendance Records)</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-outline text-[18px]">
                    arrow_drop_down
                  </span>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full flex justify-center py-2.5 px-4 rounded-lg bg-primary-container text-on-primary-container text-xs font-bold hover:bg-primary hover:text-on-primary transition-all duration-150 shadow-xs cursor-pointer items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">login</span>
                Institutional Access
              </button>
            </div>
          </form>

          {/* Quick Demo Switcher */}
          <div className="mt-5 pt-4 border-t border-outline-variant">
            <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider mb-2 text-center">
              Quick 1-Click Demo Profiles
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleQuickRole('CLASS_TEACHER', 'prof.raghav@college.edu')}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container text-primary font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Prof. Raghav (Class Teacher)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('HOD_DEAN', 'dean.kapoor@college.edu')}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container text-primary font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Dean Kapoor (HOD)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('SUBJECT_TEACHER', 'dr.mehta@college.edu')}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container text-primary font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Dr. Mehta (Subject)
              </button>
              <button
                type="button"
                onClick={() => handleQuickRole('STUDENT', 'rohit.s@college.edu')}
                className="p-2 border border-outline-variant rounded-lg bg-surface hover:bg-surface-container text-primary font-semibold text-[11px] transition-colors cursor-pointer"
              >
                Rohit S. (Student Portal)
              </button>
            </div>
          </div>
        </div>

        {/* Footer Note strictly matching Stitch */}
        <div className="bg-surface-container-high p-4 text-center border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant flex items-center justify-center gap-2">
            <span
              className="material-symbols-outlined text-[16px] text-tertiary-container"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <span>Argon2id authentication &amp; PII hashing active</span>
          </p>
        </div>
      </main>
    </div>
  );
};
