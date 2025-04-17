import {fetchJson} from "@util/fetch";
import {ItemCache, Item, LegendaryItemsByGen} from '../types/gw2Types';


export async function loadItemCache(): Promise<ItemCache> {
    try {
        const cachedItems = localStorage.getItem('itemCache');
        if (cachedItems) {
            const items = JSON.parse(cachedItems) as Item[];
            const itemCache: ItemCache = {};
            items.forEach(item => {
                itemCache[item.id.toString()] = item;
            });
            console.log(`Loaded ${Object.keys(itemCache).length} items from cache.`);
            return itemCache;
        }
    } catch (error) {
        console.log('Not using cache.', error);
    }
    return {};
}

export async function saveItemCache(itemCache: ItemCache): Promise<void> {
    const items = Object.values(itemCache);
    localStorage.setItem('itemCache', JSON.stringify(items));
}

export async function loadLegendaryItems(apiKey: string): Promise<LegendaryItemsByGen> {
    try {
        const cachedLegendaryItems = localStorage.getItem("legendaryItems");
        if (cachedLegendaryItems) {
            const legendaryItems = JSON.parse(cachedLegendaryItems) as LegendaryItemsByGen;
            console.log('Loaded Legendary items from cache.');
            return legendaryItems;
        }
    } catch (error) {
        console.log('Not using cache.', error);
    }

    const legendaryArmory = await fetchJson<Array<{ id: number }>>(
        `legendaryarmory?ids=all&access_token=${apiKey}`
    );

    const legendaryItemIds = legendaryArmory.map(item => item.id).join(',');
    const legendaryItems = await fetchJson<Item[]>(
        `items?ids=${legendaryItemIds}&access_token=${apiKey}`
    );

    const filteredItems = legendaryItems
        .filter(item => item.type === 'Weapon')
        .sort((a, b) => a.id - b.id);

    console.log(filteredItems);
    
    
    
    const legendaryItemsByGen: LegendaryItemsByGen = {
        '1': filteredItems.filter(item => item.id < 71383).map(item => item.id),
        '2': filteredItems.filter(item => item.id <= 90551 && item.id > 71383).map(item => item.id),
        '3': filteredItems.filter(item => item.id < 103815 && item.id > 90551).map(item => item.id),
        '3_5': filteredItems.filter(item => item.id === 103815).map(item => item.id)
    };

    console.table(legendaryItemsByGen);
    
    localStorage.setItem('legendaryItems', JSON.stringify(legendaryItemsByGen));
    return legendaryItemsByGen;
}