import React, { ReactNode } from 'react';
import { ThemeMode } from '../../src/context/ThemeContext';

// Create a mock context
export const mockThemeContext = {
    themeMode: 'dark' as ThemeMode,
    toggleTheme: vi.fn()
};

// Create a mock provider for testing
export const MockThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <div data-testid="mock-theme-provider">
            {children}
        </div>
    );
};

// Mock the useTheme hook
export const mockUseTheme = () => mockThemeContext;