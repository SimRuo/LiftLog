using System.Text.Json;
using System.Text.Json.Serialization;
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
///   - exercise ids are left out too: the model names exercises and the server
///     resolves the names, which is both faster and far more accurate
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

    public async Task<GeneratedPlan?> GeneratePlan(string description, List<ExerciseInfo> catalogue)
    {
        var known = string.Join("\n", catalogue.Select(e => $"{e.Name} ({e.Category})"));

        var system = """
            You are a strength coach transcribing a training plan.

            You will be given a list of known exercises and a description of the
            plan the user wants. Return the plan.

            Naming exercises:
            - If the user names an exercise that appears in the known list, use
              that exact name. Do not substitute a different exercise for one
              that is already in the list.
            - If the user names an exercise that is NOT in the known list, write
              their name for it. It will be added. Never swap in a different
              exercise because the one asked for is missing — a back extension
              is not a squat, and a leg extension is not a leg curl.
            - Set "category" to the muscle group the exercise trains. It is only
              used when the exercise is new.

            The rest:
            - Follow the user's structure exactly: the same number of days, the
              same exercises in the same order, the same sets and reps. If they
              gave you a plan, transcribe it — do not redesign it.
            - If they described a goal rather than a plan, build one. Compounds
              get lower reps, isolations higher. Default to 4 days.
            - Write reps as given, e.g. "5-8" or "10".
            - Put anything else worth keeping in "notes" — loads, stopping
              rules, tempo, "per side", "optional". Otherwise leave it out.
            """;

        var user = $"""
            Known exercises:
            {known}

            The user wants:
            {description}
            """;

        var request = new
        {
            model = _model,
            stream = false,
            // Guarantees the shape and the category vocabulary. Exercise names
            // are free text on purpose — see PlanSchema.
            format = PlanSchema.Build(),
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
            return JsonSerializer.Deserialize<GeneratedPlan>(content, CaseInsensitive);
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
