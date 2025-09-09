import os
import yt_dlp
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
import requests
from urllib.parse import quote
import zipfile
import io
import threading

app = Flask(__name__)
CORS(app, expose_headers=['Content-Disposition'])

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
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            if 'entries' in info:  # C'est une playlist
                entries = []
                for entry in info['entries']:
                    if entry:
                        # Extraire les formats disponibles
                        formats = []
                        if 'formats' in entry:
                            # Grouper par qualité vidéo
                            video_formats = {}
                            audio_format = None
                            
                            for fmt in entry['formats']:
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
                                    'format_id': fmt.get('format_id'),
                                    'url': fmt.get('url'),
                                    'ext': fmt.get('ext', 'mp4')
                                })
                            
                            # Ajouter le format audio
                            if audio_format:
                                formats.append({
                                    'quality': 'audio',
                                    'type': 'audio',
                                    'filesize': audio_format.get('filesize'),
                                    'format_id': audio_format.get('format_id'),
                                    'url': audio_format.get('url'),
                                    'ext': 'mp3'
                                })
                        
                        entries.append({
                            'title': entry.get('title', 'Unknown'),
                            'duration': entry.get('duration', 0),
                            'url': entry.get('webpage_url', entry.get('url', '')),
                            'formats': formats
                        })
                
                # Pour playlist, obtenir les qualités communes
                common_qualities = set()
                if entries:
                    first_entry_qualities = {f['quality'] for f in entries[0]['formats']}
                    common_qualities = first_entry_qualities
                    for entry in entries[1:]:
                        entry_qualities = {f['quality'] for f in entry['formats']}
                        common_qualities = common_qualities.intersection(entry_qualities)
                
                return jsonify({
                    'status': 'success',
                    'type': 'playlist',
                    'title': info.get('title', 'Unknown Playlist'),
                    'count': len(entries),
                    'entries': entries,
                    'common_qualities': list(common_qualities)
                })
            
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
                            'format_id': fmt.get('format_id'),
                            'url': fmt.get('url'),
                            'ext': fmt.get('ext', 'mp4')
                        })
                    
                    # Ajouter le format audio
                    if audio_format:
                        formats.append({
                            'quality': 'audio',
                            'type': 'audio',
                            'filesize': audio_format.get('filesize'),
                            'format_id': audio_format.get('format_id'),
                            'url': audio_format.get('url'),
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
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/download-video', methods=['POST'])
def download_video():
    data = request.get_json()
    url = data.get('url')
    quality = data.get('quality')
    
    if not url or not quality:
        return jsonify({'status': 'error', 'message': 'URL and quality are required'}), 400
    
    try:
        # Configuration pour obtenir l'URL de streaming
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Trouver le format correspondant à la qualité demandée
            target_format = None
            if quality == 'audio':
                for fmt in info['formats']:
                    if fmt.get('acodec') != 'none' and fmt.get('vcodec') == 'none':
                        target_format = fmt
                        break
            else:
                # Pour la vidéo, chercher la qualité exacte
                target_height = int(quality.replace('p', ''))
                for fmt in info['formats']:
                    if fmt.get('height') == target_height and fmt.get('vcodec') != 'none':
                        target_format = fmt
                        break
            
            if not target_format:
                return jsonify({'status': 'error', 'message': f'Quality {quality} not found'}), 404
            
            # Obtenir l'URL directe
            stream_url = target_format.get('url')
            if not stream_url:
                return jsonify({'status': 'error', 'message': 'Stream URL not available'}), 500
            
            # Créer le nom de fichier avec la qualité
            title = info.get('title', 'video').replace('/', '_').replace('\\', '_')
            if quality == 'audio':
                filename = f"{title}.mp3"
            else:
                filename = f"{title}_{quality}.{target_format.get('ext', 'mp4')}"
            
            # Streamer le fichier
            def generate():
                response = requests.get(stream_url, stream=True)
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        yield chunk
            
            return Response(
                stream_with_context(generate()),
                headers={
                    'Content-Disposition': f'attachment; filename="{quote(filename)}"',
                    'Content-Type': 'application/octet-stream'
                }
            )
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/download-playlist', methods=['POST'])
def download_playlist():
    data = request.get_json()
    urls = data.get('urls', [])  # Liste des URLs des vidéos de la playlist
    quality = data.get('quality')
    playlist_title = data.get('playlist_title', 'playlist')
    
    if not urls or not quality:
        return jsonify({'status': 'error', 'message': 'URLs and quality are required'}), 400
    
    try:
        def generate_zip():
            # Créer un ZIP en mémoire
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for i, video_url in enumerate(urls):
                    try:
                        # Configuration pour obtenir l'URL de streaming
                        ydl_opts = {
                            'quiet': True,
                            'no_warnings': True,
                        }
                        
                        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                            info = ydl.extract_info(video_url, download=False)
                            
                            # Trouver le format correspondant à la qualité demandée
                            target_format = None
                            if quality == 'audio':
                                for fmt in info['formats']:
                                    if fmt.get('acodec') != 'none' and fmt.get('vcodec') == 'none':
                                        target_format = fmt
                                        break
                            else:
                                target_height = int(quality.replace('p', ''))
                                for fmt in info['formats']:
                                    if fmt.get('height') == target_height and fmt.get('vcodec') != 'none':
                                        target_format = fmt
                                        break
                            
                            if target_format:
                                stream_url = target_format.get('url')
                                if stream_url:
                                    # Télécharger le contenu
                                    response = requests.get(stream_url, stream=True)
                                    
                                    # Créer le nom de fichier
                                    title = info.get('title', f'video_{i+1}').replace('/', '_').replace('\\', '_')
                                    if quality == 'audio':
                                        filename = f"{title}.mp3"
                                    else:
                                        filename = f"{title}_{quality}.{target_format.get('ext', 'mp4')}"
                                    
                                    # Ajouter au ZIP
                                    with zip_file.open(filename, 'w') as file_in_zip:
                                        for chunk in response.iter_content(chunk_size=8192):
                                            if chunk:
                                                file_in_zip.write(chunk)
                    
                    except Exception as e:
                        print(f"Error downloading video {i+1}: {e}")
                        continue
            
            zip_buffer.seek(0)
            return zip_buffer.getvalue()
        
        zip_filename = f"{playlist_title}_{quality}.zip"
        
        return Response(
            generate_zip(),
            headers={
                'Content-Disposition': f'attachment; filename="{quote(zip_filename)}"',
                'Content-Type': 'application/zip'
            }
        )
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)