
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
- Spanish: ajuanjojjj

# Usage
This bot requires Node.JS 16 or higher.

You will need an `auth.json` file in the same folder as `bot.js` widht the following data:
```JSON
{
	"token": "your bot's authentication token",
 	"master": "your user id",
	"adminServer": "the id of the server where the admin commands will be available, for you",
    "baseWatcherLimit": 25,

	"steamGridDB": "Your SteamGridDB token here, for fetching icons",

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

## Error reporting settings

You can customize which errors are ignored or truncated by created a `errors.json` file.

`errors.json` is a JSON file that can have the following keys:
- `ignore` for rules for ignoring some errors
- `truncate` to only log the error message and not the 
- `downgrade` to log the error as a warning, meaning it could be ignored if the log level is low enough.

Note that an error can be both truncated and downgraded if it matches a rule of both.

The values for these properties is an object that can have the following keys:
- `message` to test the error message
- `status` to test HTTP status codes
- `code` to test Node.JS error codes

The values for these properties are either rules or arrays of rules. A rule is a value to check against. By default, it tests for equality, but you can add a prefix to make other checks:
- `^` to check if it starts with the substring
- `*` to check if it contains the substring
- `$` to check if it ends with the substring
- `<`, `≤`, `>`, `≥`: check if the value is lesser/greater/or equal

If you want to check for equality with those symbols at the beginning, you can escape the prefix with a backslash.

Example: ignore server errors, connection errors and timeouts, truncate "forbidden" errors, truncate and downgrade "not found" errors, downgrade all `fetch` errors (they start with "UND_" because Node uses Undici)
```json
{
	"ignore": {
		"status": ["≥500", 408],
		"message": "read ECONNRESET"
	},
	"truncate": {
		"status": [403, 404]
	},
	"downgrade": {
		"status": 404,
		"code": "^UND_"
	}
}
```

See the `const settings = ...` part in `utils/error.js` to see the default behavior.

## Database schema
Just read steam_news/db.js, there is a bunch of CREATE TABLE at the beginning.

# License
**Steam News** is published under GNU General Public Licence v3 (GPL-3.0). See COPYING.txt, or this link: [https://www.gnu.org/licenses/gpl-3.0.en.html](https://www.gnu.org/licenses/gpl-3.0.en.html)

![GPL](https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/GPLv3_Logo.svg/240px-GPLv3_Logo.svg.png)
