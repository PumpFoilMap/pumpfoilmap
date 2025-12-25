# PumpfoilMap — Prototype Expo + Web

Base de code unique React Native (Expo) pour iOS/Android/Web, avec carte et marqueurs cliquables (sans Next.js).

## Démarrage rapide
```bash
npm install
# Web (Expo)
npm run web
# Mobile (environnements natifs requis)
npm run ios
npm run android
```

## Cartographie
- Web: MapLibre GL. Clustering des spots (cercles), popup avec titre / description / métadonnées. Mode minimal (routes principales + fond simplifié).
- Natif: WebView + MapLibre GL JS (via `react-native-webview`). Clustering similaire et popups/picking via bridge RN.

## Structure
- `src/components/Map/Map.web.tsx` / `Map.native.tsx`: implémentations spécifiques (marqueurs cliquables)
- `src/App.tsx`: app RN commune
  

## Suite
- Intégration AWS (Cognito, API Gateway + Lambda, S3/CloudFront, DynamoDB)
- Authentification & rôles
- Optimisations performance (pagination, chargement différé)

## API backend (local)
- Base URL par défaut: `http://localhost:3000`
- Override possible via variable d’environnement Expo:
	- `EXPO_PUBLIC_API_BASE_URL`

## Tests backend et E2E
- Dans `backend/`:
	- Tests unitaires: `npm test`
	- E2E local (runner HTTP in-memory, sans Java/Docker): `npm run e2e:run`

## Admin (modération) — Token d'accès
Les endpoints d'admin sont protégés par un jeton Bearer simple.

- Endpoints:
	- `GET /admin/spots/pending` — liste les soumissions en attente (triées par date, côté serveur)
	- `PATCH /admin/spots/{id}` — met à jour des champs (nom, type, submittedBy, moderationNote) et/ou le statut (`approved`/`rejected`)

- Sécurité:
	- Backend lit la variable d’environnement `ADMIN_TOKEN` (voir `backend/serverless.yml`).
	- Frontend envoie l’en-tête `Authorization: Bearer <token>` via `EXPO_PUBLIC_ADMIN_TOKEN`.

### Local
- Par défaut en local, `ADMIN_TOKEN` vaut `dev`. Pour le forcer explicitement:

```bash
cd backend
ADMIN_TOKEN=dev npm run dev
# ou en mémoire (sans Docker/Java)
ADMIN_TOKEN=dev USE_INMEMORY=true npx serverless offline --stage dev
```

- Exemple curl:

```bash
curl -s -H "Authorization: Bearer dev" http://localhost:3000/admin/spots/pending | jq
curl -s -X PATCH http://localhost:3000/admin/spots/s1 \
	-H "Authorization: Bearer dev" \
	-H "Content-Type: application/json" \
	-d '{"moderationNote":"ok","status":"approved"}' | jq
```

### Déploiement Lambda (AWS)
Deux options pour définir `ADMIN_TOKEN` côté AWS :

1) Via Serverless Framework au moment du déploiement (recommandé pour rester dans l’Infra-as-Code):

```bash
cd backend
ADMIN_TOKEN="votre-jeton-solide" npx serverless deploy
```

Le token est injecté dans les variables d’environnement de toutes les Lambdas déployées (via `provider.environment`).

2) Via la console AWS (moins traçable):
- Ouvrir chaque fonction Lambda créée par Serverless
- Onglet Configuration > Environment variables
- Ajouter `ADMIN_TOKEN` avec la même valeur sur toutes les fonctions
- Enregistrer et republier si nécessaire

Frontend (Expo) — utilisez la même valeur côté app :

```bash
EXPO_PUBLIC_ADMIN_TOKEN="votre-jeton-solide" npm run web
# ou en CI/build, injectez EXPO_PUBLIC_ADMIN_TOKEN dans l'environnement
```

Notes:
- Ne commitez pas le token dans Git. Préférez des secrets CI/CD ou AWS SSM/Secrets Manager.
- Pour une vraie prod multi-utilisateurs, envisagez Cognito/IDP + rôles plutôt qu’un token statique.

## Captcha (svgCaptcha) — Configuration
Deux endpoints backend existent pour le captcha:

- `GET /captcha` → génère un SVG et un "secret" (le texte chiffré)
- `POST /captcha/verify` → vérifie `{ secret, answer }` et renvoie `{ ok: true|false }`

Clé privée et variable d’environnement:

- Nom de la variable d’env: `CAPTCHA_PRIVATE_KEY`
- Cette valeur n’est pas la clé binaire elle‑même: le backend dérive une clé AES‑256 à partir de votre chaîne via SHA‑256.
- Utilisez une chaîne à forte entropie (32+ octets aléatoires) et ne la commitez jamais.

Générer une clé forte (au choix):

```bash
# Hex 64 chars (32 octets)
openssl rand -hex 32

# Base64 ~44 chars (32 octets)
openssl rand -base64 32

# Avec Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Local (serverless-offline):

```bash
cd backend
export CAPTCHA_PRIVATE_KEY="<votre-chaîne-secrète>"
npx serverless offline --stage dev
# GET http://localhost:3000/captcha
# POST http://localhost:3000/captcha/verify { secret, answer }
```

Déploiement (Serverless):

```bash
cd backend
CAPTCHA_PRIVATE_KEY="<votre-chaîne-secrète>" npx serverless deploy
```

AWS Console (alternatif):
- Ouvrez chaque Lambda
- Configuration → Environment variables
- Ajoutez `CAPTCHA_PRIVATE_KEY` avec la même valeur pour toutes les fonctions

GitHub (Secrets):
- Définissez un secret de dépôt nommé `CAPTCHA_PRIVATE_KEY` (Settings → Secrets and variables → Actions)
- Dans votre workflow (deploy), exportez ce secret vers l’environnement du job ou du step qui appelle `serverless deploy`:

```yaml
# Exemple minimal
jobs:
	deploy:
		runs-on: ubuntu-latest
		steps:
			- uses: actions/checkout@v4
			- uses: actions/setup-node@v4
				with: { node-version: '20' }
			- run: npm ci && cd backend && npm ci
			- name: Deploy
				run: cd backend && npx serverless deploy
				env:
					CAPTCHA_PRIVATE_KEY: ${{ secrets.CAPTCHA_PRIVATE_KEY }}
					ADMIN_TOKEN: ${{ secrets.ADMIN_TOKEN }}
```

Sécurité:
- Ne divulguez jamais `CAPTCHA_PRIVATE_KEY`. Utilisez GitHub Secrets, SSM, ou Secrets Manager.
- Changez‑la régulièrement si possible.