
# Chameleon feature

## TO DO
- Création automatique des webhooks
    - ✔️ Global, et par watcher
    - Proposer lors de la création d'un watcher (avec bouton)
- Limite de taille pour les avatars ?
- Cache pour fetchImage ?

## DONE
- /watched indique si le watcher utilise un webhook
- Purge du webhook et défaut sur un message normal si le webhook ne marche plus
- /premium chameleon set
- /latest utilise les webhooks
- Gérer la mise à jour d'un watcher
    - Garder le webhook au cas où c'est le même salon et juste un fil différent (?thread_id=123)