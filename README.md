# Clairtext

Une application web moderne qui transforme une image en texte éditable grâce à la reconnaissance optique de caractères (OCR).

Tout se passe **dans votre navigateur** : aucune image n’est envoyée vers un serveur applicatif.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation pas à pas](#installation-pas-à-pas)
- [Utilisation](#utilisation)
- [Scripts disponibles](#scripts-disponibles)
- [Build de production](#build-de-production)
- [Déploiement](#déploiement)
  - [Vercel](#déploiement-sur-vercel)
  - [Netlify](#déploiement-sur-netlify)
  - [Local / auto-hébergé](#déploiement-local--auto-hébergé)
- [Dépannage](#dépannage)
- [Stack technique](#stack-technique)
- [Structure du projet](#structure-du-projet)
- [Licence](#licence)

## Fonctionnalités

- Import par sélecteur de fichier, glisser-déposer ou collage (`Ctrl/Cmd + V`)
- Reconnaissance de texte en français, anglais, espagnol, allemand, italien et portugais
- Aperçu du document et rotation avant analyse
- Progression détaillée de l’OCR et possibilité d’annuler
- Édition, copie et téléchargement du résultat au format `.txt`
- Indicateurs de mots, caractères et niveau de confiance
- Historique local des quatre dernières conversions
- Image d’exemple générée directement dans le navigateur
- Interface responsive et accessible
- Aucune image envoyée vers un serveur applicatif : l’OCR s’exécute dans le navigateur avec Tesseract.js

---

# Tutoriel complet

## Prérequis

### Logiciels

| Outil | Version recommandée | Vérification | Remarque |
| --- | --- | --- | --- |
| [Node.js](https://nodejs.org/) | **18.18+**, idéalement 20 LTS ou 22 LTS | `node --version` | Vite 6 exige Node 18.18+, 20.9+ ou ≥ 22 |
| npm | 9+ (fourni avec Node) | `npm --version` | `pnpm` ou `yarn` fonctionnent également |
| [Git](https://git-scm.com/) | 2.30+ | `git --version` | Pour cloner le dépôt |

> Vous pouvez aussi utiliser [nvm](https://github.com/nvm-sh/nvm) pour installer la bonne version de Node :
>
> ```bash
> nvm install 22
> nvm use 22
> ```

### Navigateur

Un navigateur moderne (Chrome/Edge 90+, Firefox 90+, Safari 16.4+) supportant :

- les **Web Workers** et **WebAssembly** (utilisés par Tesseract.js) ;
- l’API `createImageBitmap` et `<canvas>` (rotation de l’image) ;
- le `localStorage` (historique des conversions).

### Connexion internet

Lors de la **toute première reconnaissance dans une langue donnée**, Tesseract.js télécharge son moteur WebAssembly et le modèle linguistique (`.traineddata`, ~2 à 15 Mo) depuis un CDN, puis les met en cache dans le navigateur. Une connexion internet est donc nécessaire à ce moment-là ; les analyses suivantes fonctionnent ensuite hors ligne.

### Matériel

L’OCR est exécuté côté client : comptez au moins **4 Go de RAM** et un processeur récent pour une analyse fluide. Une page A4 scannée prend généralement de 3 à 15 secondes.

---

## Installation pas à pas

### 1. Cloner le dépôt

```bash
git clone https://github.com/zxch-0/image-to-text.git
cd image-to-text
```

> Si vous travaillez sur un fork, remplacez l’URL par celle de votre dépôt.

### 2. Vérifier votre version de Node

```bash
node --version   # doit afficher v18.18.0 ou supérieur
npm --version
```

### 3. Installer les dépendances

```bash
npm install
```

L’installation crée le dossier `node_modules/` (ignoré par Git) et respecte les versions figées dans `package-lock.json`.

> Pour une installation strictement reproductible (CI, machine de build) :
>
> ```bash
> npm ci
> ```

### 4. Lancer le serveur de développement

```bash
npm run dev
```

Vous devriez voir :

```
  VITE v6.x.x  ready in 160 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

Ouvrez ensuite **<http://localhost:5173>** dans votre navigateur. Le rechargement à chaud (HMR) est actif : toute modification de `src/App.tsx` ou `src/styles.css` est appliquée instantanément.

Pour arrêter le serveur : `Ctrl + C` dans le terminal.

### 5. Vérifier que tout est correct

```bash
npm run lint    # analyse statique ESLint + TypeScript
npm run build   # compilation TypeScript puis build Vite
```

Les deux commandes doivent se terminer sans erreur.

### Personnaliser le port ou l’hôte (optionnel)

```bash
npm run dev -- --port 3000        # changer le port
npm run dev -- --host             # exposer sur le réseau local
```

Ou de façon permanente dans `vite.config.ts` :

```ts
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
})
```

---

## Utilisation

### 1. Importer une image

Trois méthodes équivalentes :

| Méthode | Comment faire |
| --- | --- |
| Sélecteur de fichier | Cliquez sur la zone d’import et choisissez une image |
| Glisser-déposer | Faites glisser un fichier depuis votre explorateur vers la zone d’import |
| Collage | Copiez une capture d’écran puis appuyez sur `Ctrl + V` (`Cmd + V` sur macOS) n’importe où sur la page |

Vous pouvez aussi cliquer sur **l’image d’exemple**, générée à la volée dans le navigateur, pour tester l’application sans fichier personnel.

**Contraintes de fichier :**

- Formats acceptés : `JPG` / `JPEG`, `PNG`, `WebP`, `BMP`
- Taille maximale : **10 Mo**

### 2. Choisir la langue

Sélectionnez la langue du document dans le menu déroulant : Français, Anglais, Espagnol, Allemand, Italien ou Portugais. Le choix de la langue influence fortement la qualité du résultat (accents, ligatures, dictionnaire interne).

### 3. Ajuster l’image

Utilisez le bouton **Rotation** pour redresser un document photographié de travers (rotations de 90° successives). La rotation est appliquée avant l’analyse OCR.

### 4. Lancer la reconnaissance

Cliquez sur le bouton d’extraction. Une barre de progression détaillée affiche chaque étape :

1. Préparation de votre image…
2. Chargement du moteur OCR…
3. Initialisation du moteur…
4. Chargement du modèle linguistique…
5. Analyse de l’image…
6. Lecture du texte en cours…

Vous pouvez **annuler** à tout moment pendant le traitement.

### 5. Exploiter le résultat

- **Éditer** : le texte extrait est modifiable directement dans la zone de résultat.
- **Copier** : copie l’intégralité du texte dans le presse-papiers.
- **Télécharger** : enregistre un fichier `.txt` nommé d’après l’image source.
- **Statistiques** : nombre de mots, de caractères et niveau de confiance (en %) renvoyé par Tesseract.

### 6. Historique

Les **quatre dernières conversions** sont conservées dans le `localStorage` du navigateur (clé `clairtext-history`). Elles restent disponibles après un rechargement de la page et ne quittent jamais votre machine. Videz les données de site de votre navigateur pour les effacer.

### Conseils pour de meilleurs résultats

- Privilégiez une image **nette**, bien éclairée et **cadrée droit**.
- Visez au moins **300 DPI** pour un document scanné.
- Un texte foncé sur fond clair donne de meilleurs scores qu’un texte en négatif.
- Recadrez pour ne garder que la zone de texte utile.
- Sélectionnez la bonne langue : un texte anglais analysé en français perd en précision.
- Les écritures manuscrites et les polices très décoratives restent mal reconnues par Tesseract.

---

## Scripts disponibles

| Commande | Description |
| --- | --- |
| `npm run dev` | Serveur de développement Vite avec HMR (port 5173) |
| `npm run build` | Vérification des types (`tsc -b`) puis build de production dans `dist/` |
| `npm run preview` | Sert localement le contenu de `dist/` (port 4173) |
| `npm run lint` | Analyse ESLint du projet (TypeScript, React Hooks, React Refresh) |

---

## Build de production

### 1. Générer le build

```bash
npm run build
```

Le script exécute deux étapes :

1. `tsc -b` — vérifie les types TypeScript (le build échoue en cas d’erreur de type) ;
2. `vite build` — produit les fichiers statiques optimisés.

Sortie attendue :

```
dist/index.html                   0.62 kB │ gzip:  0.38 kB
dist/assets/index-xxxxxxxx.css   27.31 kB │ gzip:  7.08 kB
dist/assets/index-xxxxxxxx.js   193.70 kB │ gzip: 62.74 kB
✓ built in 2.18s
```

### 2. Tester le build en local

```bash
npm run preview
```

Puis ouvrez **<http://localhost:4173>**. Testez au moins une conversion complète pour valider le chargement du moteur OCR.

### Contenu de `dist/`

Le dossier `dist/` contient uniquement des fichiers **statiques** (HTML, CSS, JS). Aucun serveur Node n’est requis en production : n’importe quel hébergeur de fichiers statiques suffit. Ce dossier est ignoré par Git (`.gitignore`).

### Déploiement dans un sous-répertoire

Si le site n’est pas servi à la racine du domaine (par exemple `https://exemple.com/clairtext/`), définissez la base dans `vite.config.ts` :

```ts
export default defineConfig({
  base: '/clairtext/',
  plugins: [react()],
})
```

---

## Déploiement

L’application étant 100 % statique, le déploiement se résume à publier le dossier `dist/`.

### Déploiement sur Vercel

#### Option A — via l’interface web (recommandé)

1. Poussez votre code sur GitHub, GitLab ou Bitbucket.
2. Sur [vercel.com](https://vercel.com), cliquez sur **Add New… → Project** et importez le dépôt.
3. Vercel détecte automatiquement Vite. Vérifiez la configuration :

   | Champ | Valeur |
   | --- | --- |
   | Framework Preset | `Vite` |
   | Build Command | `npm run build` |
   | Output Directory | `dist` |
   | Install Command | `npm install` (ou `npm ci`) |
   | Node.js Version | 20.x ou 22.x |

4. Cliquez sur **Deploy**. Le site est publié en une à deux minutes sur une URL `*.vercel.app`.
5. Chaque `git push` déclenche ensuite un nouveau déploiement (preview sur les branches, production sur `main`).

#### Option B — via la CLI

```bash
npm i -g vercel
vercel login
vercel          # déploiement de prévisualisation
vercel --prod   # déploiement en production
```

#### Fichier `vercel.json` (optionnel)

Utile pour figer la configuration ou ajouter une redirection SPA :

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Déploiement sur Netlify

#### Option A — via l’interface web

1. Sur [app.netlify.com](https://app.netlify.com), choisissez **Add new site → Import an existing project**.
2. Connectez votre dépôt Git.
3. Renseignez les paramètres de build :

   | Champ | Valeur |
   | --- | --- |
   | Build command | `npm run build` |
   | Publish directory | `dist` |
   | Node version | 20 ou 22 (variable `NODE_VERSION`) |

4. Cliquez sur **Deploy site**.

#### Option B — via la CLI

```bash
npm i -g netlify-cli
netlify login
npm run build
netlify deploy --dir=dist          # prévisualisation
netlify deploy --dir=dist --prod   # production
```

#### Option C — glisser-déposer

Exécutez `npm run build`, puis déposez le dossier `dist/` sur [app.netlify.com/drop](https://app.netlify.com/drop).

#### Fichier `netlify.toml` (optionnel)

À créer à la racine du projet :

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Déploiement local / auto-hébergé

#### 1. Prévisualisation Vite

```bash
npm run build
npm run preview -- --host --port 4173
```

#### 2. Serveur statique simple

```bash
npm run build
npx serve dist          # http://localhost:3000
# ou
python3 -m http.server 8080 --directory dist
```

#### 3. Nginx

```nginx
server {
    listen 80;
    server_name clairtext.exemple.com;
    root /var/www/clairtext/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Copiez le build sur le serveur puis rechargez Nginx :

```bash
rsync -av --delete dist/ user@serveur:/var/www/clairtext/dist/
ssh user@serveur 'sudo nginx -t && sudo systemctl reload nginx'
```

#### 4. Docker

`Dockerfile` :

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

```bash
docker build -t clairtext .
docker run -p 8080:80 clairtext   # http://localhost:8080
```

#### Notes importantes pour tout déploiement

- **HTTPS obligatoire** en production : l’accès au presse-papiers (`navigator.clipboard`) et les Web Workers exigent un contexte sécurisé (`https://` ou `localhost`).
- **CDN accessible** : par défaut, Tesseract.js télécharge son cœur WebAssembly et les modèles linguistiques depuis un CDN public. Si vous appliquez une *Content Security Policy*, autorisez au minimum :

  ```
  script-src 'self' blob: https://cdn.jsdelivr.net https://unpkg.com;
  worker-src 'self' blob:;
  connect-src 'self' blob: data: https://cdn.jsdelivr.net https://unpkg.com;
  img-src 'self' blob: data:;
  ```

- Pour un fonctionnement **totalement hors ligne**, hébergez vous-même les fichiers de Tesseract.js et renseignez `corePath`, `workerPath` et `langPath` dans l’appel à `createWorker` (`src/App.tsx`).

---

## Dépannage

### Installation

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `Unsupported engine` / `EBADENGINE` | Version de Node trop ancienne | Installez Node 20 ou 22 (`nvm install 22 && nvm use 22`) |
| `npm ERR! code ERESOLVE` | Cache ou arbre de dépendances corrompu | `rm -rf node_modules package-lock.json && npm install` |
| Installation très lente ou bloquée | Proxy ou registre npm inaccessible | `npm config set registry https://registry.npmjs.org/` puis relancez |
| `EACCES: permission denied` | Droits insuffisants | N’utilisez pas `sudo npm install` ; corrigez les droits du dossier ou utilisez nvm |

### Serveur de développement

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `Port 5173 is already in use` | Un autre processus occupe le port | `npm run dev -- --port 3000`, ou libérez le port : `lsof -ti:5173 \| xargs kill` |
| Page blanche au démarrage | Erreur JavaScript | Ouvrez la console du navigateur (F12) et lisez la première erreur |
| Le HMR ne rafraîchit plus | Cache Vite obsolète | Arrêtez le serveur, supprimez `node_modules/.vite`, relancez |
| `Blocked request. This host is not allowed` | Accès via un domaine distant ou un tunnel | Ajoutez le domaine à `server.allowedHosts` dans `vite.config.ts` |
| Site inaccessible depuis un autre appareil | Serveur lié à `localhost` | `npm run dev -- --host` et ouvrez le pare-feu du port |

### Build

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| Le build échoue sur `tsc -b` | Erreur de typage TypeScript | Lisez le fichier et la ligne indiqués ; corrigez le type fautif |
| `error TS6133: ... is declared but its value is never read` | `noUnusedLocals` / `noUnusedParameters` activés | Supprimez la variable ou le paramètre inutilisé |
| Le build passe mais la page est blanche en production | Chemins d’assets incorrects | Renseignez `base` dans `vite.config.ts` si le site est dans un sous-répertoire |
| Build OK en local, échec en CI | Dépendances non figées | Utilisez `npm ci` et alignez la version de Node |

### OCR / utilisation

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| « Format non pris en charge » | Fichier autre que JPG, PNG, WebP ou BMP (PDF, HEIC, TIFF…) | Convertissez l’image dans un format accepté |
| « L’image dépasse la taille maximale de 10 Mo » | Fichier trop lourd | Compressez ou redimensionnez l’image |
| « Aucun texte n’a été détecté » | Image floue, texte trop petit, mauvaise langue | Améliorez la netteté, recadrez, redressez, vérifiez la langue choisie |
| La progression reste bloquée vers 30 % | Téléchargement du modèle linguistique en cours ou bloqué | Patientez lors du premier usage ; vérifiez l’accès au CDN et le pare-feu/bloqueur |
| `Failed to fetch` / erreur réseau pendant l’analyse | CDN inaccessible ou CSP trop stricte | Vérifiez la connexion, assouplissez la CSP ou auto-hébergez les fichiers Tesseract |
| Résultat rempli de caractères parasites | Mauvaise langue ou image bruitée | Changez de langue, augmentez le contraste, rescannez à 300 DPI |
| Accents mal reconnus | Analyse en anglais d’un texte français | Sélectionnez « Français » avant de lancer l’analyse |
| Le bouton « Copier » ne fonctionne pas | Contexte non sécurisé (HTTP) ou permission refusée | Servez le site en HTTPS ou via `localhost` ; sinon sélectionnez le texte et copiez manuellement |
| `Ctrl + V` ne colle pas l’image | Le focus est dans un champ de saisie, ou le presse-papiers ne contient pas d’image | Cliquez en dehors des champs, puis recollez |
| L’onglet plante ou l’analyse est très lente | Image très grande, mémoire insuffisante | Réduisez la résolution de l’image, fermez les autres onglets |
| L’historique a disparu | `localStorage` vidé ou navigation privée | Comportement normal : l’historique est purement local |

### Déploiement

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| 404 sur les fichiers `assets/*` | Mauvais dossier publié ou `base` incorrecte | Publiez bien `dist/` et vérifiez `base` dans `vite.config.ts` |
| Le build passe sur Vercel/Netlify mais le site est vide | Output directory erroné | Réglez le répertoire de publication sur `dist` |
| Build échoué sur la plateforme avec une erreur Node | Version de Node par défaut trop ancienne | Fixez `NODE_VERSION=22` (Netlify) ou la version Node dans les réglages Vercel |
| L’OCR fonctionne en local mais pas en ligne | CSP, HTTPS manquant ou CDN bloqué | Consultez la console du navigateur et appliquez les règles CSP ci-dessus |

### Réinitialisation complète

```bash
rm -rf node_modules dist package-lock.json
npm cache clean --force
npm install
npm run build
```

---

## Stack technique

- **React 18** — interface utilisateur
- **TypeScript 5.6** — typage statique strict
- **Vite 6** — serveur de développement et bundler
- **Tesseract.js 5** — moteur OCR WebAssembly côté client
- **Lucide React** — icônes
- **ESLint 9** — qualité de code

## Structure du projet

```
image-to-text/
├── index.html            # Point d’entrée HTML
├── package.json          # Dépendances et scripts npm
├── vite.config.ts        # Configuration Vite (plugin React, serveur)
├── eslint.config.js      # Configuration ESLint
├── tsconfig*.json        # Configurations TypeScript
├── src/
│   ├── main.tsx          # Montage de l’application React
│   ├── App.tsx           # Composant principal (import, OCR, résultat, historique)
│   └── styles.css        # Feuille de styles complète
└── dist/                 # Build de production (généré, non versionné)
```

## Confidentialité

Aucune image et aucun texte ne transitent par un serveur applicatif : l’OCR s’exécute entièrement dans votre navigateur, et l’historique reste dans le `localStorage` de votre machine. Seuls le moteur WebAssembly et les modèles linguistiques sont téléchargés depuis un CDN public, puis mis en cache.

## Licence

Ce projet est distribué sous licence MIT. Voir le fichier [LICENSE](LICENSE).
