# 🧪 Tests Backend YouTube Downloader by DevEkoc

Ce fichier explique comment exécuter et comprendre les tests du backend.

## 📋 Installation des dépendances de test

Les dépendances de test sont incluses dans `requirements.txt` :
- `pytest` : Framework de test principal
- `unittest.mock` : Pour les mocks (inclus dans Python)

```bash
pip install -r requirements.txt
```

## 🚀 Exécution des tests

### Tous les tests
```bash
# Depuis le dossier backend
python -m pytest test_app.py -v
```

### Tests spécifiques
```bash
# Test d'une classe spécifique
python -m pytest test_app.py::YouTubeDownloaderTestCase -v

# Test d'une méthode spécifique
python -m pytest test_app.py::YouTubeDownloaderTestCase::test_health_check -v

# Tests avec coverage (si installé)
python -m pytest test_app.py --cov=app --cov-report=html
```

### Méthode alternative (unittest)
```bash
python test_app.py
```

## 📊 Couverture des tests

Les tests couvrent :

### ✅ Routes API
- **Health Check** (`/health`)
- **Preview** (`/api/preview`)
- **Download Start** (`/api/download`)
- **Status Check** (`/api/status/<task_id>`)
- **File Download** (`/api/download-file/<task_id>`)

### ✅ Cas de test
- ✅ Validation des entrées (URL manquante, invalide)
- ✅ Gestion des playlists (rejet)
- ✅ Réponses de succès et d'erreur
- ✅ Gestion des tâches (création, statut, nettoyage)
- ✅ Téléchargement de fichiers
- ✅ Configuration CORS

### ✅ Fonctions utilitaires
- ✅ Gestion d'erreur dans `download_task`
- ✅ Configuration d'environnement

## 🧪 Types de tests

### Tests unitaires
- **Isolation** : Chaque fonction testée séparément
- **Mocks** : yt-dlp et threading mockés pour éviter les vraies opérations
- **Rapidité** : Tests rapides sans dépendances externes

### Tests d'intégration
- **API complète** : Test des endpoints HTTP
- **Flux complet** : De la requête à la réponse
- **États réels** : Test des structures de données

## 📝 Structure des tests

```python
class YouTubeDownloaderTestCase(unittest.TestCase):
    # Tests des routes API principales
    
class DownloadTaskTestCase(unittest.TestCase):
    # Tests de la logique de téléchargement
    
class UtilityTestCase(unittest.TestCase):
    # Tests des fonctions utilitaires
```

## 🔧 Mocks utilisés

### yt-dlp
```python
@patch('app.yt_dlp.YoutubeDL')
def test_preview_valid_video(self, mock_ydl_class):
    # Mock des réponses yt-dlp
```

### Threading
```python
@patch('app.threading.Thread')
def test_download_start_valid(self, mock_thread):
    # Évite le lancement de vrais threads
```

## 🚨 Tests d'erreur

Les tests vérifient la gestion des erreurs :
- URL manquante ou invalide
- Playlists non supportées
- Tâches inexistantes
- Exceptions yt-dlp
- Fichiers non trouvés

## 📈 Exemples de sortie

```bash
$ python -m pytest test_app.py -v

test_app.py::YouTubeDownloaderTestCase::test_health_check PASSED
test_app.py::YouTubeDownloaderTestCase::test_preview_missing_url PASSED
test_app.py::YouTubeDownloaderTestCase::test_preview_playlist_rejected PASSED
test_app.py::YouTubeDownloaderTestCase::test_preview_valid_video PASSED
test_app.py::YouTubeDownloaderTestCase::test_download_missing_url PASSED
test_app.py::YouTubeDownloaderTestCase::test_download_start_valid PASSED
test_app.py::YouTubeDownloaderTestCase::test_status_task_not_found PASSED
test_app.py::YouTubeDownloaderTestCase::test_status_task_exists PASSED
test_app.py::YouTubeDownloaderTestCase::test_download_file_task_not_found PASSED
test_app.py::YouTubeDownloaderTestCase::test_download_file_task_not_complete PASSED
test_app.py::DownloadTaskTestCase::test_download_task_error_handling PASSED
test_app.py::UtilityTestCase::test_cors_configuration_production PASSED

============== 12 passed in 0.05s ==============
```

## 🎯 Ajouter de nouveaux tests

### Template pour nouveaux tests
```python
def test_new_feature(self):
    """Description du test"""
    # Arrange - Préparer les données
    
    # Act - Exécuter l'action
    
    # Assert - Vérifier le résultat
    self.assertEqual(expected, actual)
```

### Best practices
1. **Noms descriptifs** : `test_preview_with_valid_video_url`
2. **Documentation** : Docstring expliquant le test
3. **Isolation** : Chaque test indépendant
4. **Mocks** : Éviter les dépendances externes
5. **Nettoyage** : `setUp()` et `tearDown()` appropriés

## 🔄 Intégration CI/CD

Pour intégrer dans le déploiement :

```yaml
# .github/workflows/test.yml
- name: Run tests
  run: |
    cd backend
    python -m pytest test_app.py -v
```

Les tests sont essentiels avant le déploiement en production !