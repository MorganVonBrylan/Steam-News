
# Steam News

This bot is french so if you don't speak french... well, too bad!

Version actuelle : 0.1

Un bot pour suivre les infos des jeux Steam.

# Utilisation
Ce bot est à utiliser avec Node.JS (≥16) avec le paquet `discord.js` v13.

`auth.json`
```JSON
{
	"token": "le token d'authentification de votre bot",
 	"master": "votre id d'utilisateurice",
	"debug": false
}
```
`debug` should be `true` in development and `false` in production. In debug mode, commands are created as server commands for quicker updating. They are global commands otherwise.

## Format de `watchers.json`

`servers` est un objet ayant pour clés les id des serveurs et pour valeurs un tableau de id des applis suivies dans le serveur.

`apps` est un objet ayant pour clés les id des applis et pour valeurs un objets avec les clés:
- name: Nom de l'appli (string)
- nsfw: Si l'appli est NSFW ou non (bool)
- latest: L'id de la dernière actu connue (string)
- watchers: Un objet ayant pour clés les id des serveurs suivant cette appli et pour valeurs l'id du salon dans lequel envoyer les actus
Exemple :
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
**Steam News** est publié sous Licence Publique Générale GNU *(GNU General Public Licence)* v3 (GPL-3.0). Voir COPYING.txt, ou ce lien : [https://www.gnu.org/licenses/gpl-3.0.fr.html](https://www.gnu.org/licenses/gpl-3.0.fr.html)

![GPL](https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/GPLv3_Logo.svg/240px-GPLv3_Logo.svg.png)
