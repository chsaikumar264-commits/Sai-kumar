import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  SkipBack,
  SkipForward,
  Sparkles,
  Smartphone,
  Monitor,
  Square,
  Wand2,
  Headphones,
  Volume1,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
  Video,
} from 'lucide-react';
import { CaptionOverlay } from './CaptionOverlay';
import { CaptionSegment, CaptionStyleConfig, AspectRatio, DubbingTrack } from '../types';
import { formatDisplayTime } from '../utils/subtitleParsers';
import { PRESET_STYLES } from '../utils/demoData';

interface VideoPlayerProps {
  videoUrl: string;
  segments: CaptionSegment[];
  style: CaptionStyleConfig;
  onStyleChange: (style: CaptionStyleConfig) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onSeek: (time: number) => void;
  onOpenSocialKit: () => void;
  onOpenHookDoctor: () => void;
  activeSegmentId?: string;
  activeDubbingTrack?: DubbingTrack | null;
  onOpenDubbingStudio?: () => void;
  uploadedFile?: File | null;
  onTranscodeVideo?: (file: File) => Promise<void>;
  isTranscoding?: boolean;
  onOpenUploader?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  segments,
  style,
  onStyleChange,
  aspectRatio,
  onAspectRatioChange,
  videoRef,
  currentTime,
  duration,
  onTimeUpdate,
  onDurationChange,
  onSeek,
  onOpenSocialKit,
  onOpenHookDoctor,
  activeDubbingTrack,
  onOpenDubbingStudio,
  uploadedFile,
  onTranscodeVideo,
  isTranscoding = false,
  onOpenUploader,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isDubbedAudioActive, setIsDubbedAudioActive] = useState(true);

  // Dubbed audio playback synchronization
  const activeSegmentAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTriggeredSegmentIdRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Sync playing state
  const togglePlay = () => {
    if (!videoRef.current || hasError) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (activeSegmentAudioRef.current) {
        activeSegmentAudioRef.current.pause();
      }
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch((err) => {
          console.warn('Playback play request failed:', err);
          setIsLoading(false);
        });
    }
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, duration));
    if (videoRef.current) {
      videoRef.current.currentTime = clamped;
    }
    if (activeSegmentAudioRef.current) {
      activeSegmentAudioRef.current.pause();
    }
    lastTriggeredSegmentIdRef.current = null;
    onSeek(clamped);
  };

  // High-precision 60fps playback timestamp synchronization loop
  useEffect(() => {
    let animId: number;
    const syncLoop = () => {
      if (videoRef.current && !videoRef.current.paused) {
        onTimeUpdate(videoRef.current.currentTime);
      }
      if (isPlaying) {
        animId = requestAnimationFrame(syncLoop);
      }
    };

    if (isPlaying) {
      animId = requestAnimationFrame(syncLoop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, onTimeUpdate]);

  // Synchronize dubbed audio track with video playback & duck original audio
  useEffect(() => {
    if (activeDubbingTrack && isDubbedAudioActive && isPlaying) {
      // Apply audio ducking to the original video background
      if (videoRef.current && !isMuted) {
        const duckFactor = activeDubbingTrack.duckOriginalVolume ?? 0.15;
        videoRef.current.volume = Math.max(0, Math.min(1, volume * duckFactor));
      }

      // Check if current time falls within any dubbed segment
      const activeSeg = activeDubbingTrack.segments.find(
        (s) => currentTime >= s.start && currentTime <= s.end && s.audioBase64
      );

      if (activeSeg) {
        if (lastTriggeredSegmentIdRef.current !== activeSeg.segmentId) {
          lastTriggeredSegmentIdRef.current = activeSeg.segmentId;
          if (activeSegmentAudioRef.current) {
            activeSegmentAudioRef.current.pause();
          }
          const audio = new Audio(`data:audio/wav;base64,${activeSeg.audioBase64}`);
          const targetVol = (activeDubbingTrack.dubbedVoiceVolume ?? 1.0) * volume;
          audio.volume = Math.max(0, Math.min(1, targetVol));
          const offset = Math.max(0, currentTime - activeSeg.start);
          if (offset > 0.05 && offset < activeSeg.end - activeSeg.start) {
            audio.currentTime = offset;
          }
          audio.playbackRate = playbackSpeed;
          audio.play().catch(() => {});
          activeSegmentAudioRef.current = audio;
        }
      } else {
        if (lastTriggeredSegmentIdRef.current !== null) {
          lastTriggeredSegmentIdRef.current = null;
          if (activeSegmentAudioRef.current) {
            activeSegmentAudioRef.current.pause();
          }
        }
      }
    } else {
      // Restore normal video volume when dubbing is disabled or paused
      if (videoRef.current && !isMuted) {
        videoRef.current.volume = volume;
      }
      if (activeSegmentAudioRef.current && !isPlaying) {
        activeSegmentAudioRef.current.pause();
      }
    }
  }, [
    currentTime,
    isPlaying,
    isDubbedAudioActive,
    activeDubbingTrack,
    volume,
    isMuted,
    playbackSpeed,
  ]);

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    handleSeek(pos * duration);
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
      videoRef.current.muted = newVol === 0;
      setIsMuted(newVol === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.muted = false;
      setIsMuted(false);
      videoRef.current.volume = volume || 1;
    } else {
      videoRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const changeSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current.requestFullscreen();
    }
  };

  // Keyboard shortcut listener (Space to play/pause, Left/Right arrow to seek)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentTime - 2);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentTime + 2);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, duration]);

  // Frame aspect ratio dimensions styling
  const aspectClass =
    aspectRatio === '9:16'
      ? 'aspect-[9/16] max-h-[640px] w-auto'
      : aspectRatio === '1:1'
      ? 'aspect-square max-h-[540px] w-auto'
      : 'aspect-[16/9] w-full max-h-[520px]';

  return (
    <div className="flex flex-col items-center w-full">
      {/* Top Bar: Quick Ratio Selector & AI Power Badges */}
      <div className="flex flex-wrap items-center justify-between w-full max-w-2xl px-2 mb-3 gap-2 text-xs">
        {/* Aspect Ratio Tabs */}
        <div className="inline-flex items-center bg-zinc-900/90 border border-zinc-800 rounded-lg p-1 text-zinc-400">
          <button
            onClick={() => onAspectRatioChange('9:16')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              aspectRatio === '9:16'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'hover:text-zinc-200'
            }`}
            title="Vertical 9:16 (TikTok, Reels, Shorts)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>9:16 Shorts</span>
          </button>
          <button
            onClick={() => onAspectRatioChange('16:9')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              aspectRatio === '16:9'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'hover:text-zinc-200'
            }`}
            title="Landscape 16:9 (YouTube)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>16:9 Video</span>
          </button>
          <button
            onClick={() => onAspectRatioChange('1:1')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-all ${
              aspectRatio === '1:1'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'hover:text-zinc-200'
            }`}
            title="Square 1:1 (Feed)"
          >
            <Square className="w-3.5 h-3.5" />
            <span>1:1 Feed</span>
          </button>
        </div>

        {/* Video Dimensions & Duration Badge */}
        {dimensions && (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>{dimensions.width}×{dimensions.height}</span>
            <span className="text-zinc-600">&bull;</span>
            <span>{formatDisplayTime(duration)}</span>
          </div>
        )}

        {/* AI Quick Tools */}
        <div className="flex items-center gap-1.5">
          {onOpenUploader && (
            <button
              onClick={onOpenUploader}
              className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg transition-colors font-semibold"
              title="Import a new video file (MP4, MOV, MKV, WEBM, AVI)"
            >
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import Video</span>
            </button>
          )}
          {onOpenDubbingStudio && (
            <button
              onClick={onOpenDubbingStudio}
              className={`flex items-center gap-1 px-2.5 py-1 border rounded-lg transition-colors font-semibold ${
                activeDubbingTrack
                  ? 'bg-teal-500/20 text-teal-300 border-teal-500/40 ring-1 ring-teal-500/30'
                  : 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border-teal-500/30'
              }`}
              title="Multilingual Voice Auto Dubbing"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Auto Dub</span>
            </button>
          )}
          <button
            onClick={onOpenHookDoctor}
            className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg transition-colors font-semibold"
            title="Analyze retention score of your first 3 seconds"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hook Doctor</span>
          </button>
          <button
            onClick={onOpenSocialKit}
            className="flex items-center gap-1 px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg transition-colors font-semibold"
            title="Generate viral hooks, post captions & hashtags"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Viral Kit</span>
          </button>
        </div>
      </div>

      {/* Video Viewport Container */}
      <div
        ref={containerRef}
        className={`relative flex items-center justify-center bg-black rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 group transition-all duration-300 ease-in-out ${aspectClass}`}
      >
        {/* Floating Active Dubbed Audio Indicator Pill */}
        {activeDubbingTrack && (
          <div className="absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-none">
            <div className="pointer-events-auto bg-zinc-950/85 backdrop-blur-md border border-teal-500/40 rounded-full px-3 py-1 shadow-lg flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="font-bold text-white text-[11px]">
                Dubbed: {activeDubbingTrack.language}
              </span>
              <span className="text-[10px] text-zinc-400">
                ({activeDubbingTrack.voiceProfileName})
              </span>
              <div className="h-3 w-px bg-zinc-700 mx-0.5" />
              <button
                onClick={() => setIsDubbedAudioActive(!isDubbedAudioActive)}
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                  isDubbedAudioActive
                    ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
                title="Toggle between Cloned Dubbed Audio and Original Video Audio"
              >
                {isDubbedAudioActive ? 'DUB ACTIVE' : 'ORIGINAL'}
              </button>
            </div>

            {onOpenDubbingStudio && (
              <button
                onClick={onOpenDubbingStudio}
                className="pointer-events-auto bg-zinc-950/80 hover:bg-zinc-900 border border-zinc-800 rounded-full px-2.5 py-1 text-[10px] text-zinc-300 font-medium transition-colors backdrop-blur-md"
              >
                Adjust Dubbing
              </button>
            )}
          </div>
        )}

        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          preload="metadata"
          crossOrigin={
            videoUrl.startsWith('blob:') ||
            videoUrl.startsWith('data:') ||
            videoUrl.startsWith('/api/')
              ? undefined
              : 'anonymous'
          }
          className="w-full h-full object-cover"
          onWaiting={() => setIsLoading(true)}
          onPlaying={() => {
            setIsLoading(false);
            setHasError(false);
            setIsPlaying(true);
          }}
          onCanPlay={() => {
            setIsLoading(false);
            setHasError(false);
          }}
          onError={(e) => {
            const err = (e.currentTarget as HTMLVideoElement).error;
            console.error('Video decode/playback error:', err);
            setIsLoading(false);
            setHasError(true);
            setIsPlaying(false);
            setErrorMessage(
              err?.code === 4
                ? 'The browser cannot decode this video codec directly (e.g. H.265/HEVC or 10-bit color).'
                : err?.code === 3
                ? 'Playback aborted due to a video decoding error.'
                : 'Unable to decode or stream video.'
            );
          }}
          onTimeUpdate={() => {
            if (videoRef.current) {
              onTimeUpdate(videoRef.current.currentTime);
            }
          }}
          onLoadedMetadata={(e) => {
            setIsLoading(false);
            setHasError(false);
            const v = e.currentTarget;
            if (v) {
              onDurationChange(v.duration);
              if (v.videoWidth && v.videoHeight) {
                setDimensions({ width: v.videoWidth, height: v.videoHeight });
              }
            }
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onSeeked={() => {
            if (videoRef.current) {
              onTimeUpdate(videoRef.current.currentTime);
            }
          }}
          onEnded={() => setIsPlaying(false)}
          onClick={togglePlay}
        />

        {/* Live Synchronized Caption Overlay */}
        <CaptionOverlay
          currentTime={currentTime}
          segments={segments}
          style={style}
          isPlaying={isPlaying}
          videoWidth={dimensions?.width}
          videoHeight={dimensions?.height}
        />

        {/* Loading Spinner State Overlay */}
        {isLoading && !hasError && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex flex-col items-center justify-center z-30 pointer-events-none">
            <div className="p-3.5 rounded-2xl bg-zinc-950/80 border border-zinc-800 shadow-2xl flex items-center gap-2.5 text-xs text-white">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              <span className="font-medium">Buffering video...</span>
            </div>
          </div>
        )}

        {/* Playback Error State Overlay */}
        {hasError && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mb-3">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-white text-sm mb-1">Playback / Codec Error</h4>
            <p className="text-xs text-zinc-300 max-w-sm mb-2 font-medium">
              {errorMessage || 'Unable to decode video format.'}
            </p>
            <p className="text-[11px] text-zinc-400 max-w-xs mb-4">
              Many Windows and mobile videos record in H.265/HEVC or 10-bit color, which browsers cannot play without transcoding.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              {uploadedFile && onTranscodeVideo && (
                <button
                  onClick={() => onTranscodeVideo(uploadedFile)}
                  disabled={isTranscoding}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                  title="Convert H.265/HEVC video into web-compatible H.264 + AAC MP4 with FFmpeg"
                >
                  {isTranscoding ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Transcoding to H.264 (FFmpeg)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Convert to H.264 (FFmpeg)</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current
                      .play()
                      .then(() => {
                        setIsPlaying(true);
                        setIsLoading(false);
                      })
                      .catch(() => {
                        setIsLoading(false);
                        setHasError(true);
                      });
                  }
                }}
                className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold transition-all flex items-center gap-2 border border-zinc-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Playback</span>
              </button>
            </div>
          </div>
        )}

        {/* Big Center Play Button Overlay when paused and ready */}
        {!isPlaying && !isLoading && !hasError && (
          <button
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-16 h-16 flex items-center justify-center rounded-full bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/40 backdrop-blur-sm transition-all transform hover:scale-110 active:scale-95 z-30"
          >
            <Play className="w-8 h-8 ml-1 fill-white" />
          </button>
        )}

        {/* Subtle Gradient Overlay on Bottom for Controls */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />

        {/* In-Video Bottom Controls Bar */}
        <div className="absolute inset-x-0 bottom-0 p-3 flex flex-col gap-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* Interactive Timeline Bar */}
          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            className="relative w-full h-2.5 bg-white/20 hover:h-3.5 rounded-full cursor-pointer transition-all flex items-center overflow-hidden"
          >
            {/* Visual Segments Markers */}
            {duration > 0 &&
              segments.map((seg) => {
                const left = (seg.start / duration) * 100;
                const width = ((seg.end - seg.start) / duration) * 100;
                return (
                  <div
                    key={seg.id}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    className="absolute top-0 bottom-0 bg-indigo-500/50 hover:bg-indigo-400 border-r border-black/40"
                    title={`Segment: "${seg.text}" (${formatDisplayTime(seg.start)} - ${formatDisplayTime(seg.end)})`}
                  />
                );
              })}

            {/* Current Playback Progress */}
            <div
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full relative"
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
            </div>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between text-white text-xs">
            {/* Left Controls: Play, Step, Time */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePlay}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
              </button>

              <button
                onClick={() => handleSeek(currentTime - 2)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                title="Rewind 2 seconds"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSeek(currentTime + 2)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                title="Forward 2 seconds"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleSeek(0)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                title="Restart"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <span className="font-mono text-zinc-300 ml-1">
                {formatDisplayTime(currentTime, true)} / {formatDisplayTime(duration)}
              </span>
            </div>

            {/* Right Controls: Speed, Volume, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Playback Speed dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="px-2 py-1 rounded hover:bg-white/10 font-mono text-xs text-zinc-300 hover:text-white"
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-40 w-20">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <button
                        key={s}
                        onClick={() => changeSpeed(s)}
                        className={`w-full text-left px-3 py-1 hover:bg-indigo-600/30 text-xs ${
                          playbackSpeed === s ? 'text-indigo-400 font-bold' : 'text-zinc-300'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume */}
              <div className="flex items-center gap-1 group/vol">
                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-14 h-1 bg-zinc-700 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white"
                title="Fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Floating 1-Click Style Switcher Row */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 px-2 max-w-2xl">
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mr-1">
          Viral Presets:
        </span>
        {Object.entries(PRESET_STYLES).map(([key, pStyle]) => {
          const isActive = style.presetName === pStyle.presetName;
          return (
            <button
              key={key}
              onClick={() => onStyleChange({ ...pStyle })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400 shadow-md shadow-indigo-500/25 scale-105'
                  : 'bg-zinc-900/90 text-zinc-300 border-zinc-800 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: pStyle.highlightColor }}
              />
              <span>{pStyle.presetName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
