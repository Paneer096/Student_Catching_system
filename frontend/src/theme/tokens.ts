/**
 * Makerove — Design Tokens
 * Adapted from Tactical Command Center design system for classroom intelligence.
 */

export const THEME = {
  colors: {
    bg: '#000000',
    surface: {
      default: '#141313',
      container: '#1c1b1b',
      low: '#121212',
      deep: '#0d0d0d',
      elevated: '#252424',
    },
    border: {
      default: '#333333',
      subtle: '#222222',
      hover: '#555555',
      active: '#00b4ff',
    },
    text: {
      primary: '#ffffff',
      secondary: '#c4c7c8',
      muted: '#777777',
      faint: '#444748',
    },
    accents: {
      cyan: '#00b4ff',      // Primary interactive, active tabs, selected states
      green: '#39ff14',     // On track, healthy, live status
      gold: '#ffd700',      // AI insights, "Keep an eye" band, caution
      orange: '#ff8c00',    // Calendar risk orange, warnings
      red: '#ff4c4c',       // "Reach out soon" band, high attention, danger
      purple: '#a855f7',    // Graph analytics, special visualization
    },
    // Makerove-specific role colors
    roles: {
      CLASS_TEACHER: '#00b4ff',
      SUBJECT_TEACHER: '#4ade80',
      HOD: '#ffd700',
      COUNSELOR: '#a855f7',
      ADMIN: '#ff4c4c',
      STUDENT: '#39ff14',
    },
    // Support priority bands
    bands: {
      on_track: '#39ff14',
      keep_an_eye: '#ffd700',
      reach_out: '#ff4c4c',
    },
    // Calendar risk bands
    risk: {
      green: '#39ff14',
      yellow: '#ffd700',
      orange: '#ff8c00',
      red: '#ff4c4c',
    },
    // Group absence event bands
    groupAbsence: {
      high_attention: '#ff4c4c',
      watch: '#ffd700',
      noted: '#777777',
    },
  },
  shadows: {
    cyanGlow: '0 0 10px rgba(0, 180, 255, 0.3)',
    cyanGlowLg: '0 0 20px rgba(0, 180, 255, 0.4)',
    greenGlow: '0 0 10px rgba(57, 255, 20, 0.3)',
    goldGlow: '0 0 10px rgba(255, 215, 0, 0.3)',
    orangeGlow: '0 0 10px rgba(255, 140, 0, 0.3)',
    redGlow: '0 0 10px rgba(255, 76, 76, 0.3)',
    modalGlow: '0 0 60px rgba(0, 180, 255, 0.1)',
  },
  typography: {
    fontFamily: '"JetBrains Mono", monospace',
  },
} as const;

export type ThemeColors = typeof THEME.colors;
