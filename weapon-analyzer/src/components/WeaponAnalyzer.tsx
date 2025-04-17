import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
    loadItemCache,
    saveItemCache,
    loadLegendaryItems
} from '../services/gw2Api';
import { fetchJson } from '@util/fetch';
import {
    ItemCache,
    WeaponCounts,
    CharacterItemDict,
    EquipmentTab,
    EquipmentItem
} from '../types/gw2Types';

const WeaponAnalyzer: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [saveKey, setSaveKey] = useState<boolean>(false);
    const [noLegendary, setNoLegendary] = useState<boolean>(false);
    const [onlyLegendary, setOnlyLegendary] = useState<boolean>(false);
    const [characterDetails, setCharacterDetails] = useState<boolean>(false);
    const [legendaryGeneration, setLegendaryGeneration] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const outputRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        const storedApiKey = localStorage.getItem('apiKey');
        if (storedApiKey) {
            setApiKey(storedApiKey);
            setSaveKey(true);
        }
    }, []);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    const appendOutput = (text: string): void => {
        setOutput(prevOutput => prevOutput + text);
    };

    const forgetApiKey = (): void => {
        localStorage.removeItem('apiKey');
        setSaveKey(false);
        setApiKey('');
    };

    const handleApiKeyChange = (e: ChangeEvent<HTMLInputElement>): void => {
        setApiKey(e.target.value);
    };

    const handleCheckboxChange = (
        setter: React.Dispatch<React.SetStateAction<boolean>>
    ) => (e: ChangeEvent<HTMLInputElement>): void => {
        setter(e.target.checked);
    };

    const handleSelectChange = (e: ChangeEvent<HTMLSelectElement>): void => {
        setLegendaryGeneration(e.target.value);
    };

    const analyzeWeapons = async (): Promise<void> => {
        if (!apiKey) {
            alert('API Key is required.');
            return;
        }

        if (saveKey) {
            localStorage.setItem('apiKey', apiKey);
        }

        if (onlyLegendary && noLegendary) {
            alert('Incompatible legendary armory option.');
            return;
        }

        setOutput('Fetching data...\n');

        try {
            const itemCache: ItemCache = await loadItemCache();
            const legendaryItems = await loadLegendaryItems(apiKey);
            const characterNames = await fetchJson<string[]>(`characters?access_token=${apiKey}`);

            if (!characterNames || characterNames.length === 0) {
                appendOutput('No characters found.\n');
                return;
            }

            appendOutput(`Found ${characterNames.length} characters...\n`);

            const weaponCounts: WeaponCounts = {};
            const itemIds: number[] = [];
            const charItemDict: CharacterItemDict = {};
            const characterPromises: Promise<void>[] = [];

            for (const charName of characterNames) {
                appendOutput(`Fetching data for character ${charName}...\n`);
                const currentCharacterProcess = fetchJson<EquipmentTab[]>(
                    `characters/${encodeURIComponent(charName)}/equipmenttabs?tabs=all&access_token=${apiKey}`
                ).then(charData => {
                    let templateId = 1;
                    for (const equipmentTab of charData) {
                        const name = equipmentTab.name || templateId.toString();
                        appendOutput(`Processing Equipment Template ${name} in character ${charName}...\n`);

                        if (!equipmentTab.equipment) continue;

                        let items: EquipmentItem[] = equipmentTab.equipment.filter(
                            item => item.slot.includes('Weapon') && !item.slot.includes('Aquatic')
                        );

                        appendOutput(`Found ${items.length} weapons...\n`);

                        if (noLegendary) {
                            items = items.filter(
                                item => !['EquippedFromLegendaryArmory', 'LegendaryArmory'].includes(item.location)
                            );
                        }

                        if (onlyLegendary) {
                            items = items.filter(
                                item => ['EquippedFromLegendaryArmory', 'LegendaryArmory'].includes(item.location)
                            );
                        }

                        if (legendaryGeneration && legendaryItems[legendaryGeneration]) {
                            items = items.filter(
                                item => legendaryItems[legendaryGeneration].includes(item.id)
                            );
                        }

                        items.forEach(item => itemIds.push(item.id));

                        if (!charItemDict[charName]) {
                            charItemDict[charName] = [];
                        }

                        charItemDict[charName].push(
                            ...items.map(item => ({ itemId: item.id, template: name }))
                        );

                        templateId++;
                    }
                });

                characterPromises.push(currentCharacterProcess);
            }

            await Promise.all(characterPromises);

            const uniqueItems = Array.from(new Set(itemIds));
            const itemsInCache = new Set(Object.keys(itemCache));
            const itemsToFetch = uniqueItems.filter(
                itemId => !itemsInCache.has(itemId.toString())
            );

            if (itemsToFetch.length > 0) {
                appendOutput(`Fetching ${itemsToFetch.length} items from API...\n`);
                const itemsFromApi = await fetchJson<any[]>(
                    `items?ids=${itemsToFetch.join(',')}&access_token=${apiKey}`
                );

                itemsFromApi.forEach(item => {
                    itemCache[item.id.toString()] = item;
                });
            }

            itemIds.forEach(itemId => {
                const item = itemCache[itemId.toString()];
                if (item && item.details && item.details.type) {
                    const weaponType = item.details.type;
                    if (!weaponCounts[weaponType]) {
                        weaponCounts[weaponType] = { count: 1, ids: [item.id] };
                    } else {
                        weaponCounts[weaponType].count++;
                        weaponCounts[weaponType].ids = [...weaponCounts[weaponType].ids, item.id];
                    }
                }
            });

            for (const [weaponType, count] of Object.entries(weaponCounts)) {
                appendOutput(`The weapon type '${weaponType}' is equipped ${count.count} times across all characters.\n`);
            }

            if (characterDetails) {
                appendOutput('\nDetailed Character Equipment:\n');
                for (const [charName, details] of Object.entries(charItemDict)) {
                    appendOutput(`Character: ${charName}\n`);
                    details.forEach(detail => {
                        const item = itemCache[detail.itemId.toString()];
                        appendOutput(
                            item
                                ? `  - ${item.name} (${item.details.type} [Template '${detail.template}'])\n`
                                : `  - Item ID ${detail.itemId}: Not found in cache.\n`
                        );
                    });
                }
            }

            await saveItemCache(itemCache);

            appendOutput('\nDone!\n');

        } catch (error) {
            if (error instanceof Error) {
                appendOutput(`Error: ${error.message}\n`);
            } else {
                appendOutput(`Unknown error occurred\n`);
            }
        }
    };

    return (
        <div className="weapon-analyzer" data-testid="weapon-analyzer">
            <div className="settings">
                <div className="form-group">
                    <label htmlFor="apiKey">API Key:</label>
                    <input
                        type="text"
                        id="apiKey"
                        data-testid="api-key-input"
                        value={apiKey}
                        onChange={handleApiKeyChange}
                    />
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            id="saveKey"
                            data-testid="save-key-checkbox"
                            checked={saveKey}
                            onChange={handleCheckboxChange(setSaveKey)}
                        />
                        Save API Key
                    </label>
                    <button onClick={forgetApiKey} data-testid="forget-key-button">Forget API Key</button>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            id="noLegendary"
                            data-testid="no-legendary-checkbox"
                            checked={noLegendary}
                            onChange={handleCheckboxChange(setNoLegendary)}
                        />
                        Exclude Legendary Items
                    </label>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            id="onlyLegendary"
                            data-testid="only-legendary-checkbox"
                            checked={onlyLegendary}
                            onChange={handleCheckboxChange(setOnlyLegendary)}
                        />
                        Only Legendary Items
                    </label>
                </div>

                <div className="form-group">
                    <label>
                        <input
                            type="checkbox"
                            id="characterDetails"
                            data-testid="character-details-checkbox"
                            checked={characterDetails}
                            onChange={handleCheckboxChange(setCharacterDetails)}
                        />
                        Show Character Details
                    </label>
                </div>

                <div className="form-group">
                    <label htmlFor="legendaryGeneration">Legendary Generation:</label>
                    <select
                        id="legendaryGeneration"
                        data-testid="legendary-generation-select"
                        value={legendaryGeneration}
                        onChange={handleSelectChange}
                    >
                        <option value="">All</option>
                        <option value="1">Gen 1</option>
                        <option value="2">Gen 2</option>
                        <option value="3">Gen 3</option>
                        <option value="3_5">Gen 3.5</option>
                    </select>
                </div>

                <button id="runButton" data-testid="analyze-button" onClick={analyzeWeapons}>Analyze Weapons</button>
            </div>

            <div className="output-container">
                <h3>Output:</h3>
                <pre id="output" data-testid="output" ref={outputRef}>{output}</pre>
            </div>
        </div>
    );
};

export default WeaponAnalyzer;
