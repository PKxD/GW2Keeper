import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { loadItemCache, saveItemCache, loadLegendaryItems }from '@services/gw2Api';
// @ts-ignore
import { Item } from '@types/gw2Types';

import { fetchJson } from "@util/fetch";

vi.mock("@util/fetch", () => ({
    fetchJson: vi.fn()
}))

describe('gw2Api service', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('loadItemCache', () => {
        it('should return empty object when no cache exists', async () => {
            // Arrange
            window.localStorage.getItem = vi.fn().mockReturnValue(null);

            // Act
            const result = await loadItemCache();

            // Assert
            expect(result).toEqual({});
            expect(window.localStorage.getItem).toHaveBeenCalledWith('itemCache');
        });

        it('should return cached items when cache exists', async () => {
            // Arrange
            const mockItems: Item[] = [
                { id: 1, name: 'Item 1' },
                { id: 2, name: 'Item 2' }
            ];
            window.localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(mockItems));

            // Act
            const result = await loadItemCache();

            // Assert
            expect(result).toEqual({
                '1': { id: 1, name: 'Item 1' },
                '2': { id: 2, name: 'Item 2' }
            });
        });

        it('should handle JSON parse errors', async () => {
            // Arrange
            window.localStorage.getItem = vi.fn().mockReturnValue('invalid-json');
            vi.spyOn(console, 'log').mockImplementation(() => {});

            // Act
            const result = await loadItemCache();

            // Assert
            expect(result).toEqual({});
            expect(console.log).toHaveBeenCalled();
        });
    });

    describe('saveItemCache', () => {
        it('should save items to localStorage', async () => {
            // Arrange
            window.localStorage.setItem = vi.fn();
            const mockItemCache = {
                '1': { id: 1, name: 'Item 1' },
                '2': { id: 2, name: 'Item 2' }
            };

            // Act
            await saveItemCache(mockItemCache);

            // Assert
            expect(window.localStorage.setItem).toHaveBeenCalledWith(
                'itemCache',
                JSON.stringify([
                    { id: 1, name: 'Item 1' },
                    { id: 2, name: 'Item 2' }
                ])
            );
        });
    });

    describe('loadLegendaryItems', () => {
        it('should load legendary items from cache if available', async () => {
            // Arrange
            const mockLegendaryItems = {
                '1': [12345, 67890],
                '2': [54321],
                '3': [98765],
                '3_5': [103815]
            };
            window.localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(mockLegendaryItems));

            // Act
            const result = await loadLegendaryItems('test-api-key');

            // Assert
            expect(result).toEqual(mockLegendaryItems);
        });

        it('should fetch legendary items from API if not in cache', async () => {
            // Arrange
            window.localStorage.getItem = vi.fn().mockReturnValue(null);

            const mockLegendaryArmory = [
                { id: 12345 },
                { id: 54321 },
                { id: 67890 },
                { id: 98765 },
                { id: 103815 }
            ];

            const mockLegendaryItems = [
                { id: 12345, type: 'Weapon' },
                { id: 54321, type: 'Weapon' },
                { id: 67890, type: 'Weapon' },
                { id: 98765, type: 'Weapon' },
                { id: 103815, type: 'Weapon' }
            ];

            // Mock the fetchJson function
            vi.mocked(fetchJson).mockImplementation((endpoint: string) => {
                if (endpoint.includes('legendaryarmory')) {
                    return Promise.resolve(mockLegendaryArmory);
                } else if (endpoint.includes('items')) {
                    return Promise.resolve(mockLegendaryItems);
                }
                return Promise.resolve([]);
            });

            // Act
            const result = await loadLegendaryItems('test-api-key');

            // Assert
            expect(window.localStorage.setItem).toHaveBeenCalled();
            expect(result).toHaveProperty('1');
            expect(result).toHaveProperty('2');
            expect(result).toHaveProperty('3');
            expect(result).toHaveProperty('3_5');
        });
    });
});
