# 🎬 YouTube Downloader by DevEkoc

Une application web moderne pour télécharger des vidéos et audios YouTube avec une interface élégante et une progression en temps réel.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Frontend](https://img.shields.io/badge/Frontend-Next.js_15-black)
![Backend](https://img.shields.io/badge/Backend-Flask-red)
![Status](https://img.shields.io/badge/Status-Production_Ready-success)

## ✨ Fonctionnalités

🎵 **Téléchargement Audio**
- Format MP3 haute qualité (192 kbps)
- Extraction audio pure depuis YouTube
- Noms de fichiers propres et organisés

🎬 **Téléchargement Vidéo** 
- Multiples qualités disponibles (480p, 720p, 1080p, etc.)
- Fusion automatique vidéo + audio
- Qualité incluse dans le nom du fichier

⚡ **Interface Moderne**
- Design responsive avec Tailwind CSS
- Barre de progression en temps réel
- Messages de statut informatifs
- Animations fluides et interface intuitive

## 🛠️ Technologies utilisées

### Frontend (Next.js)
- **Next.js 15** - Framework React moderne
- **TypeScript** - Typage statique
- **Tailwind CSS** - Framework CSS utilitaire
- **React Hooks** - Gestion d'état moderne

### Backend (Flask)
- **Flask** - Framework web Python minimaliste
- **yt-dlp** - Bibliothèque de téléchargement YouTube
- **Flask-CORS** - Gestion des requêtes cross-origin
- **Threading** - Téléchargements asynchrones

## 📦 Installation locale

### Prérequis
- Python 3.10+
- Node.js 18+
- npm ou yarn

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Variables d'environnement
```bash
# backend/.env
FLASK_ENV=development
FRONTEND_URL=http://localhost:3000

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## 🧪 Tests

### Tests Backend
```bash
cd backend
python -m pytest test_app.py -v
```

Coverage complète :
- ✅ 12 tests unitaires
- ✅ Tests d'intégration API
- ✅ Mocks pour yt-dlp
- ✅ Gestion d'erreur

### Tests Frontend
```bash
cd frontend
npm run lint
npm run type-check
npm run build
```

## 📋 Architecture

```
youtube-downloader/
├── 📁 frontend/          # Application Next.js
│   ├── src/app/         # Pages et composants
│   ├── public/          # Ressources statiques
│   └── package.json     # Dépendances frontend
├── 📁 backend/          # API Flask
│   ├── app.py          # Application principale
│   ├── test_app.py     # Tests unitaires
│   └── requirements.txt # Dépendances Python
└── 📄 README.md         # Ce fichier
```

## 🛡️ Sécurité

- **CORS** configuré pour domaines autorisés uniquement
- **Validation d'entrée** sur toutes les routes API
- **Gestion d'erreur** complète sans exposition d'informations sensibles
- **Nettoyage automatique** des fichiers temporaires
- **Rate limiting** natif de Render/Vercel

## 📈 Performance

- **Téléchargement streaming** : Pas de stockage serveur permanent
- **Cleanup automatique** : Mémoire et espace disque optimisés
- **CDN global** : Vercel Edge Network
- **Mise en cache** : Headers appropriés pour ressources statiques

## 🎯 Améliorations futures

### Version 2.0
- [ ] **Support des playlists** : Téléchargement ZIP de playlists complètes
- [ ] **Authentification** : Comptes utilisateur et historique
- [ ] **Formats avancés** : WebM, AV1, formats personnalisés
- [ ] **Batch download** : Téléchargement multiple simultané

### Version 2.1
- [ ] **API publique** : Documentation OpenAPI/Swagger
- [ ] **Webhooks** : Notifications de fin de téléchargement
- [ ] **Analytics** : Statistiques d'usage et métriques
- [ ] **Mobile app** : Application React Native

### Version 2.2
- [ ] **IA Integration** : Résumés automatiques, sous-titres
- [ ] **Cloud Storage** : Sauvegarde Google Drive, Dropbox
- [ ] **Social Features** : Partage, collections publiques
- [ ] **Premium Features** : Qualité 4K, téléchargements illimités

## 🤝 Contribution

1. **Fork** le projet
2. **Créer** une branche feature (`git checkout -b feature/AmazingFeature`)
3. **Commiter** les changements (`git commit -m 'Add AmazingFeature'`)
4. **Pusher** la branche (`git push origin feature/AmazingFeature`)
5. **Ouvrir** une Pull Request

### Guidelines
- Suivre les conventions de code existantes
- Ajouter des tests pour les nouvelles fonctionnalités
- Mettre à jour la documentation si nécessaire
- S'assurer que tous les tests passent

## 📞 Support

### Bugs et questions
- **Issues GitHub** : [Créer un issue](https://github.com/DevEkoc/youtube-downloader/issues)
- **Email** : christophecedricekobena@devekoc.com

## 📄 Licence

Distribué sous licence GPL-2.0. Voir `LICENSE` pour plus d'informations.

## 🙏 Remerciements

- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** - Bibliothèque de téléchargement exceptionnelle
- **[Next.js](https://nextjs.org)** - Framework React fantastique
- **[Tailwind CSS](https://tailwindcss.com)** - Framework CSS moderne
- **[Flask](https://flask.palletsprojects.com)** - Simplicité et élégance Python
- **[Render](https://render.com)** & **[Vercel](https://vercel.com)** - Hébergement cloud excellent

---

<p align="center">
  Fait avec ❤️ par <a href="https://devekoc.com">DevEkoc</a>
</p>

<p align="center">
  <a href="https://youtube-downloader.devekoc.com">🎬 Essayer maintenant</a> •
  <a href="mailto:christophecedricekobena@devekoc.com">📧 Contact</a>
</p>