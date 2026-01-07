# 🚀 GitHub Webhook - Guide de Configuration

Système de déploiement automatique pour o2switch via GitHub Webhooks.

---

## 📋 Table des Matières

1. [Prérequis](#prérequis)
2. [Installation sur o2switch](#installation-sur-o2switch)
3. [Configuration GitHub](#configuration-github)
4. [Test du Webhook](#test-du-webhook)
5. [Monitoring](#monitoring)
6. [Dépannage](#dépannage)

---

## 🔧 Prérequis

- Accès SSH à o2switch
- Repository GitHub avec droits administrateur
- Node.js installé sur o2switch
- Git configuré avec accès au repository

---

## 📦 Installation sur o2switch

### 1. Connexion SSH

```bash
ssh zibe1437@chatain.o2switch.net
```

### 2. Naviguer vers le projet

```bash
source /home/zibe1437/nodevenv/repositories/dancing-dead-relay-api/20/bin/activate
cd /home/zibe1437/repositories/dancing-dead-relay-api
```

### 3. Générer un secret webhook

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Exemple de sortie :**
```
a3f5c8d9e2b7a6c4f8d3e9a2b5c7d8e1f4a6b9c2d5e8a1b4c7d9e2f5a8b1c4d7
```

⚠️ **Conservez ce secret, vous en aurez besoin pour GitHub !**

### 4. Ajouter le secret au fichier .env

```bash
nano .env
```

Ajoutez cette ligne (remplacez par votre secret généré) :

```env
WEBHOOK_SECRET=a3f5c8d9e2b7a6c4f8d3e9a2b5c7d8e1f4a6b9c2d5e8a1b4c7d9e2f5a8b1c4d7
```

Sauvegardez : `Ctrl + O`, puis `Enter`, puis `Ctrl + X`

### 5. Rendre le script de déploiement exécutable

```bash
chmod +x deploy.sh
```

### 6. Tester le script de déploiement manuellement

```bash
bash deploy.sh
```

Vous devriez voir :
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting deployment...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
...
✅ Deployment completed successfully!
```

### 7. Redémarrer le serveur Node.js

```bash
# Arrêter le processus actuel
pkill -f "node.*index.js"

# Redémarrer avec les nouvelles routes webhook
nohup node index.js > server.log 2>&1 &

# Vérifier que ça tourne
ps aux | grep node
```

---

## 🔗 Configuration GitHub

### 1. Accéder aux paramètres du repository

1. Allez sur https://github.com/DancingDead/dancing-dead-relay-api
2. Cliquez sur **Settings** (onglet en haut)
3. Dans la sidebar gauche, cliquez sur **Webhooks**
4. Cliquez sur **Add webhook**

### 2. Configurer le webhook

Remplissez le formulaire :

**Payload URL :**
```
https://api.dancingdeadrecords.com/dancing-dead-relay-api/webhook/deploy
```

**Content type :**
```
application/json
```

**Secret :**
```
[Collez le secret généré à l'étape 3 de l'installation]
```

**Which events would you like to trigger this webhook?**
- Sélectionnez : **Just the push event**

**Active :**
- ✅ Cochez la case

### 3. Sauvegarder

Cliquez sur **Add webhook**

GitHub va immédiatement envoyer un "ping" pour tester la connexion.

---

## 🧪 Test du Webhook

### Test 1 : Vérifier le statut du webhook

```bash
curl https://api.dancingdeadrecords.com/dancing-dead-relay-api/webhook/status
```

**Réponse attendue :**
```json
{
  "success": true,
  "webhook": {
    "configured": true,
    "endpoint": "/webhook/deploy",
    "method": "POST"
  },
  "lastDeployments": [
    "[2026-01-07T12:00:00.000Z] [INFO] Deployment triggered..."
  ]
}
```

### Test 2 : Push un commit test

```bash
# Sur votre machine locale
echo "# Test webhook" >> README.md
git add README.md
git commit -m "test: webhook deployment trigger"
git push origin main
```

### Test 3 : Vérifier les logs sur o2switch

```bash
# SSH sur o2switch
ssh zibe1437@chatain.o2switch.net

# Voir les logs de déploiement
tail -f /home/zibe1437/repositories/dancing-dead-relay-api/deploy.log

# Voir les logs du serveur
tail -f /home/zibe1437/repositories/dancing-dead-relay-api/server.log
```

**Vous devriez voir :**
```
[2026-01-07 12:34:56] 🚀 Starting deployment...
[2026-01-07 12:34:57] ✅ Code pulled successfully
[2026-01-07 12:34:58] ✅ Deployment completed successfully!
```

---

## 📊 Monitoring

### Voir l'historique des déploiements

```bash
# SSH sur o2switch
cat deploy.log | tail -n 50
```

### Voir les logs du webhook

```bash
tail -f server.log | grep webhook
```

### Vérifier l'état du serveur

```bash
# Processus Node.js actifs
ps aux | grep node

# Dernier déploiement
tail -n 10 deploy.log
```

### Dashboard GitHub

1. Allez dans **Settings → Webhooks**
2. Cliquez sur votre webhook
3. Onglet **Recent Deliveries** pour voir l'historique

Pour chaque livraison, vous pouvez voir :
- **Request** : ce que GitHub a envoyé
- **Response** : ce que votre serveur a répondu
- **Status** : 202 = succès, 401 = erreur de signature, 500 = erreur serveur

---

## 🔍 Dépannage

### Problème : Webhook retourne 401 (Unauthorized)

**Cause :** Le secret ne correspond pas

**Solution :**
1. Vérifiez que le secret dans `.env` est identique à celui sur GitHub
2. Redémarrez le serveur après modification du `.env`

```bash
pkill -f "node.*index.js"
nohup node index.js > server.log 2>&1 &
```

---

### Problème : Webhook retourne 500 (Internal Server Error)

**Cause :** Erreur dans le script de déploiement

**Solution :**
1. Testez le script manuellement :
```bash
bash deploy.sh
```

2. Vérifiez les permissions :
```bash
chmod +x deploy.sh
```

3. Vérifiez les logs :
```bash
tail -n 50 deploy.log
```

---

### Problème : Le serveur ne redémarre pas

**Cause :** Le script ne trouve pas le processus Node.js

**Solution :**
1. Vérifiez les processus :
```bash
ps aux | grep node
```

2. Tuez manuellement si nécessaire :
```bash
pkill -9 -f "node.*index.js"
```

3. Redémarrez :
```bash
nohup node index.js > server.log 2>&1 &
```

---

### Problème : Git pull échoue

**Cause :** Modifications locales non committées

**Solution :**
Le script stash automatiquement les modifications, mais si ça échoue :

```bash
cd /home/zibe1437/repositories/dancing-dead-relay-api
git stash
git pull origin main
```

---

### Problème : npm install échoue

**Cause :** Dépendances corrompues ou réseau

**Solution :**
```bash
cd /home/zibe1437/repositories/dancing-dead-relay-api
rm -rf node_modules package-lock.json
npm install --production
```

---

## 📝 Flux de Déploiement

```
┌─────────────────┐
│   git push      │
│   (local)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   GitHub        │
│   Repository    │
└────────┬────────┘
         │ webhook event
         ▼
┌─────────────────┐
│ POST /webhook/  │
│     deploy      │
└────────┬────────┘
         │ 1. Verify signature
         │ 2. Check event type
         │ 3. Execute deploy.sh
         ▼
┌─────────────────┐
│   deploy.sh     │
│   - git pull    │
│   - npm install │
│   - restart     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   ✅ Server     │
│   Updated!      │
└─────────────────┘
```

---

## 🔒 Sécurité

### Bonnes Pratiques

✅ **À FAIRE :**
- Utiliser un secret fort (32+ caractères aléatoires)
- Limiter le webhook au event "push" uniquement
- Vérifier la signature HMAC sur chaque requête
- Logger tous les événements de déploiement
- Sauvegarder régulièrement les logs

❌ **À NE PAS FAIRE :**
- Partager le secret webhook publiquement
- Commit le `.env` dans Git
- Donner accès au webhook sans authentification
- Oublier de redémarrer après modification du `.env`

### Rotation du Secret

Si vous pensez que le secret a été compromis :

1. Générez un nouveau secret :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

2. Mettez à jour `.env` sur o2switch

3. Mettez à jour le webhook sur GitHub (Settings → Webhooks → Edit)

4. Redémarrez le serveur :
```bash
pkill -f "node.*index.js" && nohup node index.js > server.log 2>&1 &
```

---

## 📞 Support

En cas de problème, vérifiez dans l'ordre :

1. **Logs de déploiement** : `tail -f deploy.log`
2. **Logs du serveur** : `tail -f server.log`
3. **Dashboard GitHub** : Webhooks → Recent Deliveries
4. **Processus actifs** : `ps aux | grep node`

---

## ✅ Checklist de Configuration

- [ ] Secret webhook généré
- [ ] Secret ajouté au `.env`
- [ ] `deploy.sh` est exécutable (`chmod +x`)
- [ ] Script de déploiement testé manuellement
- [ ] Serveur redémarré avec les nouvelles routes
- [ ] Webhook configuré sur GitHub
- [ ] Test de push effectué
- [ ] Logs vérifiés (deploy.log + server.log)
- [ ] Status endpoint testé (`/webhook/status`)

---

🎉 **Félicitations ! Votre déploiement automatique est configuré !**

Chaque `git push` sur la branche `main` déclenchera maintenant automatiquement le déploiement sur o2switch.
