import os
import tempfile
import threading
import uuid
import yt_dlp
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import shutil

app = Flask(__name__)

# Configuration CORS pour la production
if os.environ.get('FLASK_ENV') == 'production':
    # URL frontend Vercel (à mettre à jour après déploiement)
    frontend_url = os.environ.get('FRONTEND_URL', 'https://youtube-downloader-frontend.vercel.app')
    CORS(app, 
         origins=[frontend_url],
         expose_headers=['Content-Disposition'],
         allow_headers=['Content-Type', 'Authorization'],
         methods=['GET', 'POST', 'OPTIONS'])
else:
    # Configuration pour développement
    CORS(app, expose_headers=['Content-Disposition'])

# Dictionnaire pour suivre l'état des tâches de téléchargement
tasks = {}

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'youtube-downloader-backend'}), 200

def download_task(task_id, url, download_format, quality, temp_dir):
    """
    Fonction exécutée dans un thread pour gérer le téléchargement avec yt-dlp.
    """
    def progress_hook(d):
        if d['status'] == 'downloading':
            percent_str = d['_percent_str'].strip()
            try:
                # Extrait le pourcentage et le met à jour dans le dictionnaire des tâches
                current_progress = float(percent_str.replace('%',''))
                tasks[task_id]['progress'] = current_progress
            except (ValueError, TypeError):
                tasks[task_id]['progress'] = 0 # Gérer les cas où le pourcentage n'est pas clair
        elif d['status'] == 'finished':
            tasks[task_id]['status'] = 'merging' # Le téléchargement est fini, le merging commence potentiellement

    try:
        tasks[task_id]['status'] = 'downloading'
        
        # Configuration anti-bot commune
        common_opts = {
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip,deflate',
                'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
                'Keep-Alive': '300',
                'Connection': 'keep-alive',
            },
            'sleep_interval': 1,
            'max_sleep_interval': 5,
            'sleep_interval_requests': 1,
            'progress_hooks': [progress_hook],
            'socket_timeout': 120,
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
        }

        if download_format == 'audio':
            ydl_opts = {
                **common_opts,
                'format': 'bestaudio/best',
                'extractaudio': True,
                'audioformat': 'mp3',
                'audioquality': '0',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }
        else:  # Format vidéo
            # Utiliser le format qui combine vidéo + audio automatiquement
            if quality == 'best':
                format_string = 'bestvideo+bestaudio/best'
            else:
                height = quality.replace('p', '')
                format_string = f'bestvideo[height<={height}]+bestaudio/best[height<={height}]/best'

            ydl_opts = {
                **common_opts,
                'format': format_string,
                'merge_output_format': 'mp4',
            }

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info_dict = ydl.extract_info(url, download=True)
            
            # Le nom de fichier peut contenir des caractères spéciaux, il est plus sûr de le reconstruire
            filename = ydl.prepare_filename(info_dict)
            if download_format == 'audio':
                # Le post-processeur change l'extension en .mp3
                base, _ = os.path.splitext(filename)
                final_path = base + '.mp3'
            else:
                # Pour la vidéo, ajouter la qualité dans le nom de fichier
                base, ext = os.path.splitext(filename)
                final_path = f"{base}_{quality}{ext}"
                
                # Renommer le fichier téléchargé avec la qualité
                if os.path.exists(filename) and filename != final_path:
                    try:
                        os.rename(filename, final_path)
                    except OSError:
                        final_path = filename  # Garder le nom original si le renommage échoue

            if os.path.exists(final_path):
                tasks[task_id]['status'] = 'complete'
                tasks[task_id]['filepath'] = final_path
                tasks[task_id]['filename'] = os.path.basename(final_path)
            else:
                raise FileNotFoundError("Le fichier final n'a pas été trouvé après le téléchargement.")

    except Exception as e:
        error_message = str(e)
        # Messages d'erreur plus clairs pour l'utilisateur
        if "Sign in to confirm you're not a bot" in error_message:
            error_message = "YouTube a temporairement bloqué cette requête. Veuillez réessayer dans quelques minutes."
        elif "Video unavailable" in error_message:
            error_message = "Cette vidéo n'est pas disponible pour téléchargement."
        elif "network" in error_message.lower():
            error_message = "Problème de connexion réseau. Veuillez réessayer."
        
        tasks[task_id]['status'] = 'error'
        tasks[task_id]['message'] = error_message

