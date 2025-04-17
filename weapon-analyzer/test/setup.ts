import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/preact';

// Clean up after each test
afterEach(() => {
    cleanup();
});

// Mock localStorage for all tests
beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
        value: {
            getItem: vi.fn(),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        },
        writable: true
    });
});
