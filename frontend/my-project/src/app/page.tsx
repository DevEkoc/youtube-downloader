'use client';

import { useState } from 'react';

// ... (Les icônes SVG restent les mêmes)
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

type Format = 'video' | 'audio';
type Quality = 'best' | '1080p' | '720p' | '480p';

export default function HomePage() {
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<Format>('video');
  const [quality, setQuality] = useState<Quality>('720p');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [isError, setIsError] = useState<boolean>(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setMessage('');
    setIsError(false);

    if (!url) {
      setMessage('Please enter a YouTube URL.');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://127.0.0.1:5001/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, quality }),
      });

      // Si la réponse est du JSON, c'est une erreur du backend
      if (response.headers.get('Content-Type')?.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'An unknown backend error occurred.');
      }

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      // Extraire le nom du fichier de l'en-tête Content-Disposition
      const disposition = response.headers.get('content-disposition');
      let filename = 'download'; // Nom par défaut
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=
]*=((['|"])(.*?)\2|[^;
]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[3]) {
          filename = matches[3];
        }
      }

      // Obtenir les données du fichier sous forme de Blob
      const blob = await response.blob();

      // Créer un lien temporaire pour déclencher le téléchargement
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Nettoyer
      link.remove();
      window.URL.revokeObjectURL(link.href);

      setMessage(`Download for "${filename}" has started.`);
      setIsError(false);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setMessage(`Failed to start download: ${errorMessage}`);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Le JSX du return reste identique au design précédent
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
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className={`relative flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-300 ${format === 'video' ? 'bg-cyan-500/20 border-cyan-400' : 'bg-white/5 border-transparent'} border`}>
                <input type="radio" name="format" value="video" checked={format === 'video'} onChange={() => setFormat('video')} className="sr-only" />
                <span className="font-medium text-white">Video</span>
              </label>
              <label className={`relative flex items-center justify-center p-4 rounded-lg cursor-pointer transition-all duration-300 ${format === 'audio' ? 'bg-cyan-500/20 border-cyan-400' : 'bg-white/5 border-transparent'} border`}>
                <input type="radio" name="format" value="audio" checked={format === 'audio'} onChange={() => setFormat('audio')} className="sr-only" />
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
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 outline-none transition-all duration-300 text-white"
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
                {isLoading ? <SpinnerIcon /> : 'Download'}
              </button>
            </div>
          </form>

          {message && (
            <div className={`mt-6 p-4 rounded-lg text-center text-sm transition-all duration-300 ${isError ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
              <p>{message}</p>
            </div>
          )}
        </div>
        <div className="bg-black/20 px-8 py-3 text-xs text-gray-400 text-center border-t border-white/10">
            <p>Your browser will ask you where to save the file.</p>
        </div>
      </div>
    </main>
  );
}
