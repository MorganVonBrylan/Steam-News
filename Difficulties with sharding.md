
News-checking: only shard 0 should check for news. It should then send messages to the other shards to tell them to send a message to the guilds.
From https://discord.com/developers/docs/topics/gateway#sharding

Maybe it would be easier if the bot used webhooks instead, shard 0 could just post to all of them and not worry about that. Probably the better idea.


Reminder: move dbl to use the sharding manager instead of a client