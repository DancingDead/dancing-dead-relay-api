# Guide de déploiement et mise à jour - O2Switch cPanel

## Déploiement initial de l'API sur O2Switch

### Étape 1 : Accéder au cPanel

1. Connectez-vous à votre cPanel O2Switch : `https://panel.o2switch.fr`
2. Cherchez l'option **"Terminal"** ou **"SSH Access"**

### Étape 2 : Installation de Node.js (si pas déjà fait)

O2Switch supporte Node.js via leur système "Node.js Selector".

1. Dans cPanel, cherchez **"Setup Node.js App"**
2. Cliquez sur **"Create Application"**
3. Configurez :
   - **Node.js version** : 18.x (ou la plus récente disponible)
   - **Application mode** : Production
   - **Application root** : `dancing-dead-relay-api`
   - **Application URL** : Choisissez votre domaine/sous-domaine (ex: `api.dancingdeadrecords.com`)
   - **Application startup file** : `index.js`

### Étape 3 : Cloner le repository via SSH

1. Connectez-vous en SSH :
```bash
ssh votre-utilisateur@votreserveur.o2switch.net
```

2. Naviguez vers le répertoire de votre domaine :
```bash
cd ~/www/votredomaine.com  # ou le chemin approprié
```

3. Clonez le repository :
```bash
git clone https://github.com/DancingDead/dancing-dead-relay-api.git
cd dancing-dead-relay-api
```

4. Installez les dépendances :
```bash
npm install --production
```

### Étape 4 : Configuration des variables d'environnement

1. Créez le fichier `.env` :
```bash
nano .env
```

2. Copiez-collez votre configuration (avec vos vraies clés API) :
```env
# Spotify API
SPOTIFY_CLIENT_ID=votre_client_id_1
SPOTIFY_CLIENT_SECRET=votre_client_secret_1
SPOTIFY_CLIENT_ID_2=votre_client_id_2
SPOTIFY_CLIENT_SECRET_2=votre_client_secret_2

# Brave Search API
BRAVE_API_KEY=votre_brave_api_key

# Claude API
ANTHROPIC_API_KEY=votre_anthropic_api_key

# WordPress Configuration
WORDPRESS_URL=https://www.dancingdeadrecords.com
WORDPRESS_MCP_ENDPOINT=https://www.dancingdeadrecords.com/wp-json/mcp/v1
WORDPRESS_MCP_KEY=votre_mcp_api_key

# Configuration serveur
PORT=3000
NODE_ENV=production
SCHEDULE_NIGHTLY=true
```

3. Sauvegardez avec `Ctrl+X`, puis `Y`, puis `Enter`

### Étape 5 : Démarrer l'application

#### Option A : Via le Node.js Selector de cPanel

1. Retournez dans **"Setup Node.js App"** dans cPanel
2. Trouvez votre application dans la liste
3. Cliquez sur **"Edit"**
4. Dans la section **"Environment Variables"**, ajoutez toutes vos variables d'environnement
5. Cliquez sur **"Start App"** ou **"Restart App"**

#### Option B : Via PM2 (recommandé pour plus de contrôle)

```bash
# Installer PM2 globalement
npm install -g pm2

# Démarrer l'application
pm2 start index.js --name "dancing-dead-api"

# Sauvegarder la configuration
pm2 save

# Configurer le démarrage automatique
pm2 startup

# Copier-coller la commande affichée par PM2
```

### Étape 6 : Vérifier que l'API fonctionne

```bash
# Tester depuis le serveur
curl http://localhost:3000/dancingdeadartists

# Ou depuis votre navigateur
https://api.dancingdeadrecords.com/dancingdeadartists
```

---

## Force Update des pages WordPress depuis le serveur

### Méthode 1 : Via SSH (Recommandé)

Connectez-vous en SSH et exécutez :

```bash
# 1. Mettre à jour la liste d'artistes depuis Spotify
curl -X POST http://localhost:3000/dancingdeadartists/update

# 2. Synchroniser TOUS les artistes vers WordPress
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Options de synchronisation :**

```bash
# Synchroniser seulement 10 artistes (pour tester)
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 10, "skipSpotifyUpdate": true}'

# Force la re-création de TOUTES les pages (même celles existantes)
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"forceAll": true}'

# Seulement créer les pages manquantes (sans mettre à jour Spotify)
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'
```

### Méthode 2 : Via cPanel Terminal

1. Ouvrez **"Terminal"** dans cPanel
2. Naviguez vers le dossier de l'API :
```bash
cd ~/www/votredomaine.com/dancing-dead-relay-api
```

3. Exécutez la mise à jour :
```bash
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'
```

### Méthode 3 : Via navigateur web (plus simple mais moins pratique)

Créez un fichier `update.html` sur votre serveur :

```html
<!DOCTYPE html>
<html>
<head>
    <title>Dancing Dead - Update Artists</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 50px auto; padding: 20px; }
        button { padding: 15px 30px; font-size: 16px; margin: 10px; cursor: pointer; }
        #status { margin-top: 20px; padding: 15px; background: #f0f0f0; border-radius: 5px; }
        .loading { color: #0066cc; }
        .success { color: #00cc00; }
        .error { color: #cc0000; }
    </style>
</head>
<body>
    <h1>Dancing Dead - Update Artists</h1>

    <button onclick="updateSpotifyList()">1. Update Spotify List</button>
    <button onclick="syncToWordPress(false)">2. Sync Missing Artists</button>
    <button onclick="syncToWordPress(true)">3. Force Update All</button>

    <div id="status"></div>

    <script>
        const API_URL = 'https://api.dancingdeadrecords.com'; // Changez avec votre URL

        function setStatus(message, type) {
            const status = document.getElementById('status');
            status.className = type;
            status.innerHTML = message;
        }

        async function updateSpotifyList() {
            setStatus('⏳ Updating Spotify list...', 'loading');
            try {
                const response = await fetch(`${API_URL}/dancingdeadartists/update`, {
                    method: 'POST'
                });
                const data = await response.json();
                setStatus(`✅ Spotify list updated! ${data.artists.length} artists found.`, 'success');
            } catch (error) {
                setStatus(`❌ Error: ${error.message}`, 'error');
            }
        }

        async function syncToWordPress(forceAll = false) {
            const options = forceAll ?
                { forceAll: true } :
                { skipSpotifyUpdate: true };

            setStatus('⏳ Synchronizing to WordPress... This may take a while...', 'loading');

            try {
                const response = await fetch(`${API_URL}/api/artists/sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(options)
                });
                const data = await response.json();

                if (data.success) {
                    setStatus(`
                        ✅ Sync completed!<br>
                        - Processed: ${data.processed}<br>
                        - Created: ${data.created}<br>
                        - Skipped: ${data.skipped}<br>
                        - Failed: ${data.failed}<br>
                        - Duration: ${data.duration}
                    `, 'success');
                } else {
                    setStatus(`❌ Sync failed: ${data.error}`, 'error');
                }
            } catch (error) {
                setStatus(`❌ Error: ${error.message}`, 'error');
            }
        }
    </script>
</body>
</html>
```

Uploadez ce fichier dans `public_html` et accédez-y via : `https://votresite.com/update.html`

**⚠️ IMPORTANT** : Protégez ce fichier avec un `.htaccess` ou un mot de passe pour éviter les accès non autorisés !

### Méthode 4 : Via Cron Job (Automatisation)

Pour exécuter la mise à jour automatiquement tous les jours :

1. Dans cPanel, allez dans **"Cron Jobs"**
2. Ajoutez un nouveau cron job :

**Pour mise à jour quotidienne à minuit** :
```
0 0 * * * curl -X POST http://localhost:3000/dancingdeadartists/update
```

**Pour synchronisation quotidienne à 1h du matin** :
```
0 1 * * * curl -X POST http://localhost:3000/api/artists/sync -H "Content-Type: application/json" -d '{"skipSpotifyUpdate": true}'
```

---

## Monitoring des mises à jour

### Vérifier les logs en temps réel

```bash
# Via SSH
ssh votre-utilisateur@votreserveur.o2switch.net
cd ~/www/votredomaine.com/dancing-dead-relay-api

# Voir les logs en direct
tail -f server.log

# Voir seulement les erreurs
tail -f server.log | grep -E "❌|⚠️|Error"

# Voir la progression des artistes
tail -f server.log | grep -E "Artist \[|✅ Artist pages"
```

### Vérifier le statut de l'application

```bash
# Si vous utilisez PM2
pm2 status
pm2 logs dancing-dead-api
pm2 monit

# Redémarrer si nécessaire
pm2 restart dancing-dead-api
```

### Vérifier le nombre de pages WordPress

```bash
# Compter les pages d'artistes EN
curl -s "https://www.dancingdeadrecords.com/wp-json/wp/v2/artist?per_page=100" | grep -o '"id":' | wc -l

# Ou via une requête avec pagination
curl -s -I "https://www.dancingdeadrecords.com/wp-json/wp/v2/artist?per_page=1" | grep -i "x-wp-total"
```

---

## Mise à jour du code depuis GitHub

Quand vous faites des changements et les pushez sur GitHub :

```bash
# 1. Se connecter en SSH
ssh votre-utilisateur@votreserveur.o2switch.net

# 2. Aller dans le dossier de l'API
cd ~/www/votredomaine.com/dancing-dead-relay-api

# 3. Pull les derniers changements
git pull origin main

# 4. Installer les nouvelles dépendances (si nécessaire)
npm install --production

# 5. Redémarrer l'application
pm2 restart dancing-dead-api

# OU si vous utilisez Node.js Selector
# Allez dans cPanel > Setup Node.js App > Restart App
```

---

## Résolution des problèmes courants

### Problème : L'API ne répond pas

```bash
# Vérifier si le processus tourne
pm2 status

# Vérifier les logs d'erreur
pm2 logs dancing-dead-api --err

# Redémarrer
pm2 restart dancing-dead-api
```

### Problème : Port 3000 déjà utilisé

Changez le port dans `.env` :
```env
PORT=3001
```

Puis redémarrez l'application.

### Problème : Permission denied

```bash
# Donner les permissions correctes
chmod -R 755 dancing-dead-relay-api
chmod 600 .env  # Fichier sensible
```

### Problème : Rate limit dépassé

Si vous avez trop de requêtes sur Brave API :
```bash
# Synchroniser avec un délai entre chaque artiste (modifiez le code)
# Ou limitez le nombre d'artistes par batch
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 20, "skipSpotifyUpdate": true}'

# Attendez quelques minutes, puis relancez avec les 20 suivants
```

### Problème : Connexion MCP WordPress échoue

Vérifiez :
1. Que le plugin MCP WordPress est installé et actif
2. Que la clé API dans `.env` correspond à celle configurée dans WordPress
3. Que l'URL WordPress est correcte (avec/sans www)

```bash
# Tester la connexion
curl -I "https://www.dancingdeadrecords.com/wp-json/mcp/v1/sse?token=VOTRE_CLE_API"
```

---

## Commandes utiles (cheat sheet)

```bash
# Mise à jour Spotify + Sync WordPress (complet)
curl -X POST http://localhost:3000/dancingdeadartists/update && \
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{}'

# Sync rapide des artistes manquants (sans maj Spotify)
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"skipSpotifyUpdate": true}'

# Test avec 5 artistes seulement
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -d '{"limit": 5, "skipSpotifyUpdate": true}'

# Voir les logs en temps réel
tail -f server.log

# Redémarrer l'API
pm2 restart dancing-dead-api

# Pull dernières mises à jour depuis GitHub
git pull origin main && npm install --production && pm2 restart dancing-dead-api

# Vérifier le nombre d'artistes
curl -s http://localhost:3000/dancingdeadartists | grep -o '"id":' | wc -l
```

---

## Sécurité

### Protéger l'API avec une clé

Si vous voulez sécuriser les endpoints de mise à jour, ajoutez une vérification de clé API dans `api/artists/index.js` :

```javascript
// Au début du fichier
const API_KEY = process.env.UPDATE_API_KEY || 'votre-cle-secrete';

// Dans la route POST /sync
router.post('/sync', async (req, res) => {
    // Vérifier la clé API
    const providedKey = req.headers['x-api-key'];
    if (providedKey !== API_KEY) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // ... reste du code
});
```

Puis utilisez-la dans vos requêtes :
```bash
curl -X POST http://localhost:3000/api/artists/sync \
  -H "Content-Type: application/json" \
  -H "X-API-Key: votre-cle-secrete" \
  -d '{"skipSpotifyUpdate": true}'
```

---

## Support

Si vous rencontrez des problèmes :

1. **Vérifiez les logs** : `tail -f server.log`
2. **Vérifiez le statut** : `pm2 status`
3. **Testez les endpoints** manuellement avec curl
4. Contactez le support O2Switch si problème d'infrastructure Node.js

**Version** : 1.0.0
**Dernière mise à jour** : 2025-01-30
