using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

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
    [JsonPropertyName("details")] public ItemDetail Details { get; set; }
}

public class ItemDetail
{
    [JsonPropertyName("type")] public string Type { get; set; }
}

public class CharacterTemplateItemDetail
{
    public int ItemId { get; set; }
    public string? Template { get; set; }
}

public class CharacterTemplate
{
    public string Name { get; set; }
    public List<CharacterTemplateItemDetail> Details { get; set; }
}

public class LegendaryArmoryItem
{
    [JsonPropertyName("id")] public int Id { get; set; }
}

partial class Program
{
    private static readonly HttpClient Client = new HttpClient();

    private static readonly string[] LegendaryLocations = ["EquippedFromLegendaryArmory", "LegendaryArmory"];

    private static async Task Main(string[] args)
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

            Console.WriteLine($"Loaded {itemCache.Count} items from cache.");
        }
        else
        {
            Console.WriteLine("Not using file cache.");
        }

        var skipLegendaryArmory = args.Contains("--no-legendary");
        var onlyLegendary = args.Contains("--only-legendary");
        var argsAggregate = string.Join(" ", args);
        var legendaryGenerationMatch = LegendaryGenerationRegex().Match(argsAggregate);

        if (onlyLegendary && skipLegendaryArmory)
        {
            Console.WriteLine("Incompatible legendary armory option.");
            return;
        }

        Client.BaseAddress = new Uri("https://api.guildwars2.com/v2/");
        Client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);


        // setup legendary item / generation mapping + cache
        var gen1 = new Dictionary<int, ItemApiResponse>();
        var gen2 = new Dictionary<int, ItemApiResponse>();
        var gen3 = new Dictionary<int, ItemApiResponse>();
        var gen3_5 = new Dictionary<int, ItemApiResponse>();

        if (File.Exists(Path.Combine(Directory.GetCurrentDirectory(), "LgendaryItemPerGeneration.json")))
        {
            await using var fs =
                File.OpenRead(Path.Combine(Directory.GetCurrentDirectory(), "LgendaryItemPerGeneration.json"));
            await foreach (var item in JsonSerializer.DeserializeAsyncEnumerable<ItemApiResponse>(fs))
            {
                if (item != null)
                {
                    switch (item.Id)
                    {
                        case < 71383:
                            gen1.Add(item.Id, item);
                            break;
                        case <= 90551:
                            gen2.Add(item.Id, item);
                            break;
                        case < 103815:
                            gen3.Add(item.Id, item);
                            break;
                        case 103815:
                            gen3_5.Add(item.Id, item);
                            break;
                        default:
                            Console.WriteLine($"What is this? {item.Id}.");
                            break;
                    }
                }
            }

            Console.WriteLine($"Loaded Legendary items from cache.");
        }
        else
        {
            Console.WriteLine("Not using file cache.");
            var legendaryArmory = await FetchJsonAsync<List<LegendaryArmoryItem>>("legendaryarmory?ids=all");
            var legendaryItemIds = string.Join(",", legendaryArmory.Select(x => x.Id));
            var legendaryItems = await FetchJsonAsync<List<ItemApiResponse>>($"items?ids={legendaryItemIds}");
            legendaryItems = legendaryItems.Where(item => item.Type == "Weapon").OrderBy(x => x.Id).ToList();
            await File.WriteAllTextAsync(
                Path.Combine(Directory.GetCurrentDirectory(), "LgendaryItemPerGeneration.json"),
                JsonSerializer.Serialize(legendaryItems));
        }


        // gen1 < 71383, gen2 < 90551, gen 3 < 103815, gen3.5 == 103815
        Console.WriteLine("Fetching characters...");

        var characterNames = await FetchJsonAsync<List<string>>("characters");
        if (characterNames == null)
        {
            Console.WriteLine("No characters found.");
            return;
        }

        Console.WriteLine($"Found {characterNames.Count} characters...");

        var weaponCounts = new Dictionary<string, WeaponCount>();
        var itemIds = new ConcurrentBag<string>();

        var charItemDict = new Dictionary<string, List<CharacterTemplateItemDetail>>();
        var templateQueue = new ConcurrentQueue<CharacterTemplate>();

        await Parallel.ForEachAsync(characterNames, async (charName, cancelToken) =>
        {
            try
            {
                Console.WriteLine($"Fetching data for character {charName}...");
                var charData =
                    await FetchJsonAsync<JsonElement>(
                        $"characters/{Uri.EscapeDataString(charName)}/equipmenttabs?tabs=all", cancelToken);

                var templateId = 1;
                foreach (var equipmentTab in charData.EnumerateArray())
                {
                    var name = equipmentTab.GetProperty("name").GetString() ?? templateId.ToString();

                    Console.WriteLine($"Processing Equipment Template {name} in character {charName}...");
                    if (!equipmentTab.TryGetProperty("equipment", out var equipment)) continue;

                    List<ItemInTemplate>? items;
                    try
                    {
                        items = JsonSerializer.Deserialize<List<ItemInTemplate>>(equipment.GetRawText());
                    }
                    catch (JsonException)
                    {
                        Console.WriteLine($"Failed to deserialize equipment data for {charName}.");
                        items = [];
                    }

                    if (items is null or { Count: 0 }) continue;

                    var weapons = items.Where(item => item.Slot.Contains("Weapon") && !item.Slot.Contains("Aquatic"))
                        .ToList();

                    Console.WriteLine($"Found {weapons.Count} weapons...");

                    if (skipLegendaryArmory)
                    {
                        weapons = weapons.Where(w => !LegendaryLocations.Contains(w.Location)).ToList();
                    }

                    if (onlyLegendary)
                    {
                        weapons = weapons.Where(w => LegendaryLocations.Contains(w.Location)).ToList();
                    }

                    if (legendaryGenerationMatch.Success)
                    {
                        var group = legendaryGenerationMatch.Groups[^1];
                        switch (group.Value)
                        {
                            case "1":
                                weapons = weapons.Where(w => gen1.ContainsKey(w.Id)).ToList();
                                break;
                            case "2":
                                weapons = weapons.Where(w => gen2.ContainsKey(w.Id)).ToList();
                                break;
                            case "3":
                                weapons = weapons.Where(w => gen3.ContainsKey(w.Id)).ToList();
                                break;
                            case "3_5":
                                weapons = weapons.Where(w => gen3_5.ContainsKey(w.Id)).ToList();
                                break;
                            default:
                                Console.WriteLine($"Unrecognized legendary generation: {group.Value}");
                                break;
                        }
                    }

                    weapons.ForEach(w => itemIds.Add(w.Id.ToString()));

                    // lock (itemIds)
                    // {
                    //     itemIds.AddRange(weapons.Select(w => w.Id.ToString()));
                    // }

                    templateQueue.Enqueue(new CharacterTemplate
                    {
                        Name = charName,
                        Details = weapons.Select(w => new CharacterTemplateItemDetail
                        {
                            ItemId = w.Id,
                            Template = string.IsNullOrEmpty(name) ? templateId.ToString() : name
                        }).ToList(),
                    });
                    templateId++;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
            }
        });

        if (itemIds.Count > 0)
        {
            var uniqueItems = new HashSet<string>(itemIds);
            var itemsInCache = itemCache.Keys.ToHashSet();

            Console.WriteLine(
                $"Found {uniqueItems.Count} unique items, {(itemsInCache.Intersect(uniqueItems).Count().ToString())} of them in the cache...");

            var itemsToFetch = uniqueItems.Except(itemsInCache).ToList();

            if (itemsToFetch.Count > 0)
            {
                Console.WriteLine($"Fetching {itemsToFetch.Count} items from API...");
                try
                {
                    var itemsFromApi =
                        await FetchJsonAsync<List<ItemApiResponse>>($"items?ids={string.Join(",", itemsToFetch)}");

                    if (itemsFromApi != null)
                    {
                        foreach (var item in itemsFromApi)
                        {
                            var key = item.Id.ToString();
                            itemCache[key] = item;
                        }
                    }
                }
                catch (Exception e)
                {
                    Console.WriteLine($"Error fetching items: {e.Message}");
                }
            }

            foreach (var itemId in itemIds)
            {
                if (!itemCache.TryGetValue(itemId, out var item)) continue;

                var weaponType = item.Details.Type;

                if (string.IsNullOrEmpty(weaponType)) continue;

                if (!weaponCounts.TryGetValue(weaponType, out var count))
                {
                    weaponCounts[weaponType] = new WeaponCount(1, [item.Id]);
                }
                else
                {
                    weaponCounts[weaponType] = new WeaponCount(count.Count + 1,
                        [..count.Ids, item.Id]);
                }
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

            while (templateQueue.TryDequeue(out var template))
            {
                if (!charItemDict.TryGetValue(template.Name, out var value))
                {
                    charItemDict.Add(template.Name, template.Details);
                }
                else
                {
                    value.AddRange(template.Details);
                }
            }

            foreach (var kvPair in charItemDict)
            {
                Console.WriteLine($"Character: {kvPair.Key}");
                foreach (var detail in kvPair.Value)
                {
                    Console.WriteLine(itemCache.TryGetValue(detail.ItemId.ToString(), out var item)
                        ? $"  - {item.Name} ({item.Details.Type} [Template '{detail.Template}'])"
                        : $"  - Item ID {detail.ItemId}: Not found in cache.");
                }
            }
        }

        try
        {
            Console.WriteLine();
            Console.WriteLine("Persisting ItemCache...");
            await File.WriteAllTextAsync(Path.Combine(Directory.GetCurrentDirectory(), "ItemCache.json"),
                JsonSerializer.Serialize(itemCache.Values));
            Console.WriteLine("Exported ItemCache... Finished.");
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error saving cache: {e.Message}");
        }
    }

    private static async Task<T?> FetchJsonAsync<T>(string url, CancellationToken token = default)
    {
        try
        {
            var response = await Client.GetAsync(url, token);
            if (!response.IsSuccessStatusCode) return default;

            var json = await response.Content.ReadAsStringAsync(token);
            return JsonSerializer.Deserialize<T>(json);
        }
        catch (Exception e)
        {
            Console.WriteLine($"Error fetching {url}: {e.Message}");
            return default;
        }
    }

    [GeneratedRegex(@"--only-legendary-gen(\d_?\d?)")]
    private static partial Regex LegendaryGenerationRegex();
}