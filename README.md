
# Steam News

Current version: 2.0

This bot allows you to watch Steam game news. My friend Damn3d had the idea.

# Utilisation
This bot uses Node.JS (≥16) avec with `discord.js` v13.

`auth.json`
```JSON
{
	"token": "your bot's authentication token",
 	"master": "your user id",
	"adminServer": "the id of the server where the admin commands will be available, for you",
	"dblToken": "(optional) your bot's Top.gg token",
	"debug": false,

	"supportServer": "(optional) The invite to your support server"
}
```
`debug` should be `true` in development and `false` (or not set) in production. In debug mode, commands are created as server commands for quicker updating. They are global commands otherwise. Also, commands under the `debug` subfolder are ignored unless in debug mode.

## Databse schema

Just read steam_news/db.js, there is a bunch of CREATE TABLE at the beginning.

# Licence
**Steam News** is published under GNU General Public Licence v3 (GPL-3.0). See COPYING.txt, or this link: [https://www.gnu.org/licenses/gpl-3.0.en.html](https://www.gnu.org/licenses/gpl-3.0.en.html)

![GPL](https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/GPLv3_Logo.svg/240px-GPLv3_Logo.svg.png)
