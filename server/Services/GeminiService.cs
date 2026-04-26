using System.Text.Json;
using System.Text.Json.Serialization;
using server.DTOs;

namespace server.Services;

public record ExerciseInfo(int Id, string Name, string Category);

public class GeminiService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private static readonly JsonSerializerOptions CamelCase = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public GeminiService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _apiKey = config["Gemini:ApiKey"]!;
    }

    public async Task<CreatePlanRequest?> GeneratePlan(string description, List<ExerciseInfo> exercises)
    {
        var exerciseList = string.Join("\n", exercises.Select(e => $"ID:{e.Id} | {e.Name} | {e.Category}"));

        var prompt = $"""
            Create a workout plan based on this request: {description}

            You MUST only use exercises from this exact list (use the exact numeric ID):
            {exerciseList}

            Set weight to 0 for all exercises — the user fills in their own weights.
            Reps can be a range like "8-12" or a single number like "5".
            Sets should be between 1 and 6.
            Order values are 0-based array indexes.
            """;

        var schema = new
        {
            type = "OBJECT",
            properties = new
            {
                name = new { type = "STRING" },
                days = new
                {
                    type = "ARRAY",
                    items = new
                    {
                        type = "OBJECT",
                        properties = new
                        {
                            name = new { type = "STRING" },
                            order = new { type = "INTEGER" },
                            exercises = new
                            {
                                type = "ARRAY",
                                items = new
                                {
                                    type = "OBJECT",
                                    properties = new
                                    {
                                        exerciseId = new { type = "INTEGER" },
                                        order = new { type = "INTEGER" },
                                        sets = new { type = "INTEGER" },
                                        reps = new { type = "STRING" },
                                        weight = new { type = "NUMBER" },
                                        notes = new { type = "STRING" }
                                    },
                                    required = new[] { "exerciseId", "order", "sets", "reps", "weight", "notes" }
                                }
                            }
                        },
                        required = new[] { "name", "order", "exercises" }
                    }
                }
            },
            required = new[] { "name", "days" }
        };

        var body = new
        {
            contents = new[] { new { role = "user", parts = new[] { new { text = prompt } } } },
            systemInstruction = new { parts = new[] { new { text = "You are a professional fitness coach. Generate structured workout plans." } } },
            generationConfig = new { responseMimeType = "application/json", responseSchema = schema }
        };

        var response = await _http.PostAsJsonAsync(GeminiUrl(), body, CamelCase);
        response.EnsureSuccessStatusCode();

        var gemini = await response.Content.ReadFromJsonAsync<GeminiResponse>(CaseInsensitive);
        var text = gemini?.Candidates?[0]?.Content?.Parts?[0]?.Text;
        if (text == null) return null;

        return JsonSerializer.Deserialize<CreatePlanRequest>(text, CaseInsensitive);
    }

    public async Task<string> GetAdvice(string message, List<AiChatMessage> history, string? planContext)
    {
        var system = "You are a knowledgeable fitness coach assistant inside LiftLog, a workout tracking app. " +
                     "Help with workout programming, form tips, recovery, nutrition, and general fitness questions. " +
                     "Keep responses concise and practical.";

        if (!string.IsNullOrEmpty(planContext))
            system += $"\n\nThe user's current workout plan:\n{planContext}";

        var contents = new List<object>();
        foreach (var msg in history)
            contents.Add(new { role = msg.Role == "assistant" ? "model" : "user", parts = new[] { new { text = msg.Content } } });
        contents.Add(new { role = "user", parts = new[] { new { text = message } } });

        var body = new
        {
            contents,
            systemInstruction = new { parts = new[] { new { text = system } } }
        };

        var response = await _http.PostAsJsonAsync(GeminiUrl(), body, CamelCase);
        response.EnsureSuccessStatusCode();

        var gemini = await response.Content.ReadFromJsonAsync<GeminiResponse>(CaseInsensitive);
        return gemini?.Candidates?[0]?.Content?.Parts?[0]?.Text ?? "Sorry, I couldn't generate a response.";
    }

    private string GeminiUrl() =>
        $"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={_apiKey}";
}

file record GeminiResponse([property: JsonPropertyName("candidates")] GeminiCandidate[]? Candidates);
file record GeminiCandidate([property: JsonPropertyName("content")] GeminiContent? Content);
file record GeminiContent([property: JsonPropertyName("parts")] GeminiPart[]? Parts);
file record GeminiPart([property: JsonPropertyName("text")] string? Text);
