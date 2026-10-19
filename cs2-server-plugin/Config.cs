using System.Text.Json.Serialization;
using CounterStrikeSharp.API.Core;

namespace CS2SchoolCupTracker;

public class PluginConfig : BasePluginConfig
{
    [JsonPropertyName("ApiUrl")]
    public string ApiUrl { get; set; } = "http://127.0.0.1:5000/api/server/live";

    [JsonPropertyName("ApiEventUrl")]
    public string ApiEventUrl { get; set; } = "http://127.0.0.1:5000/api/server/event";

    [JsonPropertyName("ApiToken")]
    public string ApiToken { get; set; } = "cs2-school-cup-secret-2026";

    [JsonPropertyName("MatchId")]
    public string MatchId { get; set; } = "m5";

    [JsonPropertyName("SyncIntervalSeconds")]
    public float SyncIntervalSeconds { get; set; } = 1.0f;

    [JsonPropertyName("ServerName")]
    public string ServerName { get; set; } = "Школьный CS2 Сервер";
}
