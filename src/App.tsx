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
  Lock,
  Eye,
  EyeOff,
  AlertTriangle
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
  isProtected: boolean;
  blobUrl: string | null;
}

interface SecurityConfig {
  allowedDomains: string[];
  allowedReferrers: string[];
  enableDomainCheck: boolean;
  enableReferrerCheck: boolean;
  enableRightClickProtection: boolean;
  enableDevToolsProtection: boolean;
  enableCopyProtection: boolean;
}

function App() {
  const [url, setUrl] = useState('');
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSecuritySettings, setShowSecuritySettings] = useState(false);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>({
    allowedDomains: ['localhost', '127.0.0.1'],
    allowedReferrers: [],
    enableDomainCheck: false,
    enableReferrerCheck: false,
    enableRightClickProtection: true,
    enableDevToolsProtection: true,
    enableCopyProtection: true
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Security functions
  const encodeUrl = (url: string): string => {
    return btoa(url);
  };

  const decodeUrl = (encodedUrl: string): string => {
    try {
      return atob(encodedUrl);
    } catch {
      throw new Error('URL inválida');
    }
  };

  const checkDomainSecurity = (): boolean => {
    if (!securityConfig.enableDomainCheck) return true;
    
    const currentDomain = window.location.hostname;
    return securityConfig.allowedDomains.includes(currentDomain);
  };

  const checkReferrerSecurity = (): boolean => {
    if (!securityConfig.enableReferrerCheck) return true;
    
    const referrer = document.referrer;
    if (!referrer && securityConfig.allowedReferrers.length > 0) return false;
    
    return securityConfig.allowedReferrers.some(allowed => 
      referrer.startsWith(allowed)
    );
  };

  const createProtectedBlob = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Falha ao carregar o vídeo');
      }
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch (error) {
      throw new Error('Erro ao criar blob protegido');
    }
  };

  const isValidDirectLink = (url: string): boolean => {
    return /\.(mp3|mp4|wav|ogg|webm|flac|m4a|avi|mov)$/i.test(url);
  };

  const extractFileName = (url: string): string => {
    const urlParts = url.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    return decodeURIComponent(lastPart.split('?')[0]);
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

  const handleLoadMedia = async () => {
    setError('');
    
    if (!url.trim()) {
      setError('Por favor, insira um URL');
      return;
    }

    // Security checks
    if (!checkDomainSecurity()) {
      setError('Acesso negado: domínio não autorizado');
      return;
    }

    if (!checkReferrerSecurity()) {
      setError('Acesso negado: referrer não autorizado');
      return;
    }
    
    let decodedUrl: string;
    try {
      // Try to decode as base64 first, if it fails, use as regular URL
      decodedUrl = url.includes('http') ? url : decodeUrl(url);
    } catch {
      decodedUrl = url;
    }
    
    if (!isValidDirectLink(decodedUrl)) {
      setError('Por favor, insira um link direto válido (terminando com .mp4, .mp3, etc.)');
      return;
    }

    setIsLoading(true);
    
    try {
      const fileName = extractFileName(decodedUrl);
      const blobUrl = await createProtectedBlob(decodedUrl);
      
      setPlayer({
        url: decodedUrl,
        fileName,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        isMuted: false,
        isFullscreen: false,
        showControls: true,
        isProtected: true,
        blobUrl
      });

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao carregar mídia');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlayPause = () => {
    if (!videoRef.current || !player) return;
    
    if (player.isPlaying) {
      videoRef.current.pause();
    } else {
      // Restore blob URL if needed
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLoadMedia();
    }
  };

  const getVolumeIcon = () => {
    if (player?.isMuted || player?.volume === 0) return <VolumeX className="w-5 h-5" />;
    if (player?.volume > 0.5) return <Volume2 className="w-5 h-5" />;
    return <Volume1 className="w-5 h-5" />;
  };

  // Security event listeners
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (securityConfig.enableRightClickProtection) {
        e.preventDefault();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (securityConfig.enableDevToolsProtection) {
        // Prevent F12, Ctrl+Shift+I, Ctrl+U
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.key === 'u')) {
          e.preventDefault();
        }
      }

      if (securityConfig.enableCopyProtection) {
        // Prevent Ctrl+C, Ctrl+A, Ctrl+S
        if (e.ctrlKey && ['c', 'a', 's'].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
    };

    const handleBeforeUnload = () => {
      if (player?.blobUrl) {
        URL.revokeObjectURL(player.blobUrl);
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [securityConfig, player]);

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
        if (videoRef.current?.paused && player.isProtected) {
          videoRef.current.removeAttribute('src');
        }
      }, 1000);
    };

    videoRef.current.addEventListener('pause', handlePause);
    return () => {
      if (videoRef.current) {
        videoRef.current.removeEventListener('pause', handlePause);
      }
    };
  }, [player]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-green-600 p-3 rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-gray-100 mb-2">
            Player Protegido
          </h1>
          <p className="text-gray-400 text-lg">
            Reprodução segura com proteções avançadas contra download
          </p>
        </div>

        {/* Security Settings */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-6 mb-8 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Configurações de Segurança
            </h2>
            <button
              onClick={() => setShowSecuritySettings(!showSecuritySettings)}
              className="text-gray-400 hover:text-gray-200 transition-colors"
            >
              {showSecuritySettings ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          
          {showSecuritySettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                <input
                  type="checkbox"
                  checked={securityConfig.enableRightClickProtection}
                  onChange={(e) => setSecurityConfig(prev => ({
                    ...prev,
                    enableRightClickProtection: e.target.checked
                  }))}
                  className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Bloquear clique direito</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                <input
                  type="checkbox"
                  checked={securityConfig.enableDevToolsProtection}
                  onChange={(e) => setSecurityConfig(prev => ({
                    ...prev,
                    enableDevToolsProtection: e.target.checked
                  }))}
                  className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Bloquear ferramentas de desenvolvedor</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                <input
                  type="checkbox"
                  checked={securityConfig.enableCopyProtection}
                  onChange={(e) => setSecurityConfig(prev => ({
                    ...prev,
                    enableCopyProtection: e.target.checked
                  }))}
                  className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Bloquear copiar/colar</span>
              </label>
              
              <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                <input
                  type="checkbox"
                  checked={securityConfig.enableDomainCheck}
                  onChange={(e) => setSecurityConfig(prev => ({
                    ...prev,
                    enableDomainCheck: e.target.checked
                  }))}
                  className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500"
                />
                <span className="text-sm text-gray-300">Verificar domínio autorizado</span>
              </label>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="bg-gray-800 rounded-2xl shadow-xl p-8 mb-8 border border-gray-700">
          <h2 className="text-xl font-semibold text-gray-100 mb-4">
            Insira URL do vídeo (URL direta ou Base64)
          </h2>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="https://example.com/video.mp4 ou aHR0cHM6Ly9leGFtcGxlLmNvbS92aWRlby5tcDQ="
              className="flex-1 px-6 py-4 text-lg bg-gray-900 border-2 border-gray-600 rounded-full text-gray-100 placeholder-gray-500 focus:ring-4 focus:ring-green-500/20 focus:border-green-500 transition-all duration-200 outline-none"
            />
            <button
              onClick={handleLoadMedia}
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-8 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[200px]"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Carregando...
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Carregar Vídeo
                </>
              )}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-900/50 border border-red-700 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Player Section */}
        {player && (
          <div className="mb-8">
            {/* Video Title */}
            <div className="bg-gray-800 rounded-t-2xl px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-100 truncate">
                {player.fileName}
              </h2>
              {player.isProtected && (
                <div className="flex items-center gap-2 text-green-400">
                  <Shield className="w-5 h-5" />
                  <span className="text-sm font-medium">Protegido</span>
                </div>
              )}
            </div>

            {/* Video Player */}
            <div 
              ref={playerRef}
              className="relative bg-black rounded-b-2xl overflow-hidden shadow-2xl group"
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
                  className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 transition-opacity duration-300 ${
                    player.showControls ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {/* Progress Bar */}
                  <div 
                    className="w-full h-2 bg-white/20 rounded-full mb-4 cursor-pointer group/progress"
                    onClick={handleSeek}
                  >
                    <div 
                      className="h-full bg-green-600 rounded-full relative group-hover/progress:bg-green-500 transition-colors"
                      style={{ width: `${(player.currentTime / player.duration) * 100 || 0}%` }}
                    >
                      <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-green-600 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity"></div>
                    </div>
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Play/Pause */}
                      <button
                        onClick={togglePlayPause}
                        className="text-white hover:text-green-400 transition-colors p-2"
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
                          className="text-white hover:text-green-400 transition-colors p-2"
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
                      <div className="text-white text-sm font-mono">
                        {formatTime(player.currentTime)} / {formatTime(player.duration)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Fullscreen */}
                      <button
                        onClick={toggleFullscreen}
                        className="text-white hover:text-green-400 transition-colors p-2"
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

        {/* Security Features Info */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-8 border border-gray-600">
          <h3 className="text-xl font-bold text-gray-100 mb-4 flex items-center gap-2">
            <Shield className="w-6 h-6 text-green-400" />
            Recursos de Proteção Ativados:
          </h3>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Carregamento via Blob URL para ocultar URL original</li>
            <li>Remoção automática do src quando pausado</li>
            <li>Proteção contra clique direito e menu de contexto</li>
            <li>Bloqueio de ferramentas de desenvolvedor (F12, Ctrl+Shift+I)</li>
            <li>Prevenção de cópia e download direto</li>
            <li>Verificação de domínio e referrer (opcional)</li>
            <li>Limpeza automática de recursos ao sair da página</li>
          </ul>
          <p className="mt-4 text-sm text-gray-400">
            <strong>Nota:</strong> Estas proteções dificultam significativamente o download não autorizado, mas não são 100% infalíveis contra usuários muito técnicos.
          </p>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #16a34a;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
        
        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #16a34a;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}

export default App;