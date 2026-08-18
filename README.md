# Clairtext

Une application web moderne qui transforme une image en texte éditable grâce à la reconnaissance optique de caractères (OCR).

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

## Démarrage

```bash
npm install
npm run dev
```

Puis ouvrir l’adresse indiquée par Vite.

## Vérifications

```bash
npm run lint
npm run build
```

## Stack

- React 18
- TypeScript
- Vite
- Tesseract.js
- Lucide React

> Lors de la toute première reconnaissance dans une langue, Tesseract.js télécharge son modèle linguistique puis le met en cache dans le navigateur. Une connexion internet est donc nécessaire pour cette première utilisation.
