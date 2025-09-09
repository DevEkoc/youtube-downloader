'use client';

import { useState } from 'react';

// --- Icônes ---
const YouTubeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
    <path d="M21.582,6.186c-0.23-0.86-0.908-1.538-1.768-1.768C18.267,4,12,4,12,4S5.733,4,4.186,4.418 c-0.86,0.23-1.538,0.908-1.768,1.768C2,7.733,2,12,2,12s0,4.267,0.418,5.814c0.23,0.86,0.908,1.538,1.768,1.768 C5.733,20,12,20,12,20s6.267,0,7.814-0.418c0.861-0.23,1.538-0.908,1.768-1.768C22,16.267,22,12,22,12S22,7.733,21.582,6.186z M10,15.464V8.536L16,12L10,15.464z"/>
  </svg>
);

const SpinnerIcon = () => (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
);

// --- Types ---
type VideoFormat = {
  quality: string;
  type: 'video' | 'audio';
  filesize?: number;
  format_id?: string;
  url?: string;
  ext: string;
};

type VideoInfo = {
  title: string;
  duration: number;
  url: string;
  formats: VideoFormat[];
};

type PreviewData = {
  status: string;
  type: 'video' | 'playlist';
  title: string;
  duration?: number;
  url?: string;
  formats?: VideoFormat[];
  count?: number;
  entries?: VideoInfo[];
  common_qualities?: string[];
};

export default function HomePage() {
  const [url, setUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [selectedPlaylistQuality, setSelectedPlaylistQuality] = useState<string>('');
  const [downloadingItems, setDownloadingItems] = useState<Set<string>>(new Set());

  const API_BASE_URL = 'http://127.0.0.1:5001';

  // --- Fonction pour obtenir un aperçu du contenu ---
  const getPreview = async () => {
    if (!url) return;
    
    setIsLoadingPreview(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error('Failed to get preview');
      }

      const previewData: PreviewData = await response.json();
      setPreview(previewData);
      
      // Pré-sélectionner la première qualité commune pour les playlists
      if (previewData.type === 'playlist' && previewData.common_qualities && previewData.common_qualities.length > 0) {
        setSelectedPlaylistQuality(previewData.common_qualities[0]);
      }
    } catch (error) {
      console.error('Preview error:', error);
      setPreview(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // --- Fonction utilitaire pour formater la taille des fichiers ---
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Taille inconnue';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  };

  // --- Fonction utilitaire pour formater la durée ---
  const formatDuration = (seconds: number): string => {
    if (!seconds) return 'Durée inconnue';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // --- Fonction pour télécharger une vidéo individuelle ---
  const downloadVideo = async (videoUrl: string, quality: string, title: string) => {
    const downloadKey = `${videoUrl}_${quality}`;
    
    if (downloadingItems.has(downloadKey)) return;
    
    setDownloadingItems(prev => new Set(prev).add(downloadKey));
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/download-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl, quality }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Créer le lien de téléchargement
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      // Nom de fichier avec qualité
      const cleanTitle = title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
      const filename = quality === 'audio' ? `${cleanTitle}.mp3` : `${cleanTitle}_${quality}.mp4`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Download error:', error);
      alert('Erreur lors du téléchargement');
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadKey);
        return newSet;
      });
    }
  };

  // --- Fonction pour télécharger une playlist ---
  const downloadPlaylist = async () => {
    if (!preview || !selectedPlaylistQuality || !preview.entries) return;
    
    const downloadKey = `playlist_${selectedPlaylistQuality}`;
    
    if (downloadingItems.has(downloadKey)) return;
    
    setDownloadingItems(prev => new Set(prev).add(downloadKey));
    
    try {
      const urls = preview.entries.map(entry => entry.url);
      
      const response = await fetch(`${API_BASE_URL}/api/download-playlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          urls, 
          quality: selectedPlaylistQuality,
          playlist_title: preview.title 
        }),
      });

      if (!response.ok) {
        throw new Error('Playlist download failed');
      }

      // Créer le lien de téléchargement
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const cleanTitle = preview.title.replace(/[^a-zA-Z0-9 ]/g, '').trim();
      link.download = `${cleanTitle}_${selectedPlaylistQuality}.zip`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
    } catch (error) {
      console.error('Playlist download error:', error);
      alert('Erreur lors du téléchargement de la playlist');
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(downloadKey);
        return newSet;
      });
    }
  };

  // --- Fonction pour recommencer ---
  const startOver = () => {
    setUrl('');
    setPreview(null);
    setSelectedPlaylistQuality('');
    setDownloadingItems(new Set());
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="p-8 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
            YouTube Downloader
          </h1>

          {/* Formulaire d'URL (caché après preview) */}
          {!preview && (
            <div className="space-y-6">
              <div className="relative">
                <YouTubeIcon />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... ou playlist"
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300 text-white placeholder-gray-400"
                  required
                  disabled={isLoadingPreview}
                />
              </div>

              <button
                onClick={getPreview}
                disabled={!url || isLoadingPreview}
                className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-cyan-500/50"
              >
                {isLoadingPreview ? <SpinnerIcon /> : 'Analyser le lien'}
              </button>
            </div>
          )}

          {/* Interface de preview et téléchargement */}
          {preview && (
            <div className="space-y-6">
              {/* En-tête avec bouton retour */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-cyan-300">
                    {preview.type === 'playlist' ? '📋 Playlist' : '🎬 Vidéo'}
                  </h2>
                  <p className="text-white font-medium">{preview.title}</p>
                  {preview.type === 'playlist' && (
                    <p className="text-gray-400 text-sm">{preview.count} vidéos</p>
                  )}
                  {preview.type === 'video' && preview.duration && (
                    <p className="text-gray-400 text-sm">Durée: {formatDuration(preview.duration)}</p>
                  )}
                </div>
                <button
                  onClick={startOver}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg text-white text-sm transition-colors"
                >
                  Nouveau lien
                </button>
              </div>

              {/* Vidéo unique - Liste des qualités */}
              {preview.type === 'video' && preview.formats && (
                <div>
                  <h3 className="text-lg font-semibold text-cyan-300 mb-4">Choisissez votre qualité :</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {preview.formats.map((format, index) => {
                      const downloadKey = `${preview.url}_${format.quality}`;
                      const isDownloading = downloadingItems.has(downloadKey);
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                          <div>
                            <span className="text-white font-medium">
                              {format.type === 'audio' ? '🎵 Audio (MP3)' : `🎬 ${format.quality}`}
                            </span>
                            <p className="text-gray-400 text-sm">{formatFileSize(format.filesize)}</p>
                          </div>
                          <button
                            onClick={() => downloadVideo(preview.url!, format.quality, preview.title)}
                            disabled={isDownloading}
                            className="flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all duration-300"
                          >
                            {isDownloading ? <SpinnerIcon /> : (
                              <>
                                <DownloadIcon />
                                Télécharger
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Playlist - Sélection de qualité commune */}
              {preview.type === 'playlist' && preview.common_qualities && (
                <div>
                  <h3 className="text-lg font-semibold text-cyan-300 mb-4">Télécharger la playlist complète :</h3>
                  <div className="bg-white/5 rounded-lg border border-white/10 p-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="flex-1">
                        <label htmlFor="playlist-quality" className="block text-sm font-medium text-gray-300 mb-2">
                          Qualité pour toutes les vidéos :
                        </label>
                        <select
                          id="playlist-quality"
                          value={selectedPlaylistQuality}
                          onChange={(e) => setSelectedPlaylistQuality(e.target.value)}
                          className="w-full px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none"
                        >
                          {preview.common_qualities.map((quality) => (
                            <option key={quality} value={quality} className="bg-gray-800">
                              {quality === 'audio' ? 'Audio (MP3)' : quality}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={downloadPlaylist}
                        disabled={!selectedPlaylistQuality || downloadingItems.has(`playlist_${selectedPlaylistQuality}`)}
                        className="flex items-center px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-bold transition-all duration-300"
                      >
                        {downloadingItems.has(`playlist_${selectedPlaylistQuality}`) ? <SpinnerIcon /> : (
                          <>
                            <DownloadIcon />
                            Télécharger ZIP
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Aperçu des vidéos de la playlist */}
                  {preview.entries && (
                    <div className="mt-6">
                      <h4 className="text-md font-medium text-cyan-300 mb-3">Contenu de la playlist :</h4>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {preview.entries.slice(0, 20).map((entry, index) => (
                          <div key={index} className="p-3 bg-white/5 rounded-lg">
                            <p className="text-white text-sm truncate">{entry.title}</p>
                            <p className="text-gray-400 text-xs">
                              {formatDuration(entry.duration)} • {entry.formats.length} formats disponibles
                            </p>
                          </div>
                        ))}
                        {preview.entries.length > 20 && (
                          <p className="text-gray-400 text-xs text-center p-2">
                            ... et {preview.entries.length - 20} autres vidéos
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="bg-black/20 px-8 py-3 text-xs text-gray-400 text-center border-t border-white/10">
          <p>Streaming direct depuis YouTube - Aucun stockage serveur</p>
        </div>
      </div>
    </main>
  );
}