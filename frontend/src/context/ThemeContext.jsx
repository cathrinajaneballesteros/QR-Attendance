import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api';

const ThemeContext = createContext(null);

export const THEMES = [
  { id: 'rose', name: 'Sta. Rosa Rose', primary: '#880e4f', accent: '#e91e63', desc: 'Classic DepEd Rose' },
  { id: 'emerald', name: 'Emerald Academy', primary: '#065f46', accent: '#10b981', desc: 'Fresh Forest Green' },
  { id: 'royal', name: 'Royal Panpacific', primary: '#1e3a8a', accent: '#3b82f6', desc: 'University Navy & Blue' },
  { id: 'amber', name: 'Sunset Amber', primary: '#92400e', accent: '#f59e0b', desc: 'Warm Golden Sunshine' },
  { id: 'violet', name: 'Violet Genius', primary: '#581c87', accent: '#8b5cf6', desc: 'Vibrant Deep Violet' },
  { id: 'slate', name: 'Midnight Dark', primary: '#0f172a', accent: '#38bdf8', desc: 'Sleek Dark Modern' },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('attendance_theme') || 'rose';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('attendance_theme', theme);
  }, [theme]);

  // Sync with backend settings on load
  useEffect(() => {
    apiFetch('/api/settings')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.attendance_theme && data.attendance_theme !== theme) {
          setThemeState(data.attendance_theme);
        }
      })
      .catch(() => {});
  }, []);

  const changeTheme = async (newTheme) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('attendance_theme', newTheme);

    // Save to backend settings
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ attendance_theme: newTheme })
      });
    } catch (e) {
      console.warn('Could not persist theme to server:', e);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, changeTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'rose',
      changeTheme: () => {},
      themes: THEMES
    };
  }
  return context;
}
