using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;


//private static readonly string apiKey = "C23628ED-454D-054D-931E-F95560C40D5216FE87E4-7E5B-4AA4-B2FB-04036296846D";
//private static readonly string apiKey = "37160DE5-98DA-D842-A6FD-59EBC3CDE3287C60E068-66FE-47C6-A962-1D042243276E";
record WeaponCount(int Count, List<int> Ids);


public class ItemInTemplate
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("slot")] public string Slot { get; set; }
    [JsonPropertyName("location")] public string Location { get; set; }
}

public class ItemApiResponse
{
    [JsonPropertyName("id")] public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; }
    [JsonPropertyName("type")] public string Type { get; set; }
    [JsonPropertyName("rarity")] public string Rarity { get; set; }
    [JsonPropertyName("details")] public ItemDetail Details { get; set; }
}

public class ItemDetail
{
    [JsonPropertyName("type")] public string Type { get; set; }
}


class Program
{
    private static readonly HttpClient client = new HttpClient();

    private static readonly string[] LegendaryLocations = ["EquippedFromLegendaryArmory", "LegendaryArmory"];

    static async Task Main(string[] args)
    {
        if (args.Length == 0)
        {
            Console.WriteLine("At least needs API Key to be provided.");
            return;
        }

        var apiKey = args[0];

        var itemCache = new Dictionary<string, ItemApiResponse>();
        if (File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "ItemCache.json")))
        {
            await using var fs = File.OpenRead(Path.Combine(Directory.GetCurrentDirectory(), "ItemCache.json"));
            await foreach (var item in JsonSerializer.DeserializeAsyncEnumerable<ItemApiResponse>(fs))
            {
                if (item != null)
                    itemCache.Add(item.Id.ToString(), item);
            }
        }
        else
        {
            Console.WriteLine("Not using file cache.");
        }

        var skipLegendaryArmory = args.Contains("--no-legendary");

        client.BaseAddress = new Uri("https://api.guildwars2.com/v2/");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        Console.WriteLine("Fetching characters...");

        var characterNames = await FetchJsonAsync<List<string>>("characters");

        Console.WriteLine($"Found {characterNames.Count} characters...");

        var weaponCounts = new Dictionary<string, WeaponCount>();
        var itemIds = new List<string>();

        var charItemDict = new ConcurrentDictionary<string, List<ItemInTemplate>>();

        await Parallel.ForEachAsync(characterNames, async (charName, cancelToken) =>
        {
            Console.WriteLine($"Fetching data for character {charName}...");
            var charData =
                await FetchJsonAsync<JsonElement>(
                    $"characters/{Uri.EscapeDataString(charName)}/equipmenttabs?tabs=all", cancelToken);

            charItemDict[charName] = [];

            foreach (var equipmentTab in charData.EnumerateArray())
            {
                var name = equipmentTab.GetProperty("name").GetString();

                Console.WriteLine($"Processing Equipment Template {name}...");
                if (!equipmentTab.TryGetProperty("equipment", out JsonElement equipment)) continue;

                var items = JsonSerializer.Deserialize<List<ItemInTemplate>>(equipment.GetRawText());

                if (items == null) continue;

                var weapons = items.Where(item => item.Slot.Contains("Weapon") && !item.Slot.Contains("Aquatic"))
                    .ToList();

                Console.WriteLine($"Found {weapons.Count} weapons...");

                if (skipLegendaryArmory)
                {
                    weapons = weapons.Where(w => !LegendaryLocations.Contains(w.Location)).ToList();
                }

                lock (itemIds)
                {
                    itemIds.AddRange(weapons.Select(w => w.Id.ToString()));
                }

                charItemDict[charName].AddRange(weapons);
            }
        });

        if (itemIds.Count > 0)
        {
            var uniqueItems = new HashSet<string>(itemIds);
            var itemsInCache = uniqueItems.Where(i => itemCache.ContainsKey(i)).ToHashSet();

            Console.WriteLine($"Found {uniqueItems.Count} unique items, {itemsInCache.Count} of them in the cache...");

            var itemsToFetch = uniqueItems.Except(itemsInCache).ToList();

            // no need to try fetching stuff from the api, if we already have everything in cache
            if (itemsToFetch.Count > 0)
            {
                Console.WriteLine($"Fetching {itemsToFetch.Count} items from API...");

                var itemsFromApi =
                    await FetchJsonAsync<List<ItemApiResponse>>($"items?ids={string.Join(",", itemsToFetch)}");

                foreach (var item in itemsFromApi)
                {
                    itemCache[item.Id.ToString()] = item;
                }
            }

            foreach (var itemId in itemIds)
            {
                var item = itemCache[itemId];
                var weaponType = item.Details.Type;

                if (string.IsNullOrEmpty(weaponType)) continue;
                if (weaponCounts.TryGetValue(weaponType, out var weaponCountObj))
                {
                    weaponCounts[weaponType] = new WeaponCount(weaponCountObj.Count + 1,
                        [..weaponCountObj.Ids, item.Id]);
                }
                else
                    weaponCounts[weaponType] = new WeaponCount(1, [item.Id]);
            }
        }

        foreach (var weapon in weaponCounts)
        {
            Console.WriteLine(
                $"The weapon type '{weapon.Key}' is equipped {weapon.Value.Count} times across all characters.");
        }
        
        if (args.Contains("--character-details"))
        {
            Console.WriteLine("\nDetailed Character Equipment:");
            foreach (var (charName, itemList) in charItemDict)
            {
                Console.WriteLine($"Character: {charName}");
                foreach (var itemId in itemList)
                {
                    if (itemCache.TryGetValue(itemId.Id.ToString(), out var item))
                    {
                        Console.WriteLine($"  - {item.Name} ({item.Details.Type})");
                    }
                }
            }
        }

        Console.WriteLine();
        Console.WriteLine("Persisting ItemCache...");
        await File.WriteAllTextAsync(Path.Combine(Directory.GetCurrentDirectory(), "ItemCache.json"),
            JsonSerializer.Serialize(itemCache.Values));
        Console.WriteLine("Exported ItemCache... Finished.");
    }

    private static async Task<T> FetchJsonAsync<T>(string url, CancellationToken token = default)
    {
        var response = await client.GetStringAsync(url, token);
        return JsonSerializer.Deserialize<T>(response);
    }
}