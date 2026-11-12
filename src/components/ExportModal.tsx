import React, { useState, useEffect, useRef } from 'react';
import {
  Download,
  Film,
  FileCode,
  FileText,
  Copy,
  Check,
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  Globe,
  Volume2,
  AlertTriangle,
  RotateCcw,
  Clock,
  HardDrive,
  Sliders,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { CaptionSegment, CaptionStyleConfig, DubbingTrack } from '../types';
import { generateSRT, generateVTT, generatePlainText } from '../utils/subtitleParsers';
import { uploadVideoFile } from '../utils/videoUploaderClient';

interface ExportHistoryItem {
  jobId: string;
  downloadUrl: string;
  filename: string;
  fileSize: number;
  duration: number;
  timestamp: number;
  presetName: string;
  captionCount: number;
}

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: CaptionSegment[];
  style: CaptionStyleConfig;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoTitle?: string;
  videoUrl?: string;
  uploadedFile?: File | null;
  activeDubbingTrack?: DubbingTrack | null;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  segments,
  style,
  videoRef,
  videoTitle = 'captio_video',
  videoUrl = '',
  uploadedFile = null,
  activeDubbingTrack,
}) => {
  const [activeTab, setActiveTab] = useState<'video' | 'subtitles' | 'transcript'>('video');
  const [exportStatus, setExportStatus] = useState<'idle' | 'rendering' | 'ready' | 'error'>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStepMessage, setExportStepMessage] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [latestExport, setLatestExport] = useState<ExportHistoryItem | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([]);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [uploadedServerFilename, setUploadedServerFilename] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Requirement: When user opens or reopens Export Studio, properly reset previous export session state,
  // clear previous errors, failed job states, and stale progress indicators, without deleting user's work
  useEffect(() => {
    if (isOpen) {
      setExportStatus('idle');
      setExportProgress(0);
      setExportStepMessage('');
      setExportError(null);
    } else {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setExportStatus('idle');
    setExportProgress(0);
    setExportStepMessage('');
    setExportError(null);
    onClose();
  };

  const handleStartRender = async () => {
    // Generate a fresh unique export job ID for every attempt
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    // Abort any old pending requests so they cannot interfere
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const currentController = new AbortController();
    abortControllerRef.current = currentController;

    try {
      setExportStatus('rendering');
      setExportProgress(10);
      setExportStepMessage('Validating video streams and configuration...');
      setExportError(null);

      let videoSourceToUse = videoUrl;

      // Revalidate currently selected video and ensure stream is available
      if (!videoUrl) {
        throw new Error('No active video found. Please load or upload a video before exporting.');
      }

      // If user uploaded a local file and it is currently a browser blob URL, synchronize to server
      if (videoUrl.startsWith('blob:')) {
        let fileBlob: Blob | null = uploadedFile;

        // If uploadedFile reference was lost, retrieve blob from browser memory via videoUrl
        if (!fileBlob) {
          setExportProgress(15);
          setExportStepMessage('Retrieving video data from browser cache...');
          try {
            const blobRes = await fetch(videoUrl);
            if (blobRes.ok) {
              fileBlob = await blobRes.blob();
            }
          } catch (blobErr) {
            console.warn('[ExportModal] Failed to read blob from videoUrl:', blobErr);
          }
        }

        if (!fileBlob || fileBlob.size === 0) {
          throw new Error(
            'The original video is no longer available in browser memory. Please click "Back to Editor" and re-select or drop the video file.'
          );
        }

        if (!uploadedServerFilename) {
          const cleanName = uploadedFile?.name || `${videoTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}.mp4`;
          const uploadResult = await uploadVideoFile(
            fileBlob,
            cleanName,
            {
              action: 'save',
              onProgress: (pct, msg) => {
                setExportProgress(Math.min(48, Math.round(15 + pct * 0.33)));
                setExportStepMessage(msg);
              },
              signal: currentController.signal,
            }
          );

          if (!uploadResult.success || !uploadResult.filename) {
            setUploadedServerFilename(null);
            throw new Error(uploadResult.error || 'Video synchronization with render server failed.');
          }

          setUploadedServerFilename(uploadResult.filename);
          videoSourceToUse = uploadResult.filename;
        } else {
          videoSourceToUse = uploadedServerFilename;
        }
      }

      setExportProgress(50);
      setExportStepMessage(
        activeDubbingTrack
          ? `Rendering ${activeDubbingTrack.language} dubbed audio & kinetic subtitles in FFmpeg...`
          : 'Burning animated kinetic captions with FFmpeg libass engine...'
      );

      // Call dedicated FFmpeg export endpoint with fresh job ID and verified options
      let res: Response;
      try {
        res = await fetch('/api/video/export-mp4', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jobId,
            videoSource: videoSourceToUse,
            segments,
            style,
            activeDubbingTrack: activeDubbingTrack
              ? {
                  compiledAudioUrl: activeDubbingTrack.compiledAudioUrl,
                  duckOriginalVolume: activeDubbingTrack.duckOriginalVolume,
                  dubbedVoiceVolume: activeDubbingTrack.dubbedVoiceVolume,
                }
              : null,
          }),
          signal: currentController.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw fetchErr;
        console.error('[ExportModal] Failed to fetch /api/video/export-mp4:', fetchErr);
        throw new Error(
          `Export render request failed (${fetchErr.message || 'Connection lost'}). Please click Retry Export.`
        );
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error || `Server export error (HTTP ${res.status}): ${res.statusText || 'Rendering failed'}`
        );
      }

      const data = await res.json();
      setExportProgress(100);
      setExportStepMessage('Video rendered successfully!');

      const newItem: ExportHistoryItem = {
        jobId: data.jobId || jobId,
        downloadUrl: data.downloadUrl,
        filename: data.filename || `export_${jobId}.mp4`,
        fileSize: data.fileSize || 0,
        duration: data.duration || 0,
        timestamp: Date.now(),
        presetName: style.presetName || 'Custom',
        captionCount: segments.length,
      };

      setLatestExport(newItem);
      setExportHistory((prev) => [newItem, ...prev]);
      setExportStatus('ready');

      // Celebration confetti
      try {
        confetti({
          particleCount: 85,
          spread: 65,
          origin: { y: 0.6 },
        });
      } catch {}
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[ExportModal] Render aborted by user.');
        return;
      }
      console.error('[ExportModal] Render error:', err);
      setExportStatus('error');

      // Provide clear diagnostics instead of an opaque "Failed to fetch"
      if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
        try {
          const healthRes = await fetch('/api/health');
          if (healthRes.ok) {
            setExportError(
              'The connection to the render server was closed before completion. This can happen with large video files. Please click "Retry Export" below.'
            );
          } else {
            setExportError(`Render server returned HTTP ${healthRes.status}. Please retry in a moment.`);
          }
        } catch {
          setExportError('Unable to communicate with the render server. Please check your internet connection and retry.');
        }
      } else {
        setExportError(err.message || 'Unknown export error');
      }
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    handleDownload(url, filename);
    URL.revokeObjectURL(url);
  };

  const copyText = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes <= 0) return '0 KB';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Header with Back button and Close */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Return to Video Editor (Keeps all your work)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Export Studio</h3>
                <p className="text-xs text-zinc-400">Broadcast-quality MP4 (H.264 + AAC) & subtitles</p>
              </div>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Close Export Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-1 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('video')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'video'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-indigo-400" />
            <span>MP4 Video Export</span>
          </button>
          <button
            onClick={() => setActiveTab('subtitles')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'subtitles'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5 text-amber-400" />
            <span>SRT / VTT Files</span>
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'transcript'
                ? 'bg-zinc-800 text-white font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>Plain Transcript</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* VIDEO EXPORT TAB */}
          {activeTab === 'video' && (
            <div className="space-y-4">
              {/* Preset Summary Info Card */}
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Active Caption Configuration</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-600/20 text-indigo-300 font-bold border border-indigo-500/30 text-[10px]">
                    {style.presetName || 'Custom'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
                    <div className="text-zinc-400">Captions</div>
                    <div className="text-white font-bold">{segments.length} lines</div>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
                    <div className="text-zinc-400">Backdrop</div>
                    <div
                      className={`font-bold truncate ${
                        style.containerBgEnabled ? 'text-indigo-400' : 'text-emerald-400'
                      }`}
                    >
                      {style.containerBgEnabled
                        ? `${style.bgType || 'pill'} (${Math.round((style.bgOpacity ?? 0.85) * 100)}%)`
                        : 'Transparent (OFF)'}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
                    <div className="text-zinc-400">Emojis</div>
                    <div
                      className={`font-bold ${
                        style.removeEmojis ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {style.removeEmojis ? 'Stripped' : 'Preserved'}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800/80">
                    <div className="text-zinc-400">Engine</div>
                    <div className="text-indigo-300 font-bold">FFmpeg H.264</div>
                  </div>
                </div>
              </div>

              {/* Active Dubbed Audio Badge */}
              {activeDubbingTrack && (
                <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-500/30 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>Multilingual Dubbing Track:</span>
                        <span className="text-teal-300">{activeDubbingTrack.language}</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">
                        Voice: <span className="text-zinc-200">{activeDubbingTrack.voiceProfileName}</span> &bull; Original audio ducked to {Math.round((activeDubbingTrack.duckOriginalVolume ?? 0.15) * 100)}%
                      </div>
                    </div>
                  </div>
                  {activeDubbingTrack.compiledAudioUrl && (
                    <a
                      href={activeDubbingTrack.compiledAudioUrl}
                      download={`${videoTitle}_dubbed_${activeDubbingTrack.language.toLowerCase()}.mp3`}
                      className="px-2.5 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/50 text-teal-200 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                      title="Download separate dubbed MP3 voiceover"
                    >
                      <Volume2 className="w-3 h-3" />
                      <span>Dubbed MP3</span>
                    </a>
                  )}
                </div>
              )}

              {/* IDLE STATE: START RENDER BUTTON */}
              {exportStatus === 'idle' && (
                <button
                  onClick={handleStartRender}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  <span>
                    {activeDubbingTrack ? 'Render Dubbed MP4 Video' : 'Render & Export MP4 Video'}
                  </span>
                </button>
              )}

              {/* RENDERING PROGRESS STATE */}
              {exportStatus === 'rendering' && (
                <div className="p-5 rounded-2xl bg-zinc-950 border border-indigo-500/30 space-y-3 shadow-lg">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-indigo-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                      <span>{exportStepMessage || 'Rendering Video in FFmpeg...'}</span>
                    </span>
                    <span className="font-mono text-zinc-300 font-bold">{exportProgress}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      style={{ width: `${exportProgress}%` }}
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-400 text-center">
                    Using server-side FFmpeg with constant 30fps CFR and pristine 192k AAC audio encoding.
                  </p>
                </div>
              )}

              {/* SUCCESS / READY STATE */}
              {exportStatus === 'ready' && latestExport && (
                <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">MP4 Video Ready to Download!</h5>
                      <p className="text-xs text-zinc-400">
                        {latestExport.filename} &bull; {formatFileSize(latestExport.fileSize)} &bull; {latestExport.duration.toFixed(1)}s
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={latestExport.downloadUrl}
                      download={latestExport.filename}
                      className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <Download className="w-4 h-4" />
                      <span>Download MP4 Video</span>
                    </a>

                    <button
                      onClick={handleStartRender}
                      className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition-all"
                      title="Make further edits to captions or styles and render a new version"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Re-Export with New Settings</span>
                    </button>
                  </div>
                </div>
              )}

              {/* ERROR STATE: Meaningful error message + Retry and Back options */}
              {exportStatus === 'error' && (
                <div className="p-5 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-3 text-left">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <h5 className="font-bold text-white text-sm">Export Encountered an Issue</h5>
                      <p className="text-xs text-rose-300/90 mt-0.5 leading-relaxed font-mono">
                        {exportError || 'An error occurred during video rendering.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        // Clear any cached upload filename so retry re-uploads cleanly
                        setUploadedServerFilename(null);
                        handleStartRender();
                      }}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-md"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retry Export</span>
                    </button>

                    <button
                      onClick={handleClose}
                      className="py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs border border-zinc-700 transition-all"
                    >
                      Back to Editor
                    </button>
                  </div>
                </div>
              )}

              {/* SESSION EXPORT HISTORY (Allows re-downloading any version rendered in this session) */}
              {exportHistory.length > 1 && (
                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-bold text-zinc-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Session Export History ({exportHistory.length})</span>
                    </span>
                    <span className="text-[11px] text-zinc-500">All versions preserved</span>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {exportHistory.map((item, index) => (
                      <div
                        key={item.jobId}
                        className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <HardDrive className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-semibold text-white">Version {exportHistory.length - index}</span>
                            <span className="text-[11px] text-zinc-400 ml-1.5">
                              ({item.presetName} &bull; {formatFileSize(item.fileSize)})
                            </span>
                          </div>
                        </div>
                        <a
                          href={item.downloadUrl}
                          download={item.filename}
                          className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 font-semibold text-[11px] flex items-center gap-1 shrink-0 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUBTITLES TAB */}
          {activeTab === 'subtitles' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">SubRip Subtitle (.SRT)</div>
                  <div className="text-[11px] text-zinc-400">
                    Standard format supported by YouTube, Premiere, Final Cut, CapCut
                  </div>
                </div>
                <button
                  onClick={() =>
                    downloadFile(generateSRT(segments, style.removeEmojis), `${videoTitle}.srt`, 'text/plain')
                  }
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .SRT</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">WebVTT Subtitle (.VTT)</div>
                  <div className="text-[11px] text-zinc-400">
                    HTML5 standard for web video players and mobile browsers
                  </div>
                </div>
                <button
                  onClick={() =>
                    downloadFile(generateVTT(segments, style.removeEmojis), `${videoTitle}.vtt`, 'text/vtt')
                  }
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .VTT</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white text-xs">Full JSON Metadata (.JSON)</div>
                  <div className="text-[11px] text-zinc-400">
                    Includes word-level timings, highlights, and font styling
                  </div>
                </div>
                <button
                  onClick={() =>
                    downloadFile(
                      JSON.stringify({ segments, style }, null, 2),
                      `${videoTitle}_metadata.json`,
                      'application/json'
                    )
                  }
                  className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .JSON</span>
                </button>
              </div>
            </div>
          )}

          {/* TRANSCRIPT TAB */}
          {activeTab === 'transcript' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-400">Formatted Transcript:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => copyText(generatePlainText(segments, true, style.removeEmojis), 'with-times')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                  >
                    {copiedType === 'with-times' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>With Timestamps</span>
                  </button>
                  <button
                    onClick={() => copyText(generatePlainText(segments, false, style.removeEmojis), 'no-times')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs"
                  >
                    {copiedType === 'no-times' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Plain Text</span>
                  </button>
                </div>
              </div>

              <textarea
                readOnly
                rows={7}
                value={generatePlainText(segments, true, style.removeEmojis)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 font-mono text-xs text-zinc-300 focus:outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
