(function () {
    'use strict';
    const apiKey = localStorage.getItem('apiKey');
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
        document.getElementById('saveKey').checked = true;
    }
})()

const output = document.getElementById('output');

document.getElementById('runButton').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const saveKey = document.getElementById('saveKey').checked;    
    const noLegendary = document.getElementById('noLegendary').checked;
    const onlyLegendary = document.getElementById('onlyLegendary').checked;
    const characterDetails = document.getElementById('characterDetails').checked;
    const legendaryGeneration = document.getElementById('legendaryGeneration').value;

    if (!apiKey) {
        alert('API Key is required.');
        return;
    }

    if(saveKey) {
        localStorage.setItem('apiKey', apiKey);
    }
    
    if (onlyLegendary && noLegendary) {
        alert('Incompatible legendary armory option.');
        return;
    }

    
    appendOutput('Fetching data...\n');

    try {
        const itemCache = await loadItemCache();
        const legendaryItems = await loadLegendaryItems(apiKey);
        const characterNames = await fetchJson(`characters?access_token=${apiKey}`);

        if (!characterNames || characterNames.length === 0) {
            appendOutput('No characters found.\n');
            return;
        }

       appendOutput(`Found ${characterNames.length} characters...\n`);

        const weaponCounts = {};
        const itemIds = [];
        const charItemDict = {};
        const characterPromises = [];

        for (const charName of characterNames) {
            appendOutput(`Fetching data for character ${charName}...\n`);
            let currentCharacterProcess = fetchJson(`characters/${encodeURIComponent(charName)}/equipmenttabs?tabs=all&access_token=${apiKey}`).then(charData => {
                let templateId = 1;
                for (const equipmentTab of charData) {
                    const name = equipmentTab.name || templateId.toString();
                    appendOutput(`Processing Equipment Template ${name} in character ${charName}...\n`);

                    if (!equipmentTab.equipment) continue;

                    let items = equipmentTab.equipment.filter(item => item.slot.includes('Weapon') && !item.slot.includes('Aquatic'));
                    appendOutput(`Found ${items.length} weapons...\n`);
                    
                    if (noLegendary) {
                        items = items.filter(item => !['EquippedFromLegendaryArmory', 'LegendaryArmory'].includes(item.location));
                    }

                    if (onlyLegendary) {
                        items = items.filter(item => ['EquippedFromLegendaryArmory', 'LegendaryArmory'].includes(item.location));
                    }

                    if (legendaryGeneration) {
                        items = items.filter(item => legendaryItems[legendaryGeneration].includes(item.id));
                    }

                    items.forEach(item => itemIds.push(item.id));

                    if (!charItemDict[charName]) {
                        charItemDict[charName] = [];
                    }

                    charItemDict[charName].push(...items.map(item => ({itemId: item.id, template: name})));
                    templateId++;
                }
            });
            characterPromises.push(currentCharacterProcess);
        }
        
        await Promise.all(characterPromises);
        
        const uniqueItems = Array.from(new Set(itemIds));
        const itemsInCache = new Set(Object.keys(itemCache));
        const itemsToFetch = uniqueItems.filter(itemId => !itemsInCache.has(itemId));

        if (itemsToFetch.length > 0) {
            appendOutput(`Fetching ${itemsToFetch.length} items from API...\n`);
            const itemsFromApi = await fetchJson(`items?ids=${itemsToFetch.join(',')}&access_token=${apiKey}`);
            itemsFromApi.forEach(item => {
                itemCache[item.id] = item;
            });
        }

        itemIds.forEach(itemId => {
            const item = itemCache[itemId];
            if (item && item.details && item.details.type) {
                const weaponType = item.details.type;
                if (!weaponCounts[weaponType]) {
                    weaponCounts[weaponType] = {count: 1, ids: [item.id]};
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
                    const item = itemCache[detail.itemId];
                    appendOutput(item ? `  - ${item.name} (${item.details.type} [Template '${detail.template}'])\n` : `  - Item ID ${detail.itemId}: Not found in cache.\n`);
                });
            }
        }
        
        await saveItemCache(itemCache);
        
        appendOutput('\nDone!\n');
        
    } catch (error) {
        output.textContent += `Error: ${error.message}\n`;
    }
});

async function fetchJson(url) {
    const response = await fetch(`https://api.guildwars2.com/v2/${url}`);
    if (!response.ok) {
        throw new Error(`Error fetching ${url}: ${response.statusText}`);
    }
    return response.json();
}

async function loadItemCache() {
    try {
        const cachedItems = localStorage.getItem('itemCache');
        if (cachedItems) {
            const items = JSON.parse(cachedItems)
            const itemCache = {};
            items.forEach(item => {
                itemCache[item.id] = item;
            });
            console.log(`Loaded ${Object.keys(itemCache).length} items from cache.`);
            return itemCache;
        }
    } catch (error) {
        console.log('Not using file cache.');
    }
    return {};
}

async function saveItemCache(itemCache) {
    const items = Object.values(itemCache);
    localStorage.setItem('itemCache', JSON.stringify(items));
}

async function loadLegendaryItems(apiKey) {
    try {
        var cachedLegendaryItems = localStorage.getItem("legendaryItems");
        if (cachedLegendaryItems) {
            const legendaryItems = JSON.parse(cachedLegendaryItems);
            console.log('Loaded Legendary items from cache.');
            return legendaryItems;
        }
    } catch (error) {
        console.log('Not using file cache.', error);
    }

    const legendaryArmory = await fetchJson(`legendaryarmory?ids=all&access_token=${apiKey}`);
    const legendaryItemIds = legendaryArmory.map(item => item.id).join(',');
    const legendaryItems = await fetchJson(`items?ids=${legendaryItemIds}&access_token=${apiKey}`);
    const filteredItems = legendaryItems.filter(item => item.type === 'Weapon').sort((a, b) => a.id - b.id);

    const legendaryItemsByGen = {
        '1': filteredItems.filter(item => item.id < 71383).map(item => item.id),
        '2': filteredItems.filter(item => item.id <= 90551).map(item => item.id),
        '3': filteredItems.filter(item => item.id < 103815).map(item => item.id),
        '3_5': filteredItems.filter(item => item.id === 103815).map(item => item.id)
    };

    localStorage.setItem('legendaryItems', JSON.stringify(legendaryItemsByGen));

    return legendaryItemsByGen;
}

function appendOutput(text) {
    output.textContent += text;
    autoScroll(output);
}

function autoScroll(outputElement) {
    outputElement.scrollTop = outputElement.scrollHeight;
}

function forgetApiKey() {
    localStorage.removeItem('apiKey');
    document.getElementById('saveKey').checked = false;
}