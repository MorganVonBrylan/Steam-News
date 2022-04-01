
# Steam News

Current version: 1.2

This bot allows you to watch Steam game news. My friend Damn3d had the idea.

# Utilisation
This bot uses Node.JS (≥16) avec with `discord.js` v13.

`auth.json`
```JSON
{
	"token": "your bot's authentication token",
 	"master": "your user id",
	"dblToken": "(optional) your bot's Top.gg token",
	"debug": false,

	"supportServer": "(optional) The invite to your support server"
}
```
`debug` should be `true` in development and `false` (or not set) in production. In debug mode, commands are created as server commands for quicker updating. They are global commands otherwise. Also, commands under the `debug` subfolder are ignored unless in debug mode.

## `watchers.json` format

`servers` is an object with server ids as keys and an array of the ids of the apps it follows as the values.

`apps` is an object with app ids as keys and objects as values. The objects have the following properties:
- name: (string) The app's name
- nsfw: (bool) Whether the app is NSFW or not
- latest: (string) The id of the app's last known news item
- watchers: (object) An object with server ids as keys and the ids of the channels in which to send the news as values
Example:
```JSON
{
	"servers": { "123": [111, 222], "456": [111] },
	"apps": {
		"111": { "name": "jeu 111", "nsfw": false, "latest": "1010", "watchers": { "123": "125", "456": "458" } },
		"222": { "name": "jeu 222", "nsfw": false, "latest": "2020", "watchers": { "123": "125" } },
	}
}
```

# Licence
**Steam News** is published under GNU General Public Licence v3 (GPL-3.0). See COPYING.txt, or this link: [https://www.gnu.org/licenses/gpl-3.0.en.html](https://www.gnu.org/licenses/gpl-3.0.en.html)

![GPL](https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/GPLv3_Logo.svg/240px-GPLv3_Logo.svg.png)
