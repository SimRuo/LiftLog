using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using server.DTOs;

namespace server.Services;

/// <summary>
/// The previous hosted path, kept behind the `Ai:Provider` switch so the local
/// model can be compared against it without a redeploy. The advice chat this
/// service also used to serve has been removed — a small local model is a poor
/// substitute for open-ended coaching, so rather than ship a worse version of
/// it, it's gone.
///
/// Note the difference in approach: with no grammar available, the response
/// shape has to be described in prose and the exercise IDs merely requested,
/// which is why this path needs a 70B model to be reliable and still gets
/// filtered by the caller afterwards.
/// </summary>
public class GroqPlanGenerator : IPlanGenerator
{
    private const string Endpoint = "https://api.groq.com/openai/v1/chat/completions";

    private readonly HttpClient _http;
    private readonly string _model;
    private static readonly JsonSerializerOptions CamelCase = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public GroqPlanGenerator(HttpClient http, IConfiguration config)
    {
        _http = http;
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", config["Groq:ApiKey"]);
        _model = config["Groq:Model"] ?? "llama-3.3-70b-versatile";
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
            model = _model,
            response_format = new { type = "json_object" },
            messages = new[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user }
            }
        };

        var response = await _http.PostAsJsonAsync(Endpoint, body, CamelCase);
        response.EnsureSuccessStatusCode();
        var parsed = await response.Content.ReadFromJsonAsync<GroqResponse>(CaseInsensitive);
        var text = parsed?.Choices?[0]?.Message?.Content;

        return string.IsNullOrEmpty(text)
            ? null
            : JsonSerializer.Deserialize<CreatePlanRequest>(text, CaseInsensitive);
    }
}

file record GroqResponse([property: JsonPropertyName("choices")] GroqChoice[]? Choices);
file record GroqChoice([property: JsonPropertyName("message")] GroqMessage? Message);
file record GroqMessage([property: JsonPropertyName("content")] string? Content);
