namespace server.Models;

public class CardioActivity
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;

    /// <summary>"distance" or "time" — see CardioMode.</summary>
    public string Mode { get; set; } = string.Empty;

    public bool IsDefault { get; set; }
    public string? CreatedByUserId { get; set; }
}

/// <summary>
/// How an activity is measured, which decides both the fields the logging form
/// offers and the metrics its progress chart can draw.
/// </summary>
public static class CardioMode
{
    /// <summary>Covers ground: duration and distance, so pace is meaningful.</summary>
    public const string Distance = "distance";

    /// <summary>Duration only — jump rope, skipping, anything that goes nowhere.</summary>
    public const string Time = "time";

    /// <summary>
    /// An ordered sequence of other activities — Hyrox and anything like it.
    /// The session carries one total time; each step may carry a split.
    /// </summary>
    public const string Circuit = "circuit";

    public static bool IsValid(string? mode) => mode is Distance or Time or Circuit;
}
