# Плагин CS2SchoolCupTracker для CounterStrikeSharp

Плагин для сервера Counter-Strike 2, который передаёт счёт матча в реальном времени, раунды, статус бомбы, убийства и детальную статистику каждого игрока (K/D/A, урон, ADR, % хедшотов, MVP, здоровье и экипировку) на сайт школьного турнира CS2.

---

## 🚀 Быстрая установка на CS2 сервер

### Требования
1. Сервер **Counter-Strike 2** с установленным **Metamod:Source** и **CounterStrikeSharp** (версия v180+ или новее).
2. На сервере или компьютере сборки установлен **.NET 8.0 SDK** (для сборки из исходников).

### Шаг 1. Сборка плагина
1. Откройте терминал в папке `cs2-server-plugin`:
   ```bash
   dotnet build -c Release
   ```
2. В папке `bin/Release/net8.0/` появится файл `CS2SchoolCupTracker.dll`.

### Шаг 2. Размещение на сервере
1. На вашем CS2 сервере перейдите в директорию:
   `game/csgo/addons/counterstrikesharp/plugins/`
2. Создайте папку `CS2SchoolCupTracker`:
   `game/csgo/addons/counterstrikesharp/plugins/CS2SchoolCupTracker/`
3. Скопируйте туда собранный `CS2SchoolCupTracker.dll`.

### Шаг 3. Настройка конфигурации
После первой загрузки сервера (или вручную) создастся конфигурационный файл:
`game/csgo/addons/counterstrikesharp/configs/plugins/CS2SchoolCupTracker/CS2SchoolCupTracker.json`

Укажите в нём адрес вашего запущенного сайта турнира и секретный токен:

```json
{
  "ApiUrl": "http://IP_ВАШЕГО_САЙТА:5000/api/server/live",
  "ApiEventUrl": "http://IP_ВАШЕГО_САЙТА:5000/api/server/event",
  "ApiToken": "cs2-school-cup-secret-2026",
  "MatchId": "m5",
  "SyncIntervalSeconds": 1.0,
  "ServerName": "Школьный CS2 Сервер"
}
```

> **Примечание:** Если сайт и сервер на одной машине, можно использовать `http://127.0.0.1:5000/api/server/live`. Если сайт на хостинге/VDS, укажите внешний IP или домен сервера.

---

## 🎮 Консольные команды в игре / на сервере

| Команда | Описание | Пример |
|---|---|---|
| `css_cup_match <id>` | Привязать текущую игру к конкретному матчу в турнирной сетке | `css_cup_match m5` |
| `css_cup_sync` | Немедленно отправить полное состояние матча на сайт | `css_cup_sync` |
| `css_cup_status` | Показать статус подключения к API сайта и текущий матч | `css_cup_status` |

---

## ⚡ Альтернатива: Использование MatchZy (если MatchZy уже стоит на сервере)

Если на вашем сервере турниров уже установлен популярный плагин **MatchZy**, наш бэкенд сайта поддерживает его вебхуки из коробки!

Просто пропишите в `server.cfg` или конфиге MatchZy:
```cfg
matchzy_webhook_url "http://IP_ВАШЕГО_САЙТА:5000/api/server/matchzy"
```
Сайт будет автоматически перехватывать события раундов, счёта и фрагов от MatchZy.
