import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import {
    loadItemCache,
    saveItemCache,
    loadLegendaryItems
} from '@services/gw2Api';
import { fetchJson } from '@util/fetch';
import {
    ItemCache,
    WeaponCounts,
    CharacterItemDict,
    EquipmentTab,
    EquipmentItem,
    Item
} from '@types/gw2Types';

// Define interfaces for our new data structure
type CharacterTemplate = {
    name: string;
    items: {
        id: number;
        name: string;
        type: string;
        icon?: string;
    }[];
}

type CharacterData = {
    name: string;
    templates: CharacterTemplate[];
}

type WeaponTypeCount = {
    type: string;
    count: number;
    ids: number[];
}

const WeaponAnalyzer: React.FC = () => {
    const [apiKey, setApiKey] = useState<string>('');
    const [saveKey, setSaveKey] = useState<boolean>(false);
    const [noLegendary, setNoLegendary] = useState<boolean>(false);
    const [onlyLegendary, setOnlyLegendary] = useState<boolean>(false);
    const [legendaryGeneration, setLegendaryGeneration] = useState<string>('');
    const [output, setOutput] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [characters, setCharacters] = useState<CharacterData[]>([]);
    const [weaponCounts, setWeaponCounts] = useState<WeaponTypeCount[]>([]);
    const [activeCharacterIndex, setActiveCharacterIndex] = useState<number>(0);
    const outputRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        // Load API key from localStorage
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
        setIsLoading(true);
        setCharacters([]);
        setWeaponCounts([]);

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
            const newCharacters: CharacterData[] = [];

            for (const charName of characterNames) {
                appendOutput(`Fetching data for character ${charName}...\n`);
                const currentCharacterProcess = fetchJson<EquipmentTab[]>(
                    `characters/${encodeURIComponent(charName)}/equipmenttabs?tabs=all&access_token=${apiKey}`
                ).then(charData => {
                    const characterTemplates: CharacterTemplate[] = [];
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

                        // Add items to the global list for fetching
                        items.forEach(item => itemIds.push(item.id));

                        // Add items to the character dictionary (for backward compatibility)
                        if (!charItemDict[charName]) {
                            charItemDict[charName] = [];
                        }

                        charItemDict[charName].push(
                            ...items.map(item => ({ itemId: item.id, template: name }))
                        );

                        // Create a template object for our new data structure
                        const template: CharacterTemplate = {
                            name,
                            items: items.map(item => ({
                                id: item.id,
                                name: '', // Will be filled later when we have item details
                                type: '',
                                icon: ''
                            }))
                        };

                        characterTemplates.push(template);
                        templateId++;
                    }

                    // Add the character to our new data structure
                    if (characterTemplates.length > 0) {
                        newCharacters.push({
                            name: charName,
                            templates: characterTemplates
                        });
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

            // Process weapon counts for the summary
            const newWeaponCounts: WeaponTypeCount[] = [];
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

            // Convert weaponCounts to array for state
            for (const [weaponType, count] of Object.entries(weaponCounts)) {
                newWeaponCounts.push({
                    type: weaponType,
                    count: count.count,
                    ids: count.ids
                });
                appendOutput(`The weapon type '${weaponType}' is equipped ${count.count} times across all characters.\n`);
            }

            // Update the item details in our new data structure
            for (const character of newCharacters) {
                for (const template of character.templates) {
                    for (let i = 0; i < template.items.length; i++) {
                        const itemId = template.items[i].id;
                        const item = itemCache[itemId.toString()];
                        if (item) {
                            template.items[i].name = item.name;
                            template.items[i].type = item.details?.type || '';
                            template.items[i].icon = item.icon || '';
                        }
                    }
                }
            }


            await saveItemCache(itemCache);

            // Update state with our new data
            setCharacters(newCharacters);
            setWeaponCounts(newWeaponCounts);
            setIsLoading(false);

            appendOutput('\nDone!\n');

        } catch (error) {
            if (error instanceof Error) {
                appendOutput(`Error: ${error.message}\n`);
            } else {
                appendOutput(`Unknown error occurred\n`);
            }
            setIsLoading(false);
        }
    };

    // Function to handle character tab selection
    const handleCharacterTabClick = (index: number) => {
        setActiveCharacterIndex(index);
    };

    return (
        <div className={`weapon-analyzer`} data-testid="weapon-analyzer">
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

            {isLoading ? (
                <div className="loading">Loading data...</div>
            ) : (
                <>
                    {characters.length > 0 ? (
                        <div className="character-tabs" data-testid="output">
                            <div className="tab-headers">
                                {characters.map((character, index) => (
                                    <div 
                                        key={character.name} 
                                        className={`tab-header ${index === activeCharacterIndex ? 'active' : ''}`}
                                        onClick={() => handleCharacterTabClick(index)}
                                    >
                                        {character.name}
                                    </div>
                                ))}
                            </div>
                            <div className="tab-content">
                                {characters[activeCharacterIndex] && (
                                    <div className="character-templates">
                                        <h3>{characters[activeCharacterIndex].name}'s Templates</h3>
                                        {characters[activeCharacterIndex].templates.map(template => (
                                            <div key={template.name} className="template">
                                                <h4>Template: {template.name}</h4>
                                                <div className="items">
                                                    {template.items.map(item => (
                                                        <div key={item.id} className="item">
                                                            {item.icon && (
                                                                <img 
                                                                    src={item.icon} 
                                                                    alt={item.name} 
                                                                    className="item-icon" 
                                                                />
                                                            )}
                                                            <div className="item-details">
                                                                <div className="item-name">{item.name}</div>
                                                                <div className="item-type">{item.type}</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        output && (
                            <div className="output-container">
                                <h3>Output:</h3>
                                <pre id="output" data-testid="output" ref={outputRef}>{output}</pre>
                            </div>
                        )
                    )}

                    {weaponCounts.length > 0 && (
                        <div className="weapon-counts">
                            <h3>Weapon Type Summary</h3>
                            <div className="counts">
                                {weaponCounts.map(count => (
                                    <div key={count.type} className="count">
                                        <div className="count-type">{count.type}</div>
                                        <div className="count-value">{count.count}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default WeaponAnalyzer;
