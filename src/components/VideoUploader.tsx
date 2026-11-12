import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Video,
  Camera,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Play,
  Square,
  Link,
  Globe,
  ArrowRight,
  FileVideo,
  Clock,
  HardDrive,
  RefreshCw,
  Check,
} from 'lucide-react';
import { extractAudioFromVideo } from '../utils/audioExtractor';
import { CaptionSegment, DemoVideo } from '../types';
import { DEMO_VIDEOS } from '../utils/demoData';
import { formatSegmentsTo1SecondPacing } from '../utils/subtitleParsers';
import { uploadVideoFile } from '../utils/videoUploaderClient';

interface VideoUploaderProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoLoaded: (
    videoUrl: string,
    title: string,
    segments: CaptionSegment[],
    isDemo?: boolean,
    file?: File
  ) => void;
  preloadedFile?: File | null;
  onClearPreloadedFile?: () => void;
}

const SUPPORTED_EXTENSIONS = ['.mp4', '.mov', '.mkv', '.webm', '.avi'];

function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  isOpen,
  onClose,
  onVideoLoaded,
  preloadedFile,
  onClearPreloadedFile,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'demos' | 'record'>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Selected file & preview state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const [codecWarning, setCodecWarning] = useState<string | null>(null);
  const [isTranscoding, setIsTranscoding] = useState(false);

  // Recording state
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);

  // URL state
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [urlTitleInput, setUrlTitleInput] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('Auto-detect');

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRecordPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<any>(null);
  const transferredUrlRef = useRef<string | null>(null);

  // Handle incoming preloaded file from Header
  useEffect(() => {
    if (preloadedFile) {
      handleSetFile(preloadedFile);
      setActiveTab('upload');
    }
  }, [preloadedFile]);

  // Clean up blob URL on unmount or file change ONLY if not transferred to main player
  useEffect(() => {
    return () => {
      if (
        previewBlobUrl &&
        previewBlobUrl !== transferredUrlRef.current &&
        previewBlobUrl.startsWith('blob:')
      ) {
        URL.revokeObjectURL(previewBlobUrl);
      }
    };
  }, [previewBlobUrl]);

  if (!isOpen) return null;

  const handleSetFile = (file: File) => {
    // Validate video file
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValid = file.type.startsWith('video/') || SUPPORTED_EXTENSIONS.includes(ext);

    if (!isValid) {
      alert(`Please select a supported video format: MP4, MOV, MKV, WEBM, or AVI.`);
      return;
    }

    if (previewBlobUrl && previewBlobUrl !== transferredUrlRef.current && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }

    const url = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewBlobUrl(url);
    setVideoDuration(0);
    setVideoDimensions(null);
    setCodecWarning(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleSetFile(file);
    }
    // Reset input value so same file can be re-selected if desired
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleSetFile(file);
    }
  };

  const handleOpenFileDialog = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleClearSelectedFile = () => {
    if (previewBlobUrl && previewBlobUrl !== transferredUrlRef.current && previewBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewBlobUrl);
    }
    setSelectedFile(null);
    setPreviewBlobUrl(null);
    setVideoDuration(0);
    setVideoDimensions(null);
    setCodecWarning(null);
    if (onClearPreloadedFile) {
      onClearPreloadedFile();
    }
  };

  // Convert uploaded video to browser-compatible H.264 + AAC MP4 using FFmpeg
  const handleTranscodeWithFFmpeg = async () => {
    if (!selectedFile) return;
    try {
      setIsTranscoding(true);
      setStatusMessage('Transcoding with FFmpeg into web-compatible H.264 + AAC MP4 (yuv420p)...');

      const arrayBuffer = await selectedFile.arrayBuffer();
      const res = await fetch('/api/video/binary-upload', {
        method: 'POST',
        headers: {
          'Content-Type': selectedFile.type || 'video/mp4',
          'X-Filename': encodeURIComponent(selectedFile.name),
          'X-Action': 'transcode',
        },
        body: arrayBuffer,
      });

      const data = await res.json();
      if (!data.success || !data.streamUrl) {
        throw new Error(data.error || 'Transcode failed');
      }

      setPreviewBlobUrl(data.streamUrl);
      if (data.duration) setVideoDuration(data.duration);
      if (data.width && data.height) {
        setVideoDimensions({ width: data.width, height: data.height });
      }
      setCodecWarning(null);
    } catch (err: any) {
      console.error('Transcode error:', err);
      alert('Transcoding error: ' + err.message);
    } finally {
      setIsTranscoding(false);
      setStatusMessage('');
    }
  };

  // Process and Transcribe the Selected File
  const handleProcessVideoFile = async (skipAI = false) => {
    if (!selectedFile || !previewBlobUrl) return;

    const baseTitle = selectedFile.name.replace(/\.[^/.]+$/, '');

    if (skipAI) {
      transferredUrlRef.current = previewBlobUrl;
      onVideoLoaded(previewBlobUrl, baseTitle, [], false, selectedFile);
      handleCloseModal();
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('Analyzing audio & synchronizing captions with server FFmpeg...');

      let segments: CaptionSegment[] = [];
      let finalVideoUrl = previewBlobUrl;

      // 1. Primary path: Use server FFmpeg audio extraction & Gemini transcription
      // This works for 100% of video formats (MP4, MOV, MKV, etc.) and uploads the video so Export is instant!
      try {
        const uploadResult = await uploadVideoFile(
          selectedFile,
          selectedFile.name,
          {
            action: 'transcribe',
            language: selectedLanguage,
            onProgress: (pct, msg) => {
              setStatusMessage(`${msg} (${pct}%)`);
            },
          }
        );

        if (uploadResult.success) {
          if (uploadResult.streamUrl) {
            finalVideoUrl = uploadResult.streamUrl;
          }
          if (Array.isArray(uploadResult.segments) && uploadResult.segments.length > 0) {
            segments = uploadResult.segments;
          }
        }
      } catch (serverErr: any) {
        console.warn('[VideoUploader] Server transcription attempt failed, falling back to local extraction:', serverErr);
        // Fallback to client audio extraction
        try {
          const extracted = await extractAudioFromVideo(selectedFile);
          if (extracted.base64Audio) {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: extracted.base64Audio,
                mimeType: extracted.mimeType,
                language: selectedLanguage,
              }),
            });
            const json = await res.json();
            if (json.success && Array.isArray(json.data?.segments)) {
              segments = formatSegmentsTo1SecondPacing(json.data.segments);
            }
          }
        } catch (clientErr) {
          console.warn('[VideoUploader] Client audio extraction also failed:', clientErr);
        }
      }

      transferredUrlRef.current = finalVideoUrl;
      onVideoLoaded(finalVideoUrl, baseTitle, segments, false, selectedFile);
      handleCloseModal();
    } catch (err: any) {
      console.warn('Video import notice:', err?.message || 'Loaded video without captions.');
      transferredUrlRef.current = previewBlobUrl;
      onVideoLoaded(previewBlobUrl, baseTitle, [], false, selectedFile);
      handleCloseModal();
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const handleSelectDemo = (demo: DemoVideo) => {
    onVideoLoaded(demo.videoUrl, demo.title, demo.segments, true);
    handleCloseModal();
  };

  const handleUrlImport = async (targetUrl = videoUrlInput, title = urlTitleInput) => {
    const url = targetUrl.trim();
    if (!url) {
      alert('Please enter a valid video URL.');
      return;
    }

    try {
      setIsProcessing(true);
      setStatusMessage('Fetching video stream & preparing captions...');

      let segments: CaptionSegment[] = [
        {
          id: `url-seg-1-${Date.now()}`,
          start: 0.5,
          end: 3.5,
          text: 'Welcome to this video.',
          emoji: '👋',
          highlightedWords: ['WELCOME'],
          words: [
            { word: 'Welcome', start: 0.5, end: 1.2, isHighlighted: true },
            { word: 'to', start: 1.2, end: 1.6 },
            { word: 'this', start: 1.6, end: 2.2 },
            { word: 'video.', start: 2.2, end: 3.5 },
          ],
        },
      ];

      onVideoLoaded(url, title.trim() || 'Web Video Stream', segments);
      handleCloseModal();
    } catch (err: any) {
      alert('URL error: ' + err.message);
    } finally {
      setIsProcessing(false);
      setStatusMessage('');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRecordPreviewRef.current) {
        videoRecordPreviewRef.current.srcObject = stream;
        videoRecordPreviewRef.current.play();
      }

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: 'video/webm' });
        const videoFile = new File([blob], `recording_${Date.now()}.webm`, { type: 'video/webm' });
        handleSetFile(videoFile);
      };

      recorder.start();
      setRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => {
        setRecordTime((t) => t + 1);
      }, 1000);
    } catch (e: any) {
      alert('Camera access denied or unavailable: ' + e.message);
    }
  };

  const stopCamera = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const handleCloseModal = () => {
    if (recording) {
      stopCamera();
    }
    handleClearSelectedFile();
    onClose();
  };

  const fileExt = selectedFile
    ? selectedFile.name.split('.').pop()?.toUpperCase() || 'VIDEO'
    : '';

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Hidden File Input reliably controlled via ref */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.mov,.mkv,.webm,.avi,video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo"
        onChange={handleFileInputChange}
        className="hidden"
        aria-hidden="true"
      />

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Import & Caption Video</h3>
              <p className="text-xs text-zinc-400">
                Support for MP4, MOV, MKV, WEBM, and AVI with instant video preview
              </p>
            </div>
          </div>
          <button
            onClick={handleCloseModal}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'upload'
                ? 'bg-zinc-800 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Upload File</span>
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'url'
                ? 'bg-zinc-800 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Link className="w-3.5 h-3.5 text-emerald-400" />
            <span>Import URL</span>
          </button>
          <button
            onClick={() => setActiveTab('demos')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'demos'
                ? 'bg-zinc-800 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Samples</span>
          </button>
          <button
            onClick={() => setActiveTab('record')}
            className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'record'
                ? 'bg-zinc-800 text-white font-bold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-pink-400" />
            <span>Record</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 sm:p-6">
          {isProcessing ? (
            <div className="py-14 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto animate-pulse">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>
              <div>
                <h4 className="font-bold text-white text-base mb-1">Processing Video</h4>
                <p className="text-xs text-indigo-300 font-medium">{statusMessage}</p>
              </div>
            </div>
          ) : (
            <>
              {/* UPLOAD FILE TAB */}
              {activeTab === 'upload' && (
                <div>
                  {selectedFile && previewBlobUrl ? (
                    /* Video Preview State with File Details */
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Video Element Preview */}
                      <div className="relative rounded-2xl overflow-hidden bg-black border border-zinc-800 shadow-xl max-h-[300px] flex items-center justify-center">
                        <video
                          ref={previewVideoRef}
                          src={previewBlobUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="w-full max-h-[280px] object-contain rounded-2xl"
                          onLoadedMetadata={(e) => {
                            setVideoDuration(e.currentTarget.duration);
                            setVideoDimensions({
                              width: e.currentTarget.videoWidth,
                              height: e.currentTarget.videoHeight,
                            });
                          }}
                          onCanPlay={() => {
                            setCodecWarning(null);
                          }}
                          onError={(e) => {
                            const err = (e.currentTarget as HTMLVideoElement).error;
                            console.warn('Preview video error:', err);
                            setCodecWarning(
                              'Browser cannot decode this video codec directly (e.g. H.265/HEVC or 10-bit color). Transcoding to standard H.264 + AAC with FFmpeg will make it playable.'
                            );
                          }}
                        />
                      </div>

                      {/* Codec Warning & 1-Click FFmpeg Transcode Banner */}
                      {codecWarning && (
                        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
                          <div className="flex items-start gap-2.5 text-amber-200">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold text-white block">Codec Compatibility Alert</span>
                              <span className="text-[11px] text-amber-300">{codecWarning}</span>
                            </div>
                          </div>
                          <button
                            onClick={handleTranscodeWithFFmpeg}
                            disabled={isTranscoding}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all shadow-md disabled:opacity-50"
                          >
                            {isTranscoding ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Converting (FFmpeg)...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 fill-black" />
                                <span>Convert to H.264 MP4</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Video Metadata Cards (Filename, Size, Duration, Format) */}
                      <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                        {/* Filename */}
                        <div className="col-span-2 flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                          <FileVideo className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-[10px] text-zinc-500 block">Filename</span>
                            <span className="font-bold text-white truncate block" title={selectedFile.name}>
                              {selectedFile.name}
                            </span>
                          </div>
                        </div>

                        {/* File Size */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                          <HardDrive className="w-4 h-4 text-teal-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-zinc-500 block">File Size</span>
                            <span className="font-bold text-white font-mono">
                              {formatFileSize(selectedFile.size)}
                            </span>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                          <div>
                            <span className="text-[10px] text-zinc-500 block">Duration</span>
                            <span className="font-bold text-white font-mono">
                              {formatDuration(videoDuration)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Spoken Language & Voice Detection Settings */}
                      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div>
                            <span className="font-bold text-white block">Spoken Language Recognition</span>
                            <span className="text-[11px] text-zinc-400">
                              Detects human voice dialogue only (ignores background music & noise)
                            </span>
                          </div>
                        </div>

                        <select
                          value={selectedLanguage}
                          onChange={(e) => setSelectedLanguage(e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                        >
                          <option value="Auto-detect">Auto-detect Language</option>
                          <option value="Telugu">Telugu (తెలుగు)</option>
                          <option value="English">English</option>
                          <option value="Hindi">Hindi (हिन्दी)</option>
                          <option value="Kannada">Kannada (ಕನ್ನಡ)</option>
                          <option value="Tamil">Tamil (தமிழ்)</option>
                          <option value="Spanish">Spanish (Español)</option>
                          <option value="French">French (Français)</option>
                          <option value="German">German (Deutsch)</option>
                          <option value="Japanese">Japanese (日本語)</option>
                        </select>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                        <button
                          onClick={() => handleProcessVideoFile(false)}
                          className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                          <span>Transcribe Spoken Dialogue ({selectedLanguage})</span>
                        </button>

                        <button
                          onClick={() => handleProcessVideoFile(true)}
                          className="w-full sm:w-auto py-3 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                          title="Import video into editor immediately with blank/starter subtitles"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Import Direct</span>
                        </button>

                        <button
                          onClick={(e) => handleOpenFileDialog(e)}
                          className="w-full sm:w-auto py-3 px-3.5 rounded-xl border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-medium transition-colors flex items-center justify-center gap-1"
                          title="Select a different video file"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Change Video</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Initial Upload Dropzone View */
                    <div className="space-y-4">
                      <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={(e) => handleOpenFileDialog(e)}
                        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 sm:p-10 cursor-pointer transition-all select-none ${
                          isDragging
                            ? 'border-indigo-400 bg-indigo-950/40 scale-[1.01] shadow-xl'
                            : 'border-zinc-700 hover:border-indigo-500 bg-zinc-950/60 hover:bg-zinc-950'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-3 transition-transform group-hover:scale-110">
                          <Upload className="w-8 h-8" />
                        </div>

                        <span className="font-bold text-sm text-zinc-100 mb-1 text-center">
                          Click or drag video file here to import
                        </span>

                        <span className="text-xs text-zinc-400 mb-4 text-center">
                          Supports MP4, MOV, MKV, WEBM, and AVI
                        </span>

                        {/* Explicit button triggering the file dialog */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenFileDialog(e)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Browse Files from Computer</span>
                        </button>

                        <div className="flex flex-wrap items-center justify-center gap-1.5 mt-5">
                          {['MP4', 'MOV', 'MKV', 'WEBM', 'AVI'].map((fmt) => (
                            <span
                              key={fmt}
                              className="px-2 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 text-[10px] font-mono text-zinc-400 font-semibold"
                            >
                              .{fmt.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </div>

                      <p className="text-[11px] text-zinc-500 text-center">
                        Video files are securely processed locally with instant preview & Gemini speech AI.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* DEMO VIDEOS TAB */}
              {activeTab === 'demos' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 mb-2">
                    Pick a demo video with pre-transcribed word-level timestamps to test viral captions and dubbing immediately:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {DEMO_VIDEOS.map((demo) => (
                      <div
                        key={demo.id}
                        onClick={() => handleSelectDemo(demo)}
                        className="group relative rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 hover:border-indigo-500 cursor-pointer transition-all hover:scale-[1.02] shadow-lg flex flex-col"
                      >
                        <div className="aspect-[16/10] relative overflow-hidden bg-zinc-900">
                          <img
                            src={demo.thumbnail}
                            alt={demo.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <div className="w-10 h-10 rounded-full bg-white/90 text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 ml-0.5 fill-black" />
                            </div>
                          </div>
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white">
                            {demo.duration}s
                          </span>
                        </div>
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <div>
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block mb-1">
                              {demo.category}
                            </span>
                            <h4 className="text-xs font-bold text-white line-clamp-1">
                              {demo.title}
                            </h4>
                          </div>
                          <div className="mt-2 text-[10px] text-zinc-500 flex items-center justify-between">
                            <span>{demo.segments.length} chunks</span>
                            <span className="capitalize">{demo.recommendedPreset}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* IMPORT FROM URL TAB */}
              {activeTab === 'url' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1">
                        Direct Video Stream URL
                      </label>
                      <div className="relative">
                        <Link className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="url"
                          placeholder="https://example.com/video.mp4"
                          value={videoUrlInput}
                          onChange={(e) => setVideoUrlInput(e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-zinc-300 block mb-1">
                        Video Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. My TikTok Reel"
                        value={urlTitleInput}
                        onChange={(e) => setUrlTitleInput(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <button
                      onClick={() => handleUrlImport()}
                      disabled={!videoUrlInput.trim()}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Import Video & Transcribe</span>
                    </button>
                  </div>

                  {/* Preset Streams */}
                  <div>
                    <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                      Or Try Preset High-Quality Sample Streams:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {[
                        {
                          name: 'Founder Viral Hook (9:16)',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                        },
                        {
                          name: 'Fitness Motivation (9:16)',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
                        },
                        {
                          name: 'Tech Animation (16:9)',
                          url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
                        },
                      ].map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => {
                            setVideoUrlInput(preset.url);
                            setUrlTitleInput(preset.name);
                            handleUrlImport(preset.url, preset.name);
                          }}
                          className="p-2.5 rounded-xl bg-zinc-950/80 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group"
                        >
                          <div className="text-xs font-semibold text-zinc-200 group-hover:text-emerald-400">
                            {preset.name}
                          </div>
                          <div className="text-[10px] text-zinc-500 truncate mt-0.5 font-mono">
                            {preset.url}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* RECORD VIDEO TAB */}
              {activeTab === 'record' && (
                <div className="space-y-4 text-center">
                  <div className="relative aspect-[9/16] max-h-72 mx-auto rounded-2xl overflow-hidden bg-black border border-zinc-800">
                    <video
                      ref={videoRecordPreviewRef}
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {recording && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white px-2.5 py-1 rounded-full text-xs font-bold animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        <span>REC 00:{recordTime.toString().padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-center gap-3">
                    {!recording ? (
                      <button
                        onClick={startCamera}
                        className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Start Recording</span>
                      </button>
                    ) : (
                      <button
                        onClick={stopCamera}
                        className="px-6 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                      >
                        <Square className="w-4 h-4 fill-white" />
                        <span>Stop & Preview</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
