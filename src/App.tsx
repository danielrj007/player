import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Maximize, 
  Minimize, 
  Shield,
  Share2,
  Copy,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Link,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';

interface PlayerState {
  url: string;
  fileName: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  showControls: boolean;
  blobUrl: string | null;
}

interface ShareableLink {
  token: string;
  url: string;
  createdAt: Date;
}

function App() {
  const [mediaUrl, setMediaUrl] = useState('');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shareableLink, setShareableLink] = useState<ShareableLink | null>(null);
  const [showShareSection, setShowShareSection] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Check URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const media = urlParams.get('media');
    
    if (token && media) {
      try {
        const decodedUrl = atob(media);
        setMediaUrl(decodedUrl);
        loadMediaFromUrl(decodedUrl, token);
      } catch (e) {
        setError('Link compartilhado inválido');
      }
    }
  }, []);

  const generateToken = (): string => {
    return 'token-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now().toString(36);
  };

  const isValidMediaUrl = (url: string): boolean => {
    const validExtensions = ['.mp4', '.mp3', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv', '.m4v'];
    return validExtensions.some(ext => url.toLowerCase().includes(ext)) &&
           (url.includes('mediafire.com') || url.includes('drive.google.com') || url.startsWith('http'));
  };

  const extractFileName = (url: string): string => {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const fileName = decodeURIComponent(lastPart.split('?')[0]);
    return fileName || 'Mídia sem nome';
  };

  const createProtectedBlob = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, {
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`Erro HTTP: ${response.status}`);
      }
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      throw new Error('Erro ao carregar mídia. Verifique se o link está correto e acessível.');
    }
  };

  const loadMediaFromUrl = async (url: string, existingToken?: string) => {
    setError('');
    setSuccess('');
    
    if (!url.trim()) {
      setError('Por favor, insira um URL válido');
      return;
    }

    if (!isValidMediaUrl(url)) {
      setError('URL inválido. Certifique-se que é um link direto para um arquivo de mídia.');
      return;
    }

    setIsLoading(true);
    
    try {
      const fileName = extractFileName(url);
      const blobUrl = await createProtectedBlob(url);
      
      setPlayer({
        url,
        fileName,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        isFullscreen: false,
        showControls: true,
        blobUrl
      });

      // Generate shareable link
      const token = existingToken || generateToken();
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('token', token);
      currentUrl.searchParams.set('media', btoa(url));
      
      setShareableLink({
        token,
        url: currentUrl.toString(),
        createdAt: new Date()
      });

      setShowShareSection(true);
      setSuccess('Player carregado com sucesso!');

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao carregar mídia');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePlayer = () => {
    loadMediaFromUrl(mediaUrl);
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const showControls = () => {
    if (player) {
      setPlayer(prev => prev ? { ...prev, showControls: true } : null);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      controlsTimeoutRef.current = setTimeout(() => {
        if (player?.isPlaying) {
          setPlayer(prev => prev ? { ...prev, showControls: false } : null);
        }
      }, 3000);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current || !player) return;
    
    if (player.isPlaying) {
      videoRef.current.pause();
    } else {
      if (!videoRef.current.src && player.blobUrl) {
        videoRef.current.src = player.blobUrl;
      }
      videoRef.current.play();
    }
    
    setPlayer(prev => prev ? { ...prev, isPlaying: !prev.isPlaying } : null);
    showControls();
  };

  const toggleMute = () => {
    if (!videoRef.current || !player) return;
    
    if (player.isMuted) {
      videoRef.current.volume = player.volume;
      setPlayer(prev => prev ? { ...prev, isMuted: false } : null);
    } else {
      videoRef.current.volume = 0;
      setPlayer(prev => prev ? { ...prev, isMuted: true } : null);
    }
    showControls();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !player) return;
    
    const newVolume = parseFloat(e.target.value);
    videoRef.current.volume = newVolume;
    setPlayer(prev => prev ? { 
      ...prev, 
      volume: newVolume, 
      isMuted: newVolume === 0 
    } : null);
    showControls();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !player) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * player.duration;
    
    videoRef.current.currentTime = newTime;
    setPlayer(prev => prev ? { ...prev, currentTime: newTime } : null);
    showControls();
  };

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;
    
    try {
      if (!document.fullscreenElement) {
        await playerRef.current.requestFullscreen();
        setPlayer(prev => prev ? { ...prev, isFullscreen: true } : null);
      } else {
        await document.exitFullscreen();
        setPlayer(prev => prev ? { ...prev, isFullscreen: false } : null);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
    showControls();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || !player) return;
    
    setPlayer(prev => prev ? {
      ...prev,
      currentTime: videoRef.current!.currentTime,
      duration: videoRef.current!.duration || 0
    } : null);
  };

  const copyShareLink = async () => {
    if (!shareableLink) return;
    
    try {
      await navigator.clipboard.writeText(shareableLink.url);
      setSuccess('Link copiado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao copiar link');
      setTimeout(() => setError(''), 3000);
    }
  };

  const openShareLink = () => {
    if (shareableLink) {
      window.open(shareableLink.url, '_blank');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGeneratePlayer();
    }
  };

  const getVolumeIcon = () => {
    if (player?.isMuted || player?.volume === 0) return <VolumeX className="w-5 h-5" />;
    if (player?.volume > 0.5) return <Volume2 className="w-5 h-5" />;
    return <Volume1 className="w-5 h-5" />;
  };

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (player?.blobUrl) {
        URL.revokeObjectURL(player.blobUrl);
      }
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setPlayer(prev => prev ? { 
        ...prev, 
        isFullscreen: !!document.fullscreenElement 
      } : null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Handle video pause to remove src for security
  useEffect(() => {
    if (!videoRef.current || !player) return;

    const handlePause = () => {
      setTimeout(() => {
        if (videoRef.current?.paused) {
          // Keep the blob URL but remove the src attribute for security
          videoRef.current.removeAttribute('src');
        }
      }, 2000);
    };

    videoRef.current.addEventListener('pause', handlePause);
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('pause', handlePause);
      }
    };
  }, [player]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-r from-red-600 to-red-500 p-4 rounded-full shadow-lg">
              <Share2 className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent mb-4">
            Player Compartilhável
          </h1>
          <p className="text-gray-400 text-xl max-w-2xl mx-auto">
            Carregue seus vídeos e gere links compartilháveis com proteção avançada contra download
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border border-gray-700/50">
          <div className="flex items-center gap-3 mb-6">
            <Link className="w-6 h-6 text-red-400" />
            <h2 className="text-2xl font-semibold text-gray-100">
              Insira o Link da Mídia
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://download.mediafire.com/.../video.mp4"
              className="flex-1 px-6 py-4 text-lg bg-gray-900/50 border-2 border-gray-600 rounded-2xl text-gray-100 placeholder-gray-500 focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all duration-200 outline-none backdrop-blur-sm"
            />
            <button
              onClick={handleGeneratePlayer}
              disabled={isLoading}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold py-4 px-8 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 min-w-[200px] shadow-lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Carregando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Gerar Player
                </>
              )}
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            Suporta links diretos do Mediafire, Google Drive e outros serviços de hospedagem
          </p>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-700/50 rounded-xl flex items-center gap-3 backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300">{error}</p>
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-4 bg-green-900/50 border border-green-700/50 rounded-xl flex items-center gap-3 backdrop-blur-sm">
              <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-300">{success}</p>
            </div>
          )}
        </div>

        {/* Player Section */}
        {player && (
          <div className="mb-8">
            {/* Video Title */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-3xl px-6 py-4 border-b border-gray-700/50 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100 truncate flex items-center gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                {player.fileName}
              </h2>
              <div className="flex items-center gap-2 text-green-400">
                <Shield className="w-5 h-5" />
                <span className="text-sm font-medium">Protegido</span>
              </div>
            </div>

            {/* Video Player */}
            <div 
              ref={playerRef}
              className="relative bg-black rounded-b-3xl overflow-hidden shadow-2xl group"
              onMouseMove={showControls}
              onMouseLeave={() => {
                if (controlsTimeoutRef.current) {
                  clearTimeout(controlsTimeoutRef.current);
                }
                controlsTimeoutRef.current = setTimeout(() => {
                  if (player.isPlaying) {
                    setPlayer(prev => prev ? { ...prev, showControls: false } : null);
                  }
                }, 1000);
              }}
            >
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <video
                  ref={videoRef}
                  src={player.blobUrl || ''}
                  className="absolute inset-0 w-full h-full bg-black cursor-pointer"
                  onClick={togglePlayPause}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleTimeUpdate}
                  controlsList="nodownload"
                  disablePictureInPicture
                />

                {/* Player Controls */}
                <div 
                  className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 transition-opacity duration-300 ${
                    player.showControls ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* Progress Bar */}
                  <div 
                    className="w-full h-2 bg-white/20 rounded-full mb-4 cursor-pointer group/progress"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full relative group-hover/progress:from-red-400 group-hover/progress:to-red-500 transition-all duration-200"
                      style={{ width: `${(player.currentTime / player.duration) * 100 || 0}%` }}
                    >
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-red-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"></div>
                    </div>
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Play/Pause */}
                      <button
                        onClick={togglePlayPause}
                        className="text-white hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full"
                      >
                        {player.isPlaying ? (
                          <Pause className="w-6 h-6" />
                        ) : (
                          <Play className="w-6 h-6" />
                        )}
                      </button>

                      {/* Volume Controls */}
                      <div className="flex items-center gap-2 group/volume">
                        <button
                          onClick={toggleMute}
                          className="text-white hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full"
                        >
                          {getVolumeIcon()}
                        </button>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.01"
                          value={player.isMuted ? 0 : player.volume}
                          onChange={handleVolumeChange}
                          className="w-0 group-hover/volume:w-20 transition-all duration-200 h-1 bg-white/20 rounded-full appearance-none slider"
                        />
                      </div>

                      {/* Time Display */}
                      <div className="text-white text-sm font-mono bg-black/30 px-3 py-1 rounded-full">
                        {formatTime(player.currentTime)} / {formatTime(player.duration)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="text-white hover:text-red-400 transition-colors p-2 hover:bg-white/10 rounded-full"
                      >
                        {player.isFullscreen ? (
                          <Minimize className="w-5 h-5" />
                        ) : (
                          <Maximize className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Share Section */}
        {showShareSection && shareableLink && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-3xl shadow-2xl p-8 mb-8 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <Share2 className="w-6 h-6 text-red-400" />
              <h2 className="text-2xl font-semibold text-gray-100">
                Link Compartilhável
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={shareableLink.url}
                  readOnly
                  className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-600 rounded-xl text-gray-300 text-sm font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={copyShareLink}
                    className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copiar
                  </button>
                  <button
                    onClick={openShareLink}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Abrir
                  </button>
                </div>
              </div>
              
              <div className="text-sm text-gray-400">
                <p>• Link gerado em: {shareableLink.createdAt.toLocaleString('pt-BR')}</p>
                <p>• Token: {shareableLink.token}</p>
              </div>
            </div>
          </div>
        )}

        {/* Security Features Info */}
        <div className="bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm rounded-3xl p-8 border border-gray-600/50">
          <h3 className="text-2xl font-bold text-gray-100 mb-6 flex items-center gap-3">
            <Shield className="w-7 h-7 text-red-400" />
            Recursos de Proteção:
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Carregamento via Blob URL protegido</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Remoção automática do src quando pausado</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Links compartilháveis com tokens únicos</span>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Prevenção de download direto</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Limpeza automática de recursos</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Interface responsiva e moderna</span>
              </div>
            </div>
          </div>
          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-xl">
            <p className="text-sm text-yellow-300">
              <strong>Nota:</strong> Estas proteções dificultam significativamente o download não autorizado, 
              mas não são 100% infalíveis contra usuários muito técnicos. Use em conjunto com outras medidas de segurança.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, #dc2626, #ef4444);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(45deg, #dc2626, #ef4444);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 8px rgba(220, 38, 38, 0.3);
        }
      `}</style>
    </div>
  );
}

export default App;