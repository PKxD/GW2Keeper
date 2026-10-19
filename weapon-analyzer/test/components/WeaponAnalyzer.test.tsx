// src/components/__tests__/WeaponAnalyzer.test.tsx
import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/preact';

import WeaponAnalyzer from '@components/WeaponAnalyzer';
import * as gw2Api from '@services/gw2Api';
import {fetchJson} from "@util/fetch";
import * as ThemeContext from '../../src/context/ThemeContext';
import { mockUseTheme } from '../mocks/ThemeContextMock';

vi.mock('@services/gw2Api', () => ({
    loadItemCache: vi.fn(),
    saveItemCache: vi.fn(),
    loadLegendaryItems: vi.fn()
}));

vi.mock('@util/fetch', () => ({
    fetchJson: vi.fn()
}));

// Mock the useTheme hook
vi.mock('../../src/context/ThemeContext', () => ({
    useTheme: () => mockUseTheme()
}));

describe('WeaponAnalyzer Component', () => {
    beforeEach(() => {
        vi.resetAllMocks();

        vi.mocked(gw2Api.loadItemCache).mockResolvedValue({});
        vi.mocked(gw2Api.loadLegendaryItems).mockResolvedValue({
            '1': [12345],
            '2': [54321],
            '3': [98765],
            '3_5': [103815]
        });
        vi.mocked(fetchJson).mockImplementation((endpoint: string) => {
            if (endpoint.includes('characters?')) {
                return Promise.resolve(['Character1', 'Character2']);
            }
            return Promise.resolve([]);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should load API key from localStorage on mount', () => {
        window.localStorage.getItem = vi.fn().mockReturnValue('saved-api-key');

        render(<WeaponAnalyzer />);

        expect(window.localStorage.getItem).toHaveBeenCalledWith('apiKey');

        const apiKeyInput = screen.getByTestId('api-key-input') as HTMLInputElement;
        expect(apiKeyInput.value).toBe('saved-api-key');

        const saveKeyCheckbox = screen.getByTestId('save-key-checkbox') as HTMLInputElement;
        expect(saveKeyCheckbox.checked).toBe(true);
    });

    it('should forget API key when button clicked', () => {
        window.localStorage.getItem = vi.fn().mockReturnValue('saved-api-key');

        render(<WeaponAnalyzer />);
        fireEvent.click(screen.getByTestId('forget-key-button'));

        expect(window.localStorage.removeItem).toHaveBeenCalledWith('apiKey');

        const saveKeyCheckbox = screen.getByTestId('save-key-checkbox') as HTMLInputElement;
        expect(saveKeyCheckbox.checked).toBe(false);

        const apiKeyInput = screen.getByTestId('api-key-input') as HTMLInputElement;
        expect(apiKeyInput.value).toBe('');
    });

    it('should not analyze weapons if API key is missing', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
        render(<WeaponAnalyzer />);

        fireEvent.click(screen.getByTestId('analyze-button'));

        expect(alertMock).toHaveBeenCalledWith('API Key is required.');
        expect(fetchJson).not.toHaveBeenCalled();
    });

    it('should not analyze weapons if incompatible legendary options are selected', () => {
        const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
        render(<WeaponAnalyzer />);

        const apiKeyInput = screen.getByTestId('api-key-input') as HTMLInputElement;
        fireEvent.input(apiKeyInput, { target: { value: 'test-api-key' } });

        fireEvent.click(screen.getByTestId('no-legendary-checkbox'));
        fireEvent.click(screen.getByTestId('only-legendary-checkbox'));

        fireEvent.click(screen.getByTestId('analyze-button'));

        expect(alertMock).toHaveBeenCalledWith('Incompatible legendary armory option.');
        expect(fetchJson).not.toHaveBeenCalled();
    });

    it('should analyze weapons with valid API key', async () => {
        render(<WeaponAnalyzer />);

        const apiKeyInput = screen.getByTestId('api-key-input') as HTMLInputElement;
        fireEvent.input(apiKeyInput, { target: { value: 'test-api-key' } });

        vi.mocked(fetchJson).mockImplementation((endpoint: string) => {
            if (endpoint.includes('characters?')) {
                return Promise.resolve(['Character1']);
            } else if (endpoint.includes('equipmenttabs')) {
                return Promise.resolve([{
                    name: 'Template1',
                    equipment: [
                        {
                            id: 12345,
                            slot: 'WeaponA1',
                            location: 'EquippedFromLegendaryArmory'
                        }
                    ]
                }]);
            } else if (endpoint.includes('items?')) {
                return Promise.resolve([{
                    id: 12345,
                    name: 'Legendary Sword',
                    details: { type: 'Sword' }
                }]);
            }
            return Promise.resolve([]);
        });

        fireEvent.click(screen.getByTestId('analyze-button'));

        await waitFor(() => {
            const outputElement = screen.getByTestId('output');
            expect(gw2Api.saveItemCache).toHaveBeenCalled();
        });
    });

    it('should save API key to localStorage when option checked', async () => {
        render(<WeaponAnalyzer />);

        const apiKeyInput = screen.getByTestId('api-key-input') as HTMLInputElement;
        fireEvent.input(apiKeyInput, { target: { value: 'test-api-key' } });

        const saveKeyCheckbox = screen.getByTestId('save-key-checkbox');
        fireEvent.click(saveKeyCheckbox);

        fireEvent.click(screen.getByTestId('analyze-button'));

        await waitFor(() => {
            expect(window.localStorage.setItem).toHaveBeenCalledWith('apiKey', 'test-api-key');
        });
    });
});
