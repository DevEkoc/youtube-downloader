'use client';

import { useState, useEffect, useRef } from 'react';

// --- Icônes (inchangées) ---
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

// --- Types (inchangés) ---
type Format = 'video' | 'audio';
type Quality = 'best' | '1080p' | '720p' | '480p';

// --- Nouveau Type pour le statut de la tâche ---
type TaskStatus = {
  status: 'starting' | 'downloading' | 'merging' | 'complete' | 'error' | 'idle';
  progress?: number;
  message?: string;
  filename?: string;
  task_id?: string;
};

export default function HomePage() {
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<Format>('video');
  const [quality, setQuality] = useState<Quality>('720p');
  const [task, setTask] = useState<TaskStatus>({ status: 'idle' });
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE_URL = 'http://127.0.0.1:5001';

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

  // --- Gestion de la soumission du formulaire ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (task.status === 'downloading' || task.status === 'starting' || task.status === 'merging') return;

    setTask({ status: 'starting', message: 'Initiating download...' });

    if (!url) {
      setTask({ status: 'error', message: 'Please enter a YouTube URL.' });
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality }),
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

  // --- Rendu du message de statut ---
  const renderStatusMessage = () => {
    if (task.status === 'idle') return null;

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
        {task.status === 'complete' && task.task_id && !downloadSuccess && (
          <a
            href={`${API_BASE_URL}/api/download-file/${task.task_id}`}
            className="mt-3 inline-flex items-center justify-center py-2 px-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-white font-bold transform hover:scale-105 transition-all duration-300"
            download
            onClick={() => {
              // Détecter le téléchargement après un petit délai
              setTimeout(() => {
                setDownloadSuccess(true);
              }, 1000);
            }}
          >
            <DownloadIcon />
            Télécharger le fichier
          </a>
        )}
        {downloadSuccess && (
          <div className="mt-3 p-3 bg-green-500/20 text-green-300 rounded-lg text-center">
            <p className="font-semibold">✅ Fichier téléchargé avec succès !</p>
            <p className="text-sm mt-1">Votre fichier a été sauvegardé sur votre appareil.</p>
            <button
              onClick={() => {
                setDownloadSuccess(false);
                setTask({ status: 'idle' });
                setUrl('');
              }}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Télécharger une nouvelle vidéo
            </button>
          </div>
        )}
      </div>
    );
  };

  const isLoading = task.status === 'starting' || task.status === 'downloading' || task.status === 'merging';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-blue-900 p-4 sm:p-8 font-sans">
      <div className="w-full max-w-2xl bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        <div className="p-8 sm:p-10">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400">
            YouTube Downloader
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <YouTubeIcon />
              <input
                type="url"
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300 text-white placeholder-gray-400"
                required
                disabled={isLoading}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <label className={`relative flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-300 ${format === 'video' ? 'bg-cyan-500/20 border-cyan-400' : 'bg-white/5 border-transparent'} border ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="format" value="video" checked={format === 'video'} onChange={() => setFormat('video')} className="sr-only" disabled={isLoading} />
                <span className="font-medium text-white">Video</span>
              </label>
              <label className={`relative flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-300 ${format === 'audio' ? 'bg-cyan-500/20 border-cyan-400' : 'bg-white/5 border-transparent'} border ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input type="radio" name="format" value="audio" checked={format === 'audio'} onChange={() => setFormat('audio')} className="sr-only" disabled={isLoading} />
                <span className="font-medium text-white">Audio (MP3)</span>
              </label>
            </div>

            {format === 'video' && (
              <div>
                <label htmlFor="quality" className="block text-sm font-medium text-gray-300 mb-2">Video Quality</label>
                <select
                  id="quality"
                  value={quality}
                  onChange={(e) => setQuality(e.target.value as Quality)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300 text-white disabled:opacity-50"
                  disabled={isLoading}
                >
                  <option value="best" className="bg-gray-800">Best Available</option>
                  <option value="1080p" className="bg-gray-800">1080p</option>
                  <option value="720p" className="bg-gray-800">720p</option>
                  <option value="480p" className="bg-gray-800">480p</option>
                </select>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-3 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-cyan-500/50"
              >
                {isLoading ? <SpinnerIcon /> : 'Start Download'}
              </button>
            </div>
          </form>

          {renderStatusMessage()}

        </div>
        <div className="bg-black/20 px-8 py-3 text-xs text-gray-400 text-center border-t border-white/10">
            <p>Files are served temporarily. Please download them immediately.</p>
        </div>
      </div>
    </main>
  );
}