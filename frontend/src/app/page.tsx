'use client';

import { useState, useEffect, useRef } from 'react';

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
  ext: string;
};

type PreviewData = {
  status: string;
  type: 'video';
  title: string;
  duration?: number;
  url?: string;
  formats?: VideoFormat[];
};

type TaskStatus = {
  status: 'starting' | 'downloading' | 'merging' | 'complete' | 'error';
  progress?: number;
  message?: string;
  filename?: string;
  task_id?: string;
};

export default function HomePage() {
  const [url, setUrl] = useState<string>('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState<boolean>(false);
  const [task, setTask] = useState<TaskStatus | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- Fonction pour vérifier le statut de la tâche ---
  const checkStatus = async (taskId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/status/${taskId}`);
      if (!response.ok) {
        throw new Error('Could not fetch status.');
      }
      const data: TaskStatus = await response.json();

      setTask({ ...data, task_id: taskId });

      if (data.status === 'complete' || data.status === 'error') {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        
        if (data.status === 'complete') {
          setDownloadSuccess(`${data.filename} est prêt !`);
          setTimeout(() => setDownloadSuccess(null), 5000);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
      setTask({
        status: 'error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred while polling.',
        task_id: taskId
      });
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    }
  };

  // --- Nettoyage de l'intervalle au démontage du composant ---
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

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

  // --- Fonction pour télécharger une vidéo ---
  const downloadVideo = async (quality: string) => {
    if (!preview?.url) return;
    
    if (task && (task.status === 'downloading' || task.status === 'starting' || task.status === 'merging')) return;

    setTask({ status: 'starting', message: 'Initiating download...' });
    setDownloadSuccess(null);

    try {
      const format = quality === 'audio' ? 'audio' : 'video';
      const response = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: preview.url, format, quality }),
      });

      if (response.status !== 202) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to start download process.');
      }

      const { task_id } = await response.json();
      setTask({ status: 'starting', task_id: task_id, message: 'Download started, waiting for progress...' });

      // Démarrer le polling
      pollingIntervalRef.current = setInterval(() => {
        checkStatus(task_id);
      }, 2000); // Toutes les 2 secondes

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setTask({ status: 'error', message: `Failed to start download: ${errorMessage}` });
    }
  };


  // --- Fonction pour télécharger le fichier depuis le serveur ---
  const downloadFile = () => {
    if (task && task.task_id) {
      window.open(`${API_BASE_URL}/api/download-file/${task.task_id}`, '_blank');
      setDownloadSuccess('Fichier téléchargé avec succès !');
      setTimeout(() => setDownloadSuccess(null), 5000);
    }
  };

  // --- Fonction pour recommencer ---
  const startOver = () => {
    setUrl('');
    setPreview(null);
    setTask(null);
    setDownloadSuccess(null);
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // --- Rendu du message de statut ---
  const renderStatusMessage = () => {
    if (!task || (task.status === 'starting' && !task.task_id)) return null;

    let message = '';
    let isError = false;
    let showProgress = false;

    switch (task.status) {
      case 'starting':
        message = 'Starting download...';
        break;
      case 'downloading':
        message = `Downloading... ${task.progress?.toFixed(1) ?? 0}%`;
        showProgress = true;
        break;
      case 'merging':
        message = 'Processing file, please wait...';
        break;
      case 'complete':
        message = 'Votre fichier est prêt, téléchargez le en cliquant ci-dessous !';
        break;
      case 'error':
        message = `Error: ${task.message || 'An unknown error occurred.'}`;
        isError = true;
        break;
    }

    return (
      <div className={`mt-6 p-4 rounded-lg text-center text-sm transition-all duration-300 ${isError ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
        <p>{message}</p>
        {showProgress && (
          <div className="w-full bg-gray-700 rounded-full h-2.5 mt-2">
            <div className="bg-cyan-400 h-2.5 rounded-full" style={{ width: `${task.progress ?? 0}%` }}></div>
          </div>
        )}
        {task && task.status === 'complete' && task.task_id && (
          <button
            onClick={downloadFile}
            className="mt-3 inline-flex items-center justify-center py-2 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-white font-bold transform hover:scale-105 transition-all duration-300"
          >
            <DownloadIcon />
            Télécharger le fichier
          </button>
        )}
      </div>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 p-4 sm:p-8 font-sans">
      <div className="w-full max-w-4xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="p-8 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 pb-1 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
            Téléchargeur YouTube
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
                  placeholder="https://www.youtube.com/watch?v=... collez l'URL ici"
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
                  <h2 className="text-xl font-bold text-cyan-300">🎬 Vidéo</h2>
                  <p className="text-white font-medium">{preview.title}</p>
                  {preview.duration && (
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

              {/* Message de succès */}
              {downloadSuccess && (
                <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✅</span>
                    <p className="text-green-300 font-medium">{downloadSuccess}</p>
                  </div>
                </div>
              )}

              {/* Liste des qualités */}
              {preview.formats && (!task || (task.status === 'starting' && !task.task_id)) && (
                <div>
                  <h3 className="text-lg font-semibold text-cyan-300 mb-4">Choisissez votre qualité :</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {preview.formats.map((format, index) => {
                      const isDownloading = Boolean(task && (task.status === 'downloading' || task.status === 'merging' || (task.status === 'starting' && task.task_id)));
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                          <div>
                            <span className="text-white font-medium">
                              {format.type === 'audio' ? '🎵 Audio (MP3)' : `🎬 ${format.quality}`}
                            </span>
                            <p className="text-gray-400 text-sm">{formatFileSize(format.filesize)}</p>
                          </div>
                          <button
                            onClick={() => downloadVideo(format.quality)}
                            disabled={isDownloading}
                            className="flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all duration-300"
                          >
                            <DownloadIcon />
                            Télécharger
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Affichage du statut de téléchargement */}
              {renderStatusMessage()}
            </div>
          )}
        </div>
        
        <div className="bg-black/20 px-8 py-3 text-xs text-gray-400 text-center border-t border-white/10">
          <p>Téléchargement avec audio - Vidéos individuelles uniquement</p>
          <p>Powered by
            <a href={'https://devekoc.com'} className={'text-white'}>DevEkoc</a>
            - 2025
          </p>
        </div>
      </div>
    </main>
  );
}