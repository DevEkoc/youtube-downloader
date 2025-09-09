import os
import tempfile
import threading
import uuid
import yt_dlp
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app, expose_headers=['Content-Disposition'])

# Dictionnaire pour suivre l'état des tâches de téléchargement
tasks = {}

def download_task(task_id, url, download_format, quality, temp_dir):
    """
    Fonction exécutée dans un thread pour gérer le téléchargement avec yt-dlp.
    """
    def progress_hook(d):
        if d['status'] == 'downloading':
            percent_str = d['_percent_str'].strip()
            try:
                # Extrait le pourcentage et le met à jour dans le dictionnaire des tâches
                tasks[task_id]['progress'] = float(percent_str.replace('%',''))
            except (ValueError, TypeError):
                tasks[task_id]['progress'] = 0 # Gérer les cas où le pourcentage n'est pas clair
        elif d['status'] == 'finished':
            tasks[task_id]['status'] = 'merging' # Le téléchargement est fini, le merging commence potentiellement

    try:
        tasks[task_id]['status'] = 'downloading'
        
        if download_format == 'audio':
            ydl_opts = {
                'format': 'bestaudio/best',
                'extractaudio': True,
                'audioformat': 'mp3',
                'audioquality': '0',
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'progress_hooks': [progress_hook],
                'socket_timeout': 120,
            }
        else:  # Format vidéo
            format_string = f'bestvideo[height<={quality[:-1]}]+bestaudio/best[height<={quality[:-1]}]/best'
            if quality == 'best':
                format_string = 'bestvideo+bestaudio/best'

            ydl_opts = {
                'format': format_string,
                'merge_output_format': 'mp4',
                'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
                'progress_hooks': [progress_hook],
                'socket_timeout': 120,
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
            if os.path.exists(filename):
                if download_format == 'video':
                    os.rename(filename, final_path)
                else:
                    # Pour l'audio, le fichier MP3 existe déjà avec le bon nom
                    if not os.path.exists(final_path) and os.path.exists(filename.replace('.webm', '.mp3').replace('.m4a', '.mp3')):
                        final_path = filename.replace('.webm', '.mp3').replace('.m4a', '.mp3')
            
            if os.path.exists(final_path):
                tasks[task_id]['status'] = 'complete'
                tasks[task_id]['filepath'] = final_path
                tasks[task_id]['filename'] = os.path.basename(final_path)
            else:
                raise FileNotFoundError("Le fichier final n'a pas été trouvé après le téléchargement.")

    except Exception as e:
        tasks[task_id]['status'] = 'error'
        tasks[task_id]['message'] = str(e)


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
    # Nous devons le garder en mémoire pour que le thread puisse l'utiliser
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
    import shutil
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
    app.run(debug=True, port=5001)
