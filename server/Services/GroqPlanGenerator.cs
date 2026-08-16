using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace server.Services;

/// <summary>
/// The hosted path, kept behind the `Ai:Provider` switch so the local model can
/// be compared against it without a redeploy.
///
/// Same contract as the local generator — names out, resolved server-side —
/// but the shape has to be described in prose because there is no grammar to
/// enforce it, which is why this path wants a large model and still can't
/// promise the response parses.
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

    public async Task<GeneratedPlan?> GeneratePlan(string description, List<ExerciseInfo> catalogue)
    {
        var known = string.Join("\n", catalogue.Select(e => $"{e.Name} ({e.Category})"));
        var categories = string.Join(", ", PlanSchema.Categories);

        var system = $$"""
            You are a strength coach transcribing a training plan.
            Output strictly this shape, no extra keys, no prose:
            {
              "name": string,
              "days": [
                {
                  "name": string,
                  "exercises": [
                    {
                      "exercise": string,
                      "category": one of [{{categories}}],
                      "sets": integer,
                      "reps": string (e.g. "8-12" or "5"),
                      "notes": string (optional)
                    }
                  ]
                }
              ]
            }
            """;

        var user = $"""
            Known exercises:
            {known}

            The user wants:
            {description}

            If an exercise the user names is in the known list, use that exact
            name. If it is not, write their name for it — it will be added.
            Never substitute a different exercise for a missing one.

            Follow the user's structure exactly if they gave you one. Put loads,
            stopping rules and other detail in "notes".
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
            : JsonSerializer.Deserialize<GeneratedPlan>(text, CaseInsensitive);
    }
}

file record GroqResponse([property: JsonPropertyName("choices")] GroqChoice[]? Choices);
file record GroqChoice([property: JsonPropertyName("message")] GroqMessage? Message);
file record GroqMessage([property: JsonPropertyName("content")] string? Content);
