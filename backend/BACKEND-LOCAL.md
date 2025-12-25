# Backend local (Lambda + API Gateway + DynamoDB Local)

Prérequis
- Linux, Node.js LTS
- Docker (pour DynamoDB Local via plugin)

Installation
```bash
cd /home/mathieu/PUMPFOILMAP/backend
npm install
```

Démarrer en local (API + DynamoDB Local + seeds)
```bash
export AWS_ACCESS_KEY_ID=fake
export AWS_SECRET_ACCESS_KEY=fake
export AWS_REGION=eu-west-1
export AWS_EC2_METADATA_DISABLED=true
DYNAMODB_ENDPOINT=http://localhost:8000 npx serverless offline --stage dev
# API: http://localhost:3000
# DynamoDB Local: http://localhost:8000
```

Alternative sans Java/Docker (in-memory avec seeds)
```bash
USE_INMEMORY=true serverless offline --stage dev
# API: http://localhost:3000
```

Tester avec curl
```bash
# Lister les spots
curl -s http://localhost:3000/spots | jq

# Filtrer par bbox (minLng,minLat,maxLng,maxLat)
curl -s "http://localhost:3000/spots?bbox=2.0,48.0,3.0,49.0" | jq

# Créer un spot
curl -s -X POST http://localhost:3000/spots \
  -H "Content-Type: application/json" \
  -d '{"name":"Nouveau spot","lat":48.9,"lng":2.4,"description":"test"}' | jq

# Admin (protégé par token Bearer, par défaut `dev` en local)
curl -s -H "Authorization: Bearer dev" http://localhost:3000/admin/spots/pending | jq
curl -s -X PATCH http://localhost:3000/admin/spots/s1 \
  -H "Authorization: Bearer dev" \
  -H "Content-Type: application/json" \
  -d '{"moderationNote":"ok","status":"approved"}' | jq

# Captcha (nécessite CAPTCHA_PRIVATE_KEY)
export CAPTCHA_PRIVATE_KEY="<votre-chaîne-secrète>"
curl -s http://localhost:3000/captcha | jq
# Supposons que la réponse soit { data, secret }; l'utilisateur humain lit le SVG et répond
curl -s -X POST http://localhost:3000/captcha/verify \
  -H "Content-Type: application/json" \
  -d '{"secret":"<secret>","answer":"<texte-lu-dans-le-SVG>"}' | jq
```

Tests unitaires
```bash
npm test
```

E2E sans dépendances locales (HTTP wrapper en mémoire)
```bash
npm run e2e:run
```

Arrêter DynamoDB Local
```bash
npm run dyn:stop
```

Notes
- Aucun identifiant AWS requis en mode local (serverless-offline + dynamodb-local).
- En cloud, la même config déploie la table et les Lambdas (`serverless deploy`).

Front (Expo) consomme l'API et affiche des marqueurs cliquables avec `name` -> titre et `description` -> description.
