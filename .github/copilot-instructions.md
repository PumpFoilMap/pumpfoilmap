Règle: ne jamais faire de git push. Seul le mainteneur pousse sur le dépôt distant.

Règle: tout code doit être accompagné d'un test unitaire et d'un test E2E.

Règle: chaque changement doit passer le lint (npm run lint) sans avertissement ni erreur.

Règle: chaque changement doit faire passer tous les tests (TU backend, TU root, Playwright E2E).

Obligations de tests (à exécuter après chaque modification):
- TU backend: `cd backend && npm test`
- TU root (frontend/lib): `npm test`
- E2E Playwright: `npm run test:e2e`

Processus d'itération jusqu'au vert:
- Après une modification, exécuter les 3 commandes ci-dessus.
- Si un test échoue: corriger de manière ciblée et ré-exécuter immédiatement.
- Itérer jusqu'à ce que tous les tests passent; ne pas conclure/valider tant que ce n'est pas vert.
- En cas d'échecs persistants (≥3 tentatives), documenter la sortie exacte, la cause probable et proposer des options de fix ou de contournement.

Règle: ignorer le fichier MYCOMMANDS.md, c'est un fichier qui ne doit pas être commité ni modifié

- Frontend
  - src/App.tsx
  - src/components/Map/Map.web.tsx
  - src/components/Map/Map.tsx
  - src/components/Map/index.tsx
  - src/services/api.ts

- Backend
  - backend/src/handlers/
  - backend/src/lib/
  - backend/serverless.yml

- Tests
  - tests/e2e/
  - backend/test/
  - src/components/Map/__tests__/cities.render.test.tsx

- Config
  - package.json
  - backend/package.json
  - tsconfig.json
  - backend/tsconfig.json
  - playwright.config.ts

- Docs
  - README.md
  - SPECIFICATION.md
