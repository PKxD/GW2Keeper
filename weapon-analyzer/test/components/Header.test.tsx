// src/components/__tests__/Header.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import '@testing-library/jest-dom';
import { Header } from '@components/Header';
import { mockUseTheme } from '../mocks/ThemeContextMock';

// Mock the useLocation hook from preact-iso
vi.mock('preact-iso', () => ({
    useLocation: () => ({ url: '/' })
}));

// Mock the useTheme hook
vi.mock('../../src/context/ThemeContext', () => ({
    useTheme: () => mockUseTheme()
}));

describe('Header Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Reset theme to dark mode before each test
        mockUseTheme().themeMode = 'dark';
    });

    it('should render the header with navigation', () => {
        render(<Header />);
        
        const navLink = screen.getByText('Guild Wars 2 Weapon Analyzer');
        expect(navLink).toBeInTheDocument();
        expect(navLink.getAttribute('href')).toBe('/GW2Keeper');
    });

    it('should render the theme toggle button', () => {
        render(<Header />);
        
        const themeToggleButton = screen.getByTestId('theme-toggle');
        expect(themeToggleButton).toBeInTheDocument();
        expect(themeToggleButton.textContent).toBe('Switch to Light Mode');
    });

    it('should call toggleTheme when theme toggle button is clicked', () => {
        render(<Header />);
        
        const themeToggleButton = screen.getByTestId('theme-toggle');
        fireEvent.click(themeToggleButton);
        
        expect(mockUseTheme().toggleTheme).toHaveBeenCalledTimes(1);
    });

    it('should display correct button text based on theme mode', () => {
        // Test with dark mode
        mockUseTheme().themeMode = 'dark';
        const {rerender} = render(<Header />);
        
        let themeToggleButton = screen.getByTestId('theme-toggle');
        expect(themeToggleButton.textContent).toBe('Switch to Light Mode');
        
        // Test with light mode
        mockUseTheme().themeMode = 'light';
        rerender(<Header />);
        
        themeToggleButton = screen.getByTestId('theme-toggle');
        expect(themeToggleButton.textContent).toBe('Switch to Dark Mode');
    });
});