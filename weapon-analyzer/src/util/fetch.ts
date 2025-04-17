export const API_BASE_URL = 'https://api.guildwars2.com/v2';

export async function fetchJson<T>(endpoint: string, apiKey: string | null = null): Promise<T> {
    const url = `${API_BASE_URL}/${endpoint}${apiKey ? `?access_token=${apiKey}` : ''}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching ${endpoint}: ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}