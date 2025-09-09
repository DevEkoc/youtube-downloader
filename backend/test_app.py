import unittest
import json
import os
import tempfile
import time
from unittest.mock import patch, MagicMock
from app import app, tasks

class YouTubeDownloaderTestCase(unittest.TestCase):
    def setUp(self):
        """Configuration avant chaque test"""
        self.app = app.test_client()
        self.app.testing = True
        # Nettoyer les tâches entre les tests
        tasks.clear()

    def tearDown(self):
        """Nettoyage après chaque test"""
        tasks.clear()

    def test_health_check(self):
        """Test de la route health check"""
        response = self.app.get('/health')
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['service'], 'youtube-downloader-backend')

    def test_preview_missing_url(self):
        """Test de preview sans URL"""
        response = self.app.post('/api/preview',
                                content_type='application/json',
                                data=json.dumps({}))
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('URL is required', data['message'])

    def test_preview_invalid_url(self):
        """Test de preview avec URL invalide"""
        response = self.app.post('/api/preview',
                                content_type='application/json',
                                data=json.dumps({'url': 'invalid-url'}))
        
        self.assertEqual(response.status_code, 500)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')

    @patch('app.yt_dlp.YoutubeDL')
    def test_preview_playlist_rejected(self, mock_ydl_class):
        """Test que les playlists sont rejetées"""
        # Mock du yt-dlp qui retourne une playlist
        mock_ydl = MagicMock()
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl
        mock_ydl.extract_info.return_value = {
            'entries': [{'title': 'Video 1'}, {'title': 'Video 2'}]
        }

        response = self.app.post('/api/preview',
                                content_type='application/json',
                                data=json.dumps({'url': 'https://youtube.com/playlist?list=test'}))
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('playlists ne sont pas supportées', data['message'])

    @patch('app.yt_dlp.YoutubeDL')
    def test_preview_valid_video(self, mock_ydl_class):
        """Test de preview d'une vidéo valide"""
        # Mock du yt-dlp qui retourne une vidéo
        mock_ydl = MagicMock()
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl
        mock_ydl.extract_info.return_value = {
            'title': 'Test Video',
            'duration': 120,
            'formats': [
                {
                    'format_id': '140',
                    'vcodec': 'none',
                    'acodec': 'mp4a.40.2',
                    'filesize': 1000000,
                    'ext': 'mp3'
                },
                {
                    'format_id': '720',
                    'vcodec': 'avc1',
                    'acodec': 'none',
                    'height': 720,
                    'filesize': 50000000,
                    'ext': 'mp4'
                }
            ]
        }

        response = self.app.post('/api/preview',
                                content_type='application/json',
                                data=json.dumps({'url': 'https://youtube.com/watch?v=test'}))
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['type'], 'video')
        self.assertEqual(data['title'], 'Test Video')
        self.assertEqual(data['duration'], 120)
        self.assertIn('formats', data)
        self.assertTrue(len(data['formats']) >= 1)

    def test_download_missing_url(self):
        """Test de téléchargement sans URL"""
        response = self.app.post('/api/download',
                                content_type='application/json',
                                data=json.dumps({}))
        
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('URL is required', data['message'])

    @patch('app.threading.Thread')
    def test_download_start_valid(self, mock_thread):
        """Test de démarrage de téléchargement valide"""
        # Mock du thread pour qu'il ne démarre pas vraiment
        mock_thread_instance = MagicMock()
        mock_thread.return_value = mock_thread_instance

        response = self.app.post('/api/download',
                                content_type='application/json',
                                data=json.dumps({
                                    'url': 'https://youtube.com/watch?v=test',
                                    'format': 'video',
                                    'quality': '720p'
                                }))
        
        self.assertEqual(response.status_code, 202)
        data = json.loads(response.data)
        
        self.assertEqual(data['status'], 'accepted')
        self.assertIn('task_id', data)
        
        # Vérifier qu'une tâche a été créée
        task_id = data['task_id']
        self.assertIn(task_id, tasks)
        self.assertEqual(tasks[task_id]['status'], 'starting')

    def test_status_task_not_found(self):
        """Test de statut pour une tâche inexistante"""
        response = self.app.get('/api/status/nonexistent-task-id')
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('Task not found', data['message'])

    def test_status_task_exists(self):
        """Test de statut pour une tâche existante"""
        # Créer une tâche factice
        task_id = 'test-task-id'
        tasks[task_id] = {
            'status': 'downloading',
            'progress': 50.5,
            'message': 'Test message'
        }

        response = self.app.get(f'/api/status/{task_id}')
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['status'], 'downloading')
        self.assertEqual(data['progress'], 50.5)
        self.assertEqual(data['message'], 'Test message')

    def test_download_file_task_not_found(self):
        """Test de téléchargement de fichier pour tâche inexistante"""
        response = self.app.get('/api/download-file/nonexistent-task-id')
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('File not ready or task not found', data['message'])

    def test_download_file_task_not_complete(self):
        """Test de téléchargement de fichier pour tâche non terminée"""
        # Créer une tâche en cours
        task_id = 'test-task-id'
        tasks[task_id] = {
            'status': 'downloading',
            'progress': 50
        }

        response = self.app.get(f'/api/download-file/{task_id}')
        
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertIn('File not ready or task not found', data['message'])

class DownloadTaskTestCase(unittest.TestCase):
    """Tests pour la fonction download_task"""
    
    def setUp(self):
        """Configuration avant chaque test"""
        tasks.clear()

    def tearDown(self):
        """Nettoyage après chaque test"""
        tasks.clear()

    @patch('app.yt_dlp.YoutubeDL')
    @patch('app.tempfile.TemporaryDirectory')
    def test_download_task_error_handling(self, mock_tempdir, mock_ydl_class):
        """Test de gestion d'erreur dans download_task"""
        from app import download_task
        
        # Mock qui lève une exception
        mock_ydl = MagicMock()
        mock_ydl_class.return_value.__enter__.return_value = mock_ydl
        mock_ydl.extract_info.side_effect = Exception("Test error")
        
        # Mock du répertoire temporaire
        mock_tempdir.return_value.name = '/tmp/test'
        
        task_id = 'test-task-id'
        tasks[task_id] = {'status': 'starting'}
        
        # Exécuter la fonction
        download_task(task_id, 'https://youtube.com/watch?v=test', 'video', '720p', '/tmp/test')
        
        # Vérifier que l'erreur a été capturée
        self.assertEqual(tasks[task_id]['status'], 'error')
        self.assertIn('message', tasks[task_id])
        self.assertEqual(tasks[task_id]['message'], 'Test error')

class UtilityTestCase(unittest.TestCase):
    """Tests pour les fonctions utilitaires"""
    
    def test_cors_configuration_production(self):
        """Test de la configuration CORS en production"""
        with patch.dict(os.environ, {'FLASK_ENV': 'production', 'FRONTEND_URL': 'https://test.com'}):
            # Recharger l'app pour prendre en compte les variables d'environnement
            from importlib import reload
            import app as app_module
            reload(app_module)
            
            # Vérifier que CORS est configuré (test indirect via les headers)
            client = app_module.app.test_client()
            response = client.options('/api/preview', headers={'Origin': 'https://test.com'})
            # Les tests CORS sont complexes, on vérifie juste qu'il n'y a pas d'erreur
            self.assertIn(response.status_code, [200, 204])

if __name__ == '__main__':
    # Configuration pour les tests
    unittest.main(verbosity=2)