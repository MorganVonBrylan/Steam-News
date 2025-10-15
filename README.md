
# Steam News

[![Discord Bots](https://top.gg/api/widget/status/929757212841226292.svg)](https://top.gg/bot/929757212841226292)
[![Discord Bots](https://top.gg/api/widget/servers/929757212841226292.svg)](https://top.gg/bot/929757212841226292)
[![Discord Bots](https://top.gg/api/widget/upvotes/929757212841226292.svg)](https://top.gg/bot/929757212841226292)

This bot allows you to watch Steam game news. My friend Damn3d had the idea.

Do check out [Steam Watch](https://github.com/dukeofsussex/SteamWatch) by DukeOfSussex as well.

### Translation credits

- French: Morgân von Brylân
- German: jemand2001
- Russian: B1ngell

# Usage
This bot requires Node.JS 16 or higher.

You will need an `auth.json` file in the same folder as `bot.js` widht the following data:
```JSON
{
	"token": "your bot's authentication token",
 	"master": "your user id",
	"adminServer": "the id of the server where the admin commands will be available, for you",
    "baseWatcherLimit": 25,

	"topGG": {
		"token": "(optional) your bot's Top.gg token",
		"webhook": {
			"port": 5050,
			"password": "your password here"
		},
		"voteWatcherBonus": 25
	},
	"debug": false,
	"logLevel": "warn",
	"backups": false,

	"supportServer": "(optional) The invite to your support server",
    "premium": {
		"sku": "the 'more watchers' SKU id",
		"bonus": 250,
		"rebrand": "the 'rebrand' SKU id"
    },
	"donate": "(optional) The URL for donations"
}
```
`debug` should be `true` in development and `false` (or not set) in production. In debug mode, commands are created as server commands for quicker updating. They are global commands otherwise. Also, commands under the `debug` subfolder are ignored unless in debug mode.

If the webhook port is not specified, the `SERVER_PORT` environment variable will be used instead.

The `logLevel` can be "silent", "error", "warn", "log" or "verbose". If not set, defaults to "warn". **Note:** if `debug` is `true`, the log level is forcefully set to "verbose".

`backups` assigns the backup schedule. Possible values are `false`, `"daily"` and `"weekly"`. Weekly is every Sunday at midnight. If omitted or null, defaults to "weekly". If the `BACKUP_SCHEDULE` environment variable is set, it will have priority.

The `premium` category is optional.

To start the bot, run `node bot.js`

## Database schema
Just read steam_news/db.js, there is a bunch of CREATE TABLE at the beginning.

# License
**Steam News** is published under GNU General Public Licence v3 (GPL-3.0). See COPYING.txt, or this link: [https://www.gnu.org/licenses/gpl-3.0.en.html](https://www.gnu.org/licenses/gpl-3.0.en.html)

![GPL](https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/GPLv3_Logo.svg/240px-GPLv3_Logo.svg.png)
