import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';

// Define theme types
export type ThemeMode = 'dark' | 'light';

// Create the context with a default value
interface ThemeContextType {
    themeMode: ThemeMode;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Create a provider component
interface ThemeProviderProps {
    children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    const [themeMode, setThemeMode] = useState<ThemeMode>('dark');

    // Load theme preference from localStorage on mount
    useEffect(() => {
        const storedTheme = localStorage.getItem('themeMode') as ThemeMode;
        if (storedTheme && (storedTheme === 'dark' || storedTheme === 'light')) {
            setThemeMode(storedTheme);
        }
    }, []);

    // Apply theme class to body element
    useEffect(() => {
        if (themeMode === 'light') {
            document.body.classList.add('light-mode');
        } else {
            document.body.classList.remove('light-mode');
        }
    }, [themeMode]);

    // Function to toggle theme mode
    const toggleTheme = () => {
        setThemeMode(prevMode => {
            const newMode = prevMode === 'dark' ? 'light' : 'dark';
            localStorage.setItem('themeMode', newMode);
            return newMode;
        });
    };

    return (
        <ThemeContext.Provider value={{ themeMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// Create a custom hook to use the theme context
export const useTheme = (): ThemeContextType => {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
