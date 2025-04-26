// src/context/__tests__/ThemeContext.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { ThemeProvider, useTheme } from '../../src/context/ThemeContext';

// Create a test component that uses the theme context
const TestComponent = () => {
    const { themeMode, toggleTheme } = useTheme();
    return (
        <div>
            <div data-testid="theme-mode">{themeMode}</div>
            <button data-testid="toggle-theme" onClick={toggleTheme}>
                Toggle Theme
            </button>
        </div>
    );
};

describe('ThemeContext', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        // Reset body classes
        document.body.classList.remove('light-mode');

        // Mock localStorage
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn(),
                setItem: vi.fn(),
                removeItem: vi.fn(),
                clear: vi.fn()
            },
            writable: true
        });
    });

    it('should provide default theme as dark', () => {
        // Mock localStorage.getItem to return null (no stored theme)
        vi.mocked(localStorage.getItem).mockReturnValue(null);

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        const themeMode = screen.getByTestId('theme-mode');
        expect(themeMode.textContent).toBe('dark');
        expect(document.body.classList.contains('light-mode')).toBe(false);
    });

    it('should load theme from localStorage on mount', () => {
        // Mock localStorage.getItem to return 'light'
        vi.mocked(localStorage.getItem).mockReturnValue('light');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        const themeMode = screen.getByTestId('theme-mode');
        expect(themeMode.textContent).toBe('light');
        expect(localStorage.getItem).toHaveBeenCalledWith('themeMode');
        expect(document.body.classList.contains('light-mode')).toBe(true);
    });

    it('should toggle theme when toggleTheme is called', () => {
        // Start with dark theme
        vi.mocked(localStorage.getItem).mockReturnValue('dark');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        const toggleButton = screen.getByTestId('toggle-theme');
        const themeMode = screen.getByTestId('theme-mode');

        // Initially dark
        expect(themeMode.textContent).toBe('dark');
        expect(document.body.classList.contains('light-mode')).toBe(false);

        // Toggle to light
        fireEvent.click(toggleButton);
        expect(themeMode.textContent).toBe('light');
        expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'light');
        expect(document.body.classList.contains('light-mode')).toBe(true);

        // Toggle back to dark
        fireEvent.click(toggleButton);
        expect(themeMode.textContent).toBe('dark');
        expect(localStorage.setItem).toHaveBeenCalledWith('themeMode', 'dark');
        expect(document.body.classList.contains('light-mode')).toBe(false);
    });

    it('should ignore invalid theme values from localStorage', () => {
        // Mock localStorage.getItem to return an invalid value
        vi.mocked(localStorage.getItem).mockReturnValue('invalid-theme');

        render(
            <ThemeProvider>
                <TestComponent />
            </ThemeProvider>
        );

        const themeMode = screen.getByTestId('theme-mode');
        expect(themeMode.textContent).toBe('dark'); // Should default to dark
        expect(document.body.classList.contains('light-mode')).toBe(false);
    });
});
