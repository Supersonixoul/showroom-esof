# Showroom Virtuel ESOF

Monorepo du projet Showroom Virtuel pour ESOF (Ouagadougou) — vitrine numérique du catalogue via écran boutique (TV), app mobile client et app mobile commercial.

Spécification technique : voir `Spec_Technique_ShowroomVirtuel_ESOF_V0.docx` (v2).

## Structure

```
api/          Backend NestJS (API REST + Prisma/PostgreSQL)
app-tv/       App Flutter — écran boutique (kiosk, mode vidéos + catalogue)
app-mobile/   App Flutter — app mobile (mode client + mode commercial)
```

À venir : `admin/` (panneau d'administration web).

## Stack

- **Backend** : NestJS (Node.js) + Prisma + PostgreSQL
- **Apps** : Flutter (Android pour la TV, Android/iOS pour le mobile) + SQLite (cache local / mode hors-ligne)
- **Stockage médias** : disque local (évolutif vers MinIO/objet)

## Démarrage — Backend (`api/`)

Prérequis : PostgreSQL en local, base `esof_showroom` créée.

```bash
cd api
npm install
npx prisma migrate dev   # applique les migrations
npm run start:dev        # lance l'API en mode watch
```

La configuration de connexion se trouve dans `api/.env` (`DATABASE_URL`).

## Démarrage — Apps Flutter (`app-tv/`, `app-mobile/`)

```bash
cd app-tv      # ou app-mobile
flutter pub get
flutter run
```

## Découpage en sprints

Voir section 9 de la spécification technique. État actuel : **Sprint 0** (initialisation des dépôts, structure NestJS, migrations PostgreSQL, projets Flutter) — terminé.

## Points ouverts

Voir section 10 de la spécification technique (matériel écran, hébergement, volume catalogue initial, outil vidéos IA, distribution mobile, format PDF devis).
