# 🚀 Webhook - Guide Rapide

Guide ultra-rapide pour configurer le déploiement automatique.

---

## ⚡ Installation Rapide (5 minutes)

### 1️⃣ Sur o2switch (SSH)

```bash
# Connexion SSH
ssh zibe1437@chatain.o2switch.net

# Naviguer vers le projet
source /home/zibe1437/nodevenv/repositories/dancing-dead-relay-api/20/bin/activate
cd /home/zibe1437/repositories/dancing-dead-relay-api

# Récupérer les dernières modifications
git pull origin main
npm install

# Générer un secret webhook (COPIEZ LE RÉSULTAT)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Ajouter le secret au .env
nano .env
# Ajoutez cette ligne (remplacez YOUR_SECRET par le secret généré) :
# WEBHOOK_SECRET=YOUR_SECRET
# Ctrl+O, Enter, Ctrl+X pour sauvegarder

# Rendre le script exécutable
chmod +x deploy.sh

# Tester le script
bash deploy.sh

# Redémarrer le serveur
pkill -f "node.*index.js"
nohup node index.js > server.log 2>&1 &

# Vérifier que ça tourne
ps aux | grep node
tail -f server.log  # Ctrl+C pour quitter
```

---

### 2️⃣ Sur GitHub

1. **Aller sur le repository :**
   https://github.com/DancingDead/dancing-dead-relay-api/settings/hooks

2. **Cliquer sur "Add webhook"**

3. **Remplir le formulaire :**
   - **Payload URL :** `https://api.dancingdeadrecords.com/dancing-dead-relay-api/webhook/deploy`
   - **Content type :** `application/json`
   - **Secret :** [Collez le secret généré à l'étape 1]
   - **Which events :** `Just the push event`
   - **Active :** ✅

4. **Cliquer sur "Add webhook"**

---

### 3️⃣ Tester

```bash
# Sur votre machine locale
git commit --allow-empty -m "test: webhook trigger"
git push origin main

# Sur o2switch (SSH)
tail -f /home/zibe1437/repositories/dancing-dead-relay-api/deploy.log
```

Vous devriez voir :
```
[2026-01-07 12:34:56] 🚀 Starting deployment...
[2026-01-07 12:34:58] ✅ Deployment completed successfully!
```

---

## 🎉 C'est Tout !

Maintenant, à chaque `git push` sur `main`, votre serveur se mettra à jour automatiquement !

---

## 📝 Vérifier que ça marche

### Option 1 : Endpoint de status

```bash
curl https://api.dancingdeadrecords.com/dancing-dead-relay-api/webhook/status
```

### Option 2 : Logs

```bash
# Sur o2switch
tail -f deploy.log
```

### Option 3 : GitHub

Allez dans : **Settings → Webhooks → Cliquez sur votre webhook → Recent Deliveries**

---

## 🔧 Commandes Utiles

```bash
# Voir les logs de déploiement
tail -f deploy.log

# Voir les logs du serveur
tail -f server.log

# Redémarrer manuellement
bash deploy.sh

# Vérifier le processus Node.js
ps aux | grep node

# Tuer le processus
pkill -f "node.*index.js"

# Redémarrer le serveur
nohup node index.js > server.log 2>&1 &
```

---

## ⚠️ En cas de problème

Consultez le guide complet : **WEBHOOK_SETUP.md**

Ou testez manuellement :
```bash
# SSH sur o2switch
cd /home/zibe1437/repositories/dancing-dead-relay-api
bash deploy.sh
```

Si ça marche manuellement mais pas via webhook :
- Vérifiez que le secret est identique sur GitHub et dans `.env`
- Vérifiez les logs : `tail -f server.log`
- Redémarrez le serveur après modification du `.env`

---

**Support :** Voir les logs dans `deploy.log` et `server.log`
