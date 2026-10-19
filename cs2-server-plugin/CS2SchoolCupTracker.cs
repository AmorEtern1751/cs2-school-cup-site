using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using CounterStrikeSharp.API;
using CounterStrikeSharp.API.Core;
using CounterStrikeSharp.API.Core.Attributes;
using CounterStrikeSharp.API.Core.Attributes.Registration;
using CounterStrikeSharp.API.Modules.Commands;
using CounterStrikeSharp.API.Modules.Cvars;
using CounterStrikeSharp.API.Modules.Timers;
using CounterStrikeSharp.API.Modules.Utils;

namespace CS2SchoolCupTracker;

[MinimumApiVersion(180)]
public class CS2SchoolCupTracker : BasePlugin, IPluginConfig<PluginConfig>
{
    public override string ModuleName => "CS2 School Cup Tracker";
    public override string ModuleVersion => "1.0.0";
    public override string ModuleAuthor => "CS2 School Tournament";
    public override string ModuleDescription => "Real-time CS2 tournament live score and statistics tracker";

    public PluginConfig Config { get; set; } = new();

    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(3) };
    private CounterStrikeSharp.API.Modules.Timers.Timer? _syncTimer;
    private readonly ConcurrentDictionary<ulong, int> _playerDamage = new();
    private readonly ConcurrentDictionary<ulong, int> _playerHeadshots = new();
    private readonly List<object> _roundHistory = new();

    private string _currentBombState = "none";
    private string? _currentBombSite = null;
    private long? _bombPlantedTime = null;
    private string? _bombPlanter = null;

    public void OnConfigParsed(PluginConfig config)
    {
        Config = config;
    }

    public override void Load(bool hotReload)
    {
        RegisterEventHandler<EventRoundStart>(OnRoundStart);
        RegisterEventHandler<EventRoundEnd>(OnRoundEnd);
        RegisterEventHandler<EventPlayerDeath>(OnPlayerDeath);
        RegisterEventHandler<EventPlayerHurt>(OnPlayerHurt);
        RegisterEventHandler<EventBombPlanted>(OnBombPlanted);
        RegisterEventHandler<EventBombDefused>(OnBombDefused);
        RegisterEventHandler<EventBombExploded>(OnBombExploded);
        RegisterEventHandler<EventRoundMvp>(OnRoundMvp);
        RegisterEventHandler<EventCsWinPanelMatch>(OnMatchEnd);

        _syncTimer = AddTimer(Math.Max(0.5f, Config.SyncIntervalSeconds), OnPeriodicSync, TimerFlags.REPEAT);

        Console.WriteLine($"[CS2SchoolCupTracker] Плагин успешно загружен! Матч: {Config.MatchId}, API: {Config.ApiUrl}");
    }

    public override void Unload(bool hotReload)
    {
        _syncTimer?.Kill();
        _httpClient.Dispose();
    }

    private void OnPeriodicSync()
    {
        try
        {
            SendFullStateUpdate();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[CS2SchoolCupTracker] Ошибка синхронизации: {ex.Message}");
        }
    }

    private HookResult OnRoundStart(EventRoundStart @event, GameEventInfo info)
    {
        _currentBombState = "none";
        _currentBombSite = null;
        _bombPlantedTime = null;
        _bombPlanter = null;

        SendFullStateUpdate(phase: "live");
        return HookResult.Continue;
    }

    private HookResult OnRoundEnd(EventRoundEnd @event, GameEventInfo info)
    {
        var winnerTeam = (CsTeam)@event.Winner;
        string winner = winnerTeam == CsTeam.CounterTerrorist ? "CT" : "T";
        string reason = @event.Reason switch
        {
            1 => "defused",
            7 => "exploded",
            8 => "elimination",
            _ => "elimination"
        };

        var teamManager = Utilities.FindAllEntitiesByDesignerName<CCSTeam>("cs_team_manager");
        int ctScore = 0;
        int tScore = 0;
        foreach (var team in teamManager)
        {
            if (team.TeamNum == (int)CsTeam.CounterTerrorist) ctScore = team.Score;
            else if (team.TeamNum == (int)CsTeam.Terrorist) tScore = team.Score;
        }

        var roundItem = new
        {
            round = ctScore + tScore,
            winner = winner,
            reason = reason,
            scoreCT = ctScore,
            scoreT = tScore
        };
        _roundHistory.Add(roundItem);

        SendEvent("round", $"Раунд завершён! Победа {winner}. Счёт: {ctScore} : {tScore}");
        SendFullStateUpdate(phase: "round_ended");
        return HookResult.Continue;
    }

    private HookResult OnPlayerHurt(EventPlayerHurt @event, GameEventInfo info)
    {
        var attacker = @event.Attacker;
        if (attacker != null && attacker.IsValid && !attacker.IsBot && attacker.AuthorizedSteamID != null)
        {
            ulong steamId = attacker.AuthorizedSteamID.SteamId64;
            int dmg = @event.DmgHealth;
            _playerDamage.AddOrUpdate(steamId, dmg, (_, current) => current + dmg);
        }
        return HookResult.Continue;
    }

    private HookResult OnPlayerDeath(EventPlayerDeath @event, GameEventInfo info)
    {
        var attacker = @event.Attacker;
        var victim = @event.Userid;

        if (victim != null && victim.IsValid)
        {
            string attackerName = attacker?.PlayerName ?? "Мир";
            string victimName = victim.PlayerName;
            string weapon = @event.Weapon;
            bool headshot = @event.Headshot;

            if (attacker != null && attacker.IsValid && !attacker.IsBot && attacker.AuthorizedSteamID != null)
            {
                if (headshot)
                {
                    _playerHeadshots.AddOrUpdate(attacker.AuthorizedSteamID.SteamId64, 1, (_, current) => current + 1);
                }
            }

            string headshotText = headshot ? ", в голову" : "";
            SendEvent("kill", $"{attackerName} ликвидировал {victimName} ({weapon}{headshotText})",
                attackerName: attackerName,
                attackerTeam: attacker?.Team == CsTeam.CounterTerrorist ? "CT" : "T",
                victimName: victimName,
                victimTeam: victim.Team == CsTeam.CounterTerrorist ? "CT" : "T",
                weapon: weapon,
                headshot: headshot);
        }

        SendFullStateUpdate();
        return HookResult.Continue;
    }

    private HookResult OnBombPlanted(EventBombPlanted @event, GameEventInfo info)
    {
        var planter = @event.Userid;
        _currentBombState = "planted";
        _currentBombSite = @event.Site == 0 ? "A" : "B";
        _bombPlantedTime = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        _bombPlanter = planter?.PlayerName;

        SendEvent("bomb", $"Бомба заложена на пленте {_currentBombSite} игроком {_bombPlanter}!");
        SendFullStateUpdate(phase: "bomb_planted");
        return HookResult.Continue;
    }

    private HookResult OnBombDefused(EventBombDefused @event, GameEventInfo info)
    {
        var defuser = @event.Userid;
        _currentBombState = "defused";
        SendEvent("bomb", $"Бомба успешно обезврежена игроком {defuser?.PlayerName}!");
        SendFullStateUpdate();
        return HookResult.Continue;
    }

    private HookResult OnBombExploded(EventBombExploded @event, GameEventInfo info)
    {
        _currentBombState = "exploded";
        SendEvent("bomb", "Бомба взорвана!");
        SendFullStateUpdate();
        return HookResult.Continue;
    }

    private HookResult OnRoundMvp(EventRoundMvp @event, GameEventInfo info)
    {
        var player = @event.Userid;
        if (player != null && player.IsValid)
        {
            SendEvent("info", $"MVP раунда: {player.PlayerName}");
        }
        return HookResult.Continue;
    }

    private HookResult OnMatchEnd(EventCsWinPanelMatch @event, GameEventInfo info)
    {
        SendEvent("info", "Матч подошёл к концу!");
        SendFullStateUpdate(phase: "game_over");
        return HookResult.Continue;
    }

    private void SendFullStateUpdate(string? phase = null)
    {
        var players = new List<object>();
        int ctScore = 0;
        int tScore = 0;

        var teamManager = Utilities.FindAllEntitiesByDesignerName<CCSTeam>("cs_team_manager");
        foreach (var team in teamManager)
        {
            if (team.TeamNum == (int)CsTeam.CounterTerrorist) ctScore = team.Score;
            else if (team.TeamNum == (int)CsTeam.Terrorist) tScore = team.Score;
        }

        int totalRounds = ctScore + tScore;

        foreach (var player in Utilities.GetPlayers())
        {
            if (!player.IsValid || player.IsBot || player.IsHLTV) continue;
            var team = player.Team;
            if (team != CsTeam.CounterTerrorist && team != CsTeam.Terrorist) continue;

            ulong steamId = player.AuthorizedSteamID?.SteamId64 ?? 0;
            var pawn = player.PlayerPawn.Value;
            var stats = player.ActionTrackingServices?.MatchStats;

            int health = pawn != null && pawn.LifeState == (byte)LifeState_t.LIFE_ALIVE ? pawn.Health : 0;
            int armor = pawn?.ArmorValue ?? 0;
            bool isAlive = health > 0;
            int kills = stats?.Kills ?? 0;
            int deaths = stats?.Deaths ?? 0;
            int assists = stats?.Assists ?? 0;
            int mvps = player.MVPs;
            int damage = _playerDamage.TryGetValue(steamId, out var dmg) ? dmg : (stats?.Damage ?? 0);
            int headshots = _playerHeadshots.TryGetValue(steamId, out var hs) ? hs : (stats?.HeadShotKills ?? 0);
            int adr = totalRounds > 0 ? (int)Math.Round((double)damage / totalRounds) : damage;
            int hsPercentage = kills > 0 ? (int)Math.Round((double)headshots / kills * 100) : 0;

            string activeWeapon = pawn?.WeaponServices?.ActiveWeapon.Value?.DesignerName?.Replace("weapon_", "") ?? "unknown";

            players.Add(new
            {
                steamId = steamId.ToString(),
                name = player.PlayerName,
                team = team == CsTeam.CounterTerrorist ? "CT" : "T",
                health = health,
                armor = armor,
                hasHelmet = pawn?.ItemServices != null,
                hasDefuser = pawn?.ItemServices != null,
                isAlive = isAlive,
                money = player.InGameMoneyServices?.Account ?? 0,
                kills = kills,
                deaths = deaths,
                assists = assists,
                damage = damage,
                adr = adr,
                headshots = headshots,
                hsPercentage = hsPercentage,
                mvps = mvps,
                primaryWeapon = activeWeapon,
                ping = player.Ping
            });
        }

        var mapName = Server.MapName;
        var payload = new
        {
            matchId = Config.MatchId,
            serverName = Config.ServerName,
            map = mapName,
            currentRound = totalRounds + 1,
            phase = phase ?? "live",
            teamCT = new { score = ctScore },
            teamT = new { score = tScore },
            bomb = new
            {
                state = _currentBombState == "none" ? null : _currentBombState,
                site = _currentBombSite,
                plantedAt = _bombPlantedTime,
                planterName = _bombPlanter
            },
            players = players,
            roundHistory = _roundHistory
        };

        PostJsonAsync(Config.ApiUrl, payload);
    }

    private void SendEvent(string type, string text, string? attackerName = null, string? attackerTeam = null, string? victimName = null, string? victimTeam = null, string? weapon = null, bool headshot = false)
    {
        var payload = new
        {
            type = type,
            text = text,
            attackerName = attackerName,
            attackerTeam = attackerTeam,
            victimName = victimName,
            victimTeam = victimTeam,
            weapon = weapon,
            headshot = headshot
        };
        PostJsonAsync(Config.ApiEventUrl, payload);
    }

    private void PostJsonAsync(string url, object data)
    {
        if (string.IsNullOrWhiteSpace(url)) return;

        Task.Run(async () =>
        {
            try
            {
                string json = JsonSerializer.Serialize(data);
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = new StringContent(json, Encoding.UTF8, "application/json")
                };

                if (!string.IsNullOrWhiteSpace(Config.ApiToken))
                {
                    request.Headers.Add("X-Server-Token", Config.ApiToken);
                }

                using var response = await _httpClient.SendAsync(request);
            }
            catch (Exception ex)
            {
                // Silent fail or low-priority log to avoid spamming server console
            }
        });
    }

    [ConsoleCommand("css_cup_match", "Привязать ID матча турнира (например, css_cup_match m5)")]
    [CommandHelper(minArgs: 1, usage: "<id_матча>")]
    public void OnCommandMatch(CCSPlayerController? player, CommandInfo command)
    {
        Config.MatchId = command.GetArg(1);
        command.ReplyToCommand($"[CS2 Cup] Матч успешно изменён на: {Config.MatchId}");
        SendFullStateUpdate();
    }

    [ConsoleCommand("css_cup_sync", "Принудительно отправить обновление на сайт")]
    public void OnCommandSync(CCSPlayerController? player, CommandInfo command)
    {
        SendFullStateUpdate();
        command.ReplyToCommand("[CS2 Cup] Состояние синхронизировано с сайтом турнира.");
    }

    [ConsoleCommand("css_cup_status", "Проверить настройки подключения к турниру")]
    public void OnCommandStatus(CCSPlayerController? player, CommandInfo command)
    {
        command.ReplyToCommand($"[CS2 Cup] Текущий матч: {Config.MatchId} | API: {Config.ApiUrl} | Токен: {(string.IsNullOrEmpty(Config.ApiToken) ? "не задан" : "задан")}");
    }
}
