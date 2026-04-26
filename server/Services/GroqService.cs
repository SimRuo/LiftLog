using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using server.DTOs;

namespace server.Services;

public record ExerciseInfo(int Id, string Name, string Category);

public class GroqService
{
    private const string Model = "llama-3.3-70b-versatile";
    private const string Endpoint = "https://api.groq.com/openai/v1/chat/completions";

    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions CamelCase = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public GroqService(HttpClient http, IConfiguration config)
    {
        _http = http;
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", config["Groq:ApiKey"]!);
    }

    public async Task<CreatePlanRequest?> GeneratePlan(string description, List<ExerciseInfo> exercises)
    {
        var exerciseList = string.Join("\n", exercises.Select(e => $"ID:{e.Id} | {e.Name} | {e.Category}"));

        var system = """
            You are a professional fitness coach. Generate structured workout plans as JSON.
            Output strictly this shape, no extra keys, no prose:
            {
              "name": string,
              "days": [
                {
                  "name": string,
                  "order": integer (0-based),
                  "exercises": [
                    {
                      "exerciseId": integer (must be from the provided list),
                      "order": integer (0-based),
                      "sets": integer (1-6),
                      "reps": string (e.g. "8-12" or "5"),
                      "weight": number (always 0),
                      "notes": string
                    }
                  ]
                }
              ]
            }
            """;

        var user = $"""
            Create a workout plan based on this request: {description}

            You MUST only use exercises from this exact list (use the exact numeric ID):
            {exerciseList}

            Set weight to 0 for all exercises — the user fills in their own weights.
            Reps can be a range like "8-12" or a single number like "5".
            Sets should be between 1 and 6.
            Order values are 0-based array indexes.
            """;

        var body = new
        {
            model = Model,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user }
            }
        };

        var text = await ChatAsync(body);
        if (string.IsNullOrEmpty(text)) return null;

        return JsonSerializer.Deserialize<CreatePlanRequest>(text, CaseInsensitive);
    }

    public async Task<string> GetAdvice(string message, List<AiChatMessage> history, string? planContext)
    {
        var system = "You are a knowledgeable fitness coach assistant inside LiftLog, a workout tracking app. " +
                     "Help with workout programming, form tips, recovery, nutrition, and general fitness questions. " +
                     "Keep responses concise and practical.";

        if (!string.IsNullOrEmpty(planContext))
            system += $"\n\nThe user's current workout plan:\n{planContext}";

        var messages = new List<object> { new { role = "system", content = system } };
        foreach (var msg in history)
            messages.Add(new { role = msg.Role == "assistant" ? "assistant" : "user", content = msg.Content });
        messages.Add(new { role = "user", content = message });

        var body = new
        {
            model = Model,
            messages
        };

        return await ChatAsync(body) ?? "Sorry, I couldn't generate a response.";
    }

    private async Task<string?> ChatAsync(object body)
    {
        var response = await _http.PostAsJsonAsync(Endpoint, body, CamelCase);
        response.EnsureSuccessStatusCode();
        var parsed = await response.Content.ReadFromJsonAsync<GroqResponse>(CaseInsensitive);
        return parsed?.Choices?[0]?.Message?.Content;
    }
}

file record GroqResponse([property: JsonPropertyName("choices")] GroqChoice[]? Choices);
file record GroqChoice([property: JsonPropertyName("message")] GroqMessage? Message);
file record GroqMessage([property: JsonPropertyName("content")] string? Content);