@app.route('/api/preview', methods=['POST'])
def preview_content():
    data = request.get_json()
    url = data.get('url')
    
    if not url:
        return jsonify({'status': 'error', 'message': 'URL is required'}), 400
    
    try:
        # Configuration pour extraire seulement les informations, sans télécharger
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': False,
            # Anti-bot measures
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip,deflate',
                'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
                'Keep-Alive': '300',
                'Connection': 'keep-alive',
            },
            'sleep_interval': 1,
            'max_sleep_interval': 5,
            'sleep_interval_requests': 1,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if 'entries' in info:  # C'est une playlist
                return jsonify({
                    'status': 'error', 
                    'message': 'Les playlists ne sont pas supportées. Veuillez utiliser un lien de vidéo individuelle.'
                }), 400
            
            else:  # C'est une vidéo unique
                # Extraire les formats disponibles
                formats = []
                if 'formats' in info:
                    # Grouper par qualité vidéo
                    video_formats = {}
                    audio_format = None
                    
                    for fmt in info['formats']:
                        if fmt.get('vcodec') != 'none' and fmt.get('height'):  # Format vidéo
                            height = fmt.get('height')
                            current_size = fmt.get('filesize') or 0
                            existing_size = video_formats[height].get('filesize') or 0 if height in video_formats else 0
                            if height not in video_formats or current_size > existing_size:
                                video_formats[height] = fmt
                        elif fmt.get('acodec') != 'none' and not audio_format:  # Format audio
                            audio_format = fmt
                    
                    # Ajouter les formats vidéo triés
                    for height in sorted(video_formats.keys(), reverse=True):
                        fmt = video_formats[height]
                        formats.append({
                            'quality': f"{height}p",
                            'type': 'video',
                            'filesize': fmt.get('filesize'),
                            'ext': fmt.get('ext', 'mp4')
                        })
                    
                    # Ajouter le format audio
                    if audio_format:
                        formats.append({
                            'quality': 'audio',
                            'type': 'audio',
                            'filesize': audio_format.get('filesize'),
                            'ext': 'mp3'
                        })
                
                return jsonify({
                    'status': 'success',
                    'type': 'video',
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'url': url,
                    'formats': formats
                })
    
    except Exception as e:
        print(f"Preview error: {e}")
        import traceback
        traceback.print_exc()
        
        error_message = str(e)
        # Messages d'erreur plus clairs pour l'utilisateur
        if "Sign in to confirm you're not a bot" in error_message:
            error_message = "YouTube a temporairement bloqué cette requête. Veuillez réessayer dans quelques minutes ou essayer avec une autre vidéo."
        elif "Video unavailable" in error_message:
            error_message = "Cette vidéo n'est pas disponible (privée, supprimée ou géo-bloquée)."
        elif "This video is no longer available" in error_message:
            error_message = "Cette vidéo n'existe plus ou a été supprimée."
        elif "network" in error_message.lower():
            error_message = "Problème de connexion réseau. Veuillez réessayer."
        else:
            # Garder le message original pour les autres erreurs
            error_message = f"Impossible d'analyser cette vidéo : {error_message}"
            
        return jsonify({'status': 'error', 'message': error_message}), 500

@app.route('/api/download', methods=['POST'])
def start_download():
    data = request.get_json()
    url = data.get('url')
    download_format = data.get('format', 'video')
    quality = data.get('quality', '720p')

    if not url:
        return jsonify({'status': 'error', 'message': 'URL is required'}), 400

    task_id = str(uuid.uuid4())
    # Utiliser un dossier temporaire qui persiste tant que l'objet n'est pas détruit
    temp_dir = tempfile.TemporaryDirectory()
    
    tasks[task_id] = {
        'status': 'starting',
        'temp_dir': temp_dir, # Garder une référence pour le nettoyage
        'progress': 0
    }

    # Lancer le téléchargement dans un thread séparé
    thread = threading.Thread(target=download_task, args=(task_id, url, download_format, quality, temp_dir.name))
    thread.start()

    return jsonify({'status': 'accepted', 'task_id': task_id}), 202

@app.route('/api/status/<task_id>', methods=['GET'])
def get_status(task_id):
    task = tasks.get(task_id)
    if not task:
        return jsonify({'status': 'error', 'message': 'Task not found'}), 404
    
    response = {'status': task['status']}
    if 'message' in task:
        response['message'] = task['message']
    if 'progress' in task:
        response['progress'] = task.get('progress', 0)
    if task['status'] == 'complete':
        response['filename'] = task.get('filename')

    return jsonify(response)

@app.route('/api/download-file/<task_id>', methods=['GET'])
def download_file(task_id):
    task = tasks.get(task_id)
    if not task or task.get('status') != 'complete':
        return jsonify({'status': 'error', 'message': 'File not ready or task not found'}), 404

    filepath = task.get('filepath')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'status': 'error', 'message': 'File not found on server'}), 500

    # Copier le fichier vers un dossier temporaire différent pour éviter les conflits
    final_temp_dir = tempfile.mkdtemp()
    final_filepath = os.path.join(final_temp_dir, os.path.basename(filepath))
    shutil.copy2(filepath, final_filepath)
    
    # Nettoyer le dossier temporaire original maintenant qu'on a une copie
    try:
        task['temp_dir'].cleanup()
    except (OSError, PermissionError):
        pass  # Ignorer les erreurs de nettoyage
    
    del tasks[task_id]

    # Fonction de nettoyage qui sera appelée après l'envoi du fichier
    def cleanup_temp_file():
        try:
            if os.path.exists(final_filepath):
                os.remove(final_filepath)
            if os.path.exists(final_temp_dir):
                os.rmdir(final_temp_dir)
        except (OSError, PermissionError):
            pass

    # Programmer le nettoyage après un délai
    cleanup_thread = threading.Timer(10.0, cleanup_temp_file)
    cleanup_thread.start()

    return send_file(
        final_filepath,
        as_attachment=True
    )

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('FLASK_ENV') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)