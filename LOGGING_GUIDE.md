# Guide des Logs - Dancing Dead API

## 📍 Localisation des logs

### 1. Logs de l'application (nouveau système)

Les logs détaillés sont maintenant écrits dans des fichiers dédiés :

```
/logs/dancingdeadartists.log  # Logs spécifiques à l'endpoint dancingdeadartists
/logs/app.log                  # Logs généraux de l'application
```

### 2. Sur o2switch - Accès via cPanel

1. **Connexion** : https://www.o2switch.fr/cpanel
2. **Méthode 1 - Interface web** :
   - Allez dans "Fichiers" → "Gestionnaire de fichiers"
   - Naviguez vers `dancing-dead-relay-api/logs/`
   - Cliquez sur le fichier log pour le visualiser ou le télécharger

3. **Méthode 2 - Logs Apache** :
   - Dans cPanel, cherchez "Erreurs" ou "Error Logs"
   - Les logs du serveur web s'affichent (incluant les `console.log()` de Node.js)

### 3. Sur o2switch - Accès via SSH

```bash
# Se connecter en SSH
ssh votre-utilisateur@ssh.o2switch.net

# Voir les logs de l'application
tail -f ~/dancing-dead-relay-api/logs/dancingdeadartists.log

# Voir les logs Apache/Passenger
tail -f ~/logs/error_log

# Rechercher des erreurs spécifiques
grep -i "error" ~/dancing-dead-relay-api/logs/dancingdeadartists.log

# Voir les 100 dernières lignes
tail -n 100 ~/dancing-dead-relay-api/logs/dancingdeadartists.log
```

## 🔍 Diagnostiquer un problème de mise à jour

### Étape 1 : Tester l'endpoint

```bash
# Depuis votre terminal local ou serveur
curl -X POST https://votre-domaine.com/dancingdeadartists/update

# Ou avec plus de détails
curl -X POST https://votre-domaine.com/dancingdeadartists/update -v
```

### Étape 2 : Consulter les logs immédiatement après

```bash
# Via SSH
tail -n 50 ~/dancing-dead-relay-api/logs/dancingdeadartists.log
```

### Étape 3 : Ce que vous devriez voir dans les logs

Après avoir appelé `/update`, vous devriez voir :

```
[2026-01-12T...] [INFO] === DÉBUT DE LA MISE À JOUR FORCÉE ===
[2026-01-12T...] [INFO] Request received from: {...}
[2026-01-12T...] [INFO] Fetching artists from Spotify...
[2026-01-12T...] [INFO] Starting fetch for 2 playlists
[2026-01-12T...] [INFO] Spotify token obtained successfully
[2026-01-12T...] [INFO] Fetching artists from playlist: 0yN1AKMSboq8tsgmjSL3ky
[2026-01-12T...] [INFO] Found X tracks in playlist...
[2026-01-12T...] [SUCCESS] Data written to file successfully
[2026-01-12T...] [SUCCESS] Update completed successfully
```

## ⚠️ Problèmes courants

### Le fichier log n'existe pas

Vérifiez que le dossier `/logs` existe et a les bonnes permissions :

```bash
# Via SSH
cd ~/dancing-dead-relay-api
ls -la logs/

# Si le dossier n'existe pas
mkdir -p logs
chmod 755 logs
```

### Permissions insuffisantes

```bash
# Donner les permissions d'écriture
chmod 755 logs
chmod 644 logs/*.log
```

### L'API ne répond pas

```bash
# Vérifier que l'application tourne
ps aux | grep node

# Redémarrer Passenger
mkdir -p tmp && touch tmp/restart.txt
```

## 📊 Analyser les logs

### Filtrer par niveau de log

```bash
# Voir uniquement les erreurs
grep "\[ERROR\]" logs/dancingdeadartists.log

# Voir uniquement les succès
grep "\[SUCCESS\]" logs/dancingdeadartists.log

# Voir les logs d'aujourd'hui
grep "2026-01-12" logs/dancingdeadartists.log
```

### Suivre les logs en temps réel

```bash
# Suivre les logs en direct (Ctrl+C pour quitter)
tail -f logs/dancingdeadartists.log
```

## 🚀 Forcer une mise à jour

### Depuis le navigateur

Utilisez un outil comme Postman ou cURL :

**URL** : `https://votre-domaine.com/dancingdeadartists/update`
**Méthode** : `POST`
**Headers** : Aucun requis

### Depuis le serveur

```bash
# Via SSH sur o2switch
curl -X POST http://localhost/dancingdeadartists/update
```

## 📝 Format des logs

Chaque ligne de log contient :
- **Timestamp** : Date et heure ISO
- **Niveau** : INFO, ERROR, WARN, SUCCESS, DEBUG
- **Message** : Description de l'événement
- **Données** : JSON optionnel avec plus de détails

Exemple :
```
[2026-01-12T10:30:45.123Z] [INFO] Update completed successfully
{
  "artistsCount": 150,
  "duration": "45.2s"
}
```
