using System.Text.Json;
using System.Text.Json.Serialization;
using server.DTOs;

namespace server.Services;

/// <summary>
/// Plan generation against a self-hosted Ollama instance.
///
/// Sized for a CPU-only box: a ~4B model at Q4 generates roughly ten tokens a
/// second there, so the design goal throughout is to make the model emit as
/// few tokens as possible and to make every one of them count.
///   - the response shape is enforced by <see cref="PlanSchema"/> rather than
///     described in prose, which removes both the retry loop and most of the
///     system prompt
///   - `order` and `weight` are left out of the schema entirely; the caller
///     assigns order from array position and weight is always 0, so having the
///     model write them would be pure latency
/// </summary>
public class OllamaPlanGenerator : IPlanGenerator
{
    private readonly HttpClient _http;
    private readonly ILogger<OllamaPlanGenerator> _log;
    private readonly string _model;
    private readonly string _keepAlive;
    private readonly int _contextTokens;

    private static readonly JsonSerializerOptions CaseInsensitive = new() { PropertyNameCaseInsensitive = true };

    public OllamaPlanGenerator(HttpClient http, IConfiguration config, ILogger<OllamaPlanGenerator> log)
    {
        _http = http;
        _log = log;
        _http.BaseAddress = new Uri(config["Ollama:BaseUrl"] ?? "http://ollama:11434");
        // Generation on CPU is slow enough that the default 100s HttpClient
        // timeout would abort a perfectly healthy six-day plan partway through.
        _http.Timeout = TimeSpan.FromMinutes(10);

        _model = config["Ollama:Model"] ?? "qwen3:4b-instruct";
        // Short, because this is a feature someone uses when they change
        // programme — roughly monthly. Holding 2.5GB resident between those is
        // worse value than paying a few seconds to reload it.
        _keepAlive = config["Ollama:KeepAlive"] ?? "2m";
        // Ollama defaults to a 2048-token context, which a long exercise
        // catalogue plus a six-day plan will silently overrun — the front of
        // the prompt falls out of the window and the model starts inventing.
        _contextTokens = int.TryParse(config["Ollama:ContextTokens"], out var n) ? n : 8192;
    }

    public async Task<CreatePlanRequest?> GeneratePlan(string description, List<ExerciseInfo> exercises)
    {
        var catalogue = string.Join("\n", exercises.Select(e => $"{e.Id}\t{e.Name}\t{e.Category}"));

        var system = """
            You are a strength coach building a training plan.

            You will be given a catalogue of available exercises as
            "id<TAB>name<TAB>muscle group" lines, and a description of what the
            user wants. Build a plan that matches the description.

            Rules:
            - Use only exercises from the catalogue.
            - Name each day for what it trains, e.g. "Push A" or "Lower — quads".
            - Pick a rep range appropriate to the exercise and the user's goal.
              Compounds lower, isolations higher. Write it as "5-8" or "10".
            - Respect the number of days and the weekly structure the user asks
              for. If they don't say, use 4 days.
            - Use the notes field only when there is a real cue worth recording,
              such as a stopping rule or a tempo. Otherwise leave it out.
            """;

        var user = $"""
            Available exercises:
            {catalogue}

            The user wants:
            {description}
            """;

        var request = new
        {
            model = _model,
            stream = false,
            // The grammar is built from this user's actual exercise IDs, so a
            // hallucinated exercise is not a thing the sampler can produce.
            format = PlanSchema.Build(exercises.Select(e => e.Id)),
            keep_alive = _keepAlive,
            options = new
            {
                num_ctx = _contextTokens,
                // Enough for a six-day plan with room to spare; a cap means a
                // degenerate repetition loop fails in a minute rather than
                // occupying the box until the HTTP timeout.
                num_predict = 2048,
                temperature = 0.6,
            },
            messages = new[]
            {
                new { role = "system", content = system },
                new { role = "user", content = user }
            }
        };

        var started = DateTime.UtcNow;
        var response = await _http.PostAsJsonAsync("/api/chat", request);

        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync();
            _log.LogError("Ollama returned {Status}: {Detail}", response.StatusCode, detail);
            throw new HttpRequestException(
                $"The local model service returned {(int)response.StatusCode}. Is the '{_model}' model pulled?");
        }

        var parsed = await response.Content.ReadFromJsonAsync<OllamaChatResponse>(CaseInsensitive);
        var content = parsed?.Message?.Content;

        _log.LogInformation(
            "Generated plan with {Model} in {Seconds:F1}s ({Tokens} tokens)",
            _model, (DateTime.UtcNow - started).TotalSeconds, parsed?.EvalCount ?? 0);

        if (string.IsNullOrWhiteSpace(content)) return null;

        try
        {
            return JsonSerializer.Deserialize<CreatePlanRequest>(content, CaseInsensitive);
        }
        catch (JsonException ex)
        {
            // Should be unreachable while the schema is in force, so if it
            // happens the schema and the DTO have drifted apart.
            _log.LogError(ex, "Schema-constrained output failed to deserialize: {Content}", content);
            return null;
        }
    }
}

file record OllamaChatResponse(
    [property: JsonPropertyName("message")] OllamaMessage? Message,
    [property: JsonPropertyName("eval_count")] int? EvalCount);

file record OllamaMessage([property: JsonPropertyName("content")] string? Content);
