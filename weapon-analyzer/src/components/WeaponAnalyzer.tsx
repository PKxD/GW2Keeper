import React, { useState, useEffect, useRef } from 'react';
import { loadItemCache, saveItemCache, loadLegendaryItems } from '@services/gw2Api';
import { fetchJson } from '@util/fetch';
import { ItemCache, WeaponCounts, CharacterItemDict, EquipmentTab, EquipmentItem } from '@types/gw2Types';

type CharacterTemplate = {
	name: string;
	items: {
		id: number;
		name: string;
		type: string;
		icon?: string;
	}[];
};

type CharacterData = {
	name: string;
	templates: CharacterTemplate[];
};

type WeaponTypeCount = {
	type: string;
	count: number;
};

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
	const [showConsole, setShowConsole] = useState<boolean>(false);
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
		setOutput(prev => prev + text);
	};

	const forgetApiKey = (): void => {
		localStorage.removeItem('apiKey');
		setSaveKey(false);
		setApiKey('');
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

		setOutput('');
		setCharacters([]);
		setWeaponCounts([]);
		setIsLoading(true);
		appendOutput('Fetching data...\n');

		try {
			const itemCache: ItemCache = await loadItemCache();
			const legendaryItems = await loadLegendaryItems(apiKey);
			const characterNames = await fetchJson<string[]>(`characters?access_token=${apiKey}`);

			if (!characterNames || characterNames.length === 0) {
				appendOutput('No characters found.\n');
				setIsLoading(false);
				return;
			}

			appendOutput(`Found ${characterNames.length} characters...\n`);

			const counts: WeaponCounts = {};
			const itemIds: number[] = [];
			const charItemDict: CharacterItemDict = {};
			const promises: Promise<void>[] = [];
			const newCharacters: CharacterData[] = [];

			for (const charName of characterNames) {
				appendOutput(`Processing character: ${charName}\n`);
				const processCharacter = fetchJson<EquipmentTab[]>(
					`characters/${encodeURIComponent(charName)}/equipmenttabs?tabs=all&access_token=${apiKey}`
				).then(charData => {
					const templates: CharacterTemplate[] = [];
					let templateId = 1;

					for (const tab of charData) {
						const name = tab.name || `Template ${templateId}`;
						if (!tab.equipment) continue;

						let items = tab.equipment.filter(
							item => item.slot.includes('Weapon') && !item.slot.includes('Aquatic')
						);

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
						charItemDict[charName].push(...items.map(item => ({ itemId: item.id, template: name })));

						templates.push({
							name,
							items: items.map(item => ({
								id: item.id,
								name: '',
								type: '',
								icon: ''
							}))
						});
						templateId++;
					}

					if (templates.length > 0) {
						newCharacters.push({ name: charName, templates });
					}
				});
				promises.push(processCharacter);
			}

			await Promise.all(promises);

			const uniqueItems = Array.from(new Set(itemIds));
			const itemsInCache = new Set(Object.keys(itemCache));
			const itemsToFetch = uniqueItems.filter(id => !itemsInCache.has(id.toString()));

			if (itemsToFetch.length > 0) {
				appendOutput(`Fetching ${itemsToFetch.length} items from API...\n`);
				// GW2 API only allows 200 IDs per request, batch them
				const BATCH_SIZE = 200;
				const batches = [];
				for (let i = 0; i < itemsToFetch.length; i += BATCH_SIZE) {
					batches.push(itemsToFetch.slice(i, i + BATCH_SIZE));
				}
				for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
					const batch = batches[batchIndex];
					appendOutput(`  Batch ${batchIndex + 1}/${batches.length} (${batch.length} items)...\n`);
					const itemsFromApi = await fetchJson<any[]>(`items?ids=${batch.join(',')}&access_token=${apiKey}`);
					itemsFromApi.forEach(item => {
						itemCache[item.id.toString()] = item;
					});
				}
			}

			// Count weapons
			itemIds.forEach(itemId => {
				const item = itemCache[itemId.toString()];
				if (item?.details?.type) {
					const weaponType = item.details.type;
					if (!counts[weaponType]) {
						counts[weaponType] = { count: 0, ids: [] };
					}
					counts[weaponType].count++;
					counts[weaponType].ids.push(itemId);
				}
			});

			const newWeaponCounts: WeaponTypeCount[] = Object.entries(counts).map(([type, data]) => ({
				type,
				count: data.count
			}));

			newWeaponCounts.forEach(({ type, count }) => {
				appendOutput(`${type}: ${count} equipped\n`);
			});

			// Fill in item details
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
			setCharacters(newCharacters);
			setWeaponCounts(newWeaponCounts);
			setIsLoading(false);
			appendOutput('\nDone!\n');
		} catch (error) {
			if (error instanceof Error) {
				appendOutput(`Error: ${error.message}\n`);
			} else {
				appendOutput('Unknown error occurred\n');
			}
			setIsLoading(false);
		}
	};

	return (
		<div className="weapon-analyzer">
			<h2>Guild Wars 2 Weapon Analyzer</h2>
			<p className="subtitle">Analyze weapon usage across your characters' equipment templates</p>

			<div className="settings">
				<h3>Settings</h3>
				<div className="form-grid">
					<div className="form-group full-width">
						<label htmlFor="apiKey">API Key</label>
						<input
							type="password"
							id="apiKey"
							data-testid="api-key-input"
							value={apiKey}
							onChange={e => setApiKey(e.target.value)}
							placeholder="Enter your Guild Wars 2 API key"
						/>
					</div>

					<div className="form-group">
						<label>Options</label>
						<div className="checkbox-group">
							<div className="checkbox-item">
								<input
									type="checkbox"
									id="saveKey"
									data-testid="save-key-checkbox"
									checked={saveKey}
									onChange={e => setSaveKey(e.target.checked)}
								/>
								<label htmlFor="saveKey">Save API Key</label>
							</div>
							<div className="checkbox-item">
								<input
									type="checkbox"
									id="noLegendary"
									data-testid="no-legendary-checkbox"
									checked={noLegendary}
									onChange={e => setNoLegendary(e.target.checked)}
								/>
								<label htmlFor="noLegendary">Exclude Legendary</label>
							</div>
							<div className="checkbox-item">
								<input
									type="checkbox"
									id="onlyLegendary"
									data-testid="only-legendary-checkbox"
									checked={onlyLegendary}
									onChange={e => setOnlyLegendary(e.target.checked)}
								/>
								<label htmlFor="onlyLegendary">Only Legendary</label>
							</div>
						</div>
					</div>

					<div className="form-group">
						<label htmlFor="legendaryGeneration">Legendary Generation</label>
						<select
							id="legendaryGeneration"
							data-testid="legendary-generation-select"
							value={legendaryGeneration}
							onChange={e => setLegendaryGeneration(e.target.value)}
						>
							<option value="">All Generations</option>
							<option value="1">Gen 1</option>
							<option value="2">Gen 2</option>
							<option value="3">Gen 3</option>
							<option value="3_5">Gen 3.5</option>
						</select>
					</div>

					<div className="form-group full-width">
						<div className="action-row">
							<button
								id="runButton"
								data-testid="analyze-button"
								className="btn btn-success"
								onClick={analyzeWeapons}
								disabled={isLoading}
							>
								{isLoading ? 'Analyzing...' : 'Analyze Weapons'}
							</button>
							{saveKey && (
								<button className="btn btn-danger" data-testid="forget-key-button" onClick={forgetApiKey}>
									Forget API Key
								</button>
							)}
						</div>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="loading">
					<div className="loading-spinner"></div>
					<p>Analyzing your characters...</p>
				</div>
			) : (
				<>
					{characters.length > 0 && (
						<div className="character-tabs">
							<div className="tab-headers">
								{characters.map((character, index) => (
									<div
										key={character.name}
										className={`tab-header ${index === activeCharacterIndex ? 'active' : ''}`}
										onClick={() => setActiveCharacterIndex(index)}
									>
										{character.name}
									</div>
								))}
							</div>
							<div className="tab-content">
								{characters[activeCharacterIndex] && (
									<div className="character-templates">
										<h3>{characters[activeCharacterIndex].name}'s Templates</h3>
										{characters[activeCharacterIndex].templates.map((template, idx) => (
											<div key={idx} className="template">
												<h4>{template.name}</h4>
												<div className="items">
													{template.items.map((item, itemIdx) => (
														<div key={itemIdx} className="item">
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
					)}

					{weaponCounts.length > 0 && (
						<div className="weapon-counts">
							<h3>Weapon Type Summary</h3>
							<div className="counts">
								{weaponCounts.map(({ type, count }) => (
									<div key={type} className="count">
										<div className="count-type">{type}</div>
										<div className="count-value">{count}</div>
									</div>
								))}
							</div>
						</div>
					)}

					<div className="console-section">
						<button className="btn btn-toggle-console" onClick={() => setShowConsole(!showConsole)}>
							{showConsole ? 'Hide Console' : 'Show Console'} ({output.split('\n').filter(l => l.trim()).length} lines)
						</button>
						{showConsole && output && (
							<div className="output-container">
								<pre id="output" data-testid="output" ref={outputRef}>{output}</pre>
							</div>
						)}
					</div>
				</>
			)}
		</div>
	);
};

export default WeaponAnalyzer;