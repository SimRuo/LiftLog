namespace server.DTOs;

public class GeneratePlanRequest
{
    public string Description { get; set; } = string.Empty;
}

public class AdviceRequest
{
    public string Message { get; set; } = string.Empty;
    public List<AiChatMessage> History { get; set; } = new();
}

public class AdviceResponse
{
    public string Message { get; set; } = string.Empty;
}

public class AiChatMessage
{
    public string Role { get; set; } = string.Empty; // "user" or "assistant"
    public string Content { get; set; } = string.Empty;
}
