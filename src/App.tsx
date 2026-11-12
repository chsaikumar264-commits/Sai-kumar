import React, { useState, useRef, useEffect } from 'react';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { StyleEditor } from './components/StyleEditor';
import { CaptionEditor } from './components/CaptionEditor';
import { VideoUploader } from './components/VideoUploader';
import { ExportModal } from './components/ExportModal';
import { SocialKitModal } from './components/SocialKitModal';
import { HookDoctorModal } from './components/HookDoctorModal';
import { VoiceCloningStudio } from './components/VoiceCloningStudio';
import { AutoDubbingStudio } from './components/AutoDubbingStudio';
import { AutoDubbingPanel } from './components/AutoDubbingPanel';
import { CaptionSegment, CaptionStyleConfig, AspectRatio, VoiceProfile, DubbingTrack } from './types';
import { DEMO_VIDEOS, PRESET_STYLES } from './utils/demoData';
import { stripEmojis } from './utils/subtitleParsers';
import { Palette, Layers, Sparkles, Mic, Globe } from 'lucide-react';

const DEFAULT_INITIAL_VOICES: VoiceProfile[] = [
  {
    id: 'voice-alex-core',
    name: 'Alex (Creator Vocal Identity)',
    description: 'Dynamic conversational voice with crisp modern articulation and warm lower midtones.',
    gender: 'male',
    accent: 'American (Contemporary)',
    tone: 'energetic and authoritative',
    pitch: 'balanced mid-baritone',
    durationSeconds: 14.5,
    qualityScore: 96,
    hasConsent: true,
    consentTimestamp: '2025-01-15T10:00:00.000Z',
    provider: 'gemini_voice_design',
    createdAt: '2025-01-15T10:00:00.000Z',
  },
  {
    id: 'voice-priya-narrator',
    name: 'Priya (Storyteller & Host)',
    description: 'Engaging, expressive storyteller voice with clear cadence and natural warmth.',
    gender: 'female',
    accent: 'Global Indian English',
    tone: 'warm and captivating',
    pitch: 'melodic soprano',
    durationSeconds: 16.2,
    qualityScore: 98,
    hasConsent: true,
    consentTimestamp: '2025-01-15T11:00:00.000Z',
    provider: 'gemini_voice_design',
    createdAt: '2025-01-15T11:00:00.000Z',
  },
];

export default function App() {
  const initialDemo = DEMO_VIDEOS[0];

  const [videoUrl, setVideoUrl] = useState<string>(initialDemo.videoUrl);
  const [videoTitle, setVideoTitle] = useState<string>(initialDemo.title);
  const [segments, setSegments] = useState<CaptionSegment[]>(initialDemo.segments);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialDemo.aspectRatio);
  const [style, setStyle] = useState<CaptionStyleConfig>(() => ({
    ...PRESET_STYLES.hormozi,
    containerBgEnabled: false,
  }));

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(initialDemo.duration);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Voice Profiles & Auto Dubbing State
  const [voiceProfiles, setVoiceProfiles] = useState<VoiceProfile[]>(() => {
    try {
      const saved = localStorage.getItem('captio_voice_profiles');
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_INITIAL_VOICES;
  });

  const [activeDubbingTrack, setActiveDubbingTrack] = useState<DubbingTrack | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const activeBlobUrlRef = useRef<string | null>(null);

  // Clean up any remaining blob URL on complete app unmount
  useEffect(() => {
    return () => {
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
    };
  }, []);

  const handleVoiceProfilesChange = (newProfiles: VoiceProfile[]) => {
    setVoiceProfiles(newProfiles);
    try {
      localStorage.setItem('captio_voice_profiles', JSON.stringify(newProfiles));
    } catch (e) {
      console.warn('Failed to save voice profiles:', e);
    }
  };

  // Convert uploaded video to browser-compatible H.264 + AAC MP4 using server FFmpeg
  const handleTranscodeVideo = async (file: File) => {
    try {
      setIsTranscoding(true);
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch('/api/video/binary-upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'video/mp4',
          'X-Filename': encodeURIComponent(file.name),
          'X-Action': 'transcode',
        },
        body: arrayBuffer,
      });

      const data = await res.json();
      if (!data.success || !data.streamUrl) {
        throw new Error(data.error || 'Transcoding failed');
      }

      // Revoke previous blob URL if applicable
      if (activeBlobUrlRef.current && activeBlobUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(activeBlobUrlRef.current);
      }
      activeBlobUrlRef.current = null;

      // Update player with stream URL
      setVideoUrl(data.streamUrl);
      if (data.duration) setDuration(data.duration);
      alert('Video successfully converted to standard H.264 MP4 with FFmpeg! Playback restored.');
    } catch (err: any) {
      console.error('Transcode error:', err);
      alert('Transcoding error: ' + err.message);
    } finally {
      setIsTranscoding(false);
    }
  };

  // Modals
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [preloadedFile, setPreloadedFile] = useState<File | null>(null);
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSocialKitOpen, setIsSocialKitOpen] = useState(false);
  const [isHookDoctorOpen, setIsHookDoctorOpen] = useState(false);
  const [isVoiceStudioOpen, setIsVoiceStudioOpen] = useState(false);
  const [isDubbingStudioOpen, setIsDubbingStudioOpen] = useState(false);

  // Global drag-and-drop video file handler
  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsGlobalDragging(false);
    }
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGlobalDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (file.type.startsWith('video/') || ['.mp4', '.mov', '.mkv', '.webm', '.avi'].includes(ext)) {
        setPreloadedFile(file);
        setIsUploaderOpen(true);
      }
    }
  };

  // Right sidebar view mode on desktop/tablet
  const [sidebarTab, setSidebarTab] = useState<'style' | 'timeline' | 'dubbing'>('style');

  const handleVideoLoaded = (
    url: string,
    title: string,
    newSegments: CaptionSegment[],
    isDemo = false,
    file?: File
  ) => {
    // If replacing an existing object URL with a different one, revoke the old one
    if (
      activeBlobUrlRef.current &&
      activeBlobUrlRef.current !== url &&
      activeBlobUrlRef.current.startsWith('blob:')
    ) {
      URL.revokeObjectURL(activeBlobUrlRef.current);
    }
    activeBlobUrlRef.current = url.startsWith('blob:') ? url : null;

    setVideoUrl(url);
    setVideoTitle(title);
    setSegments(newSegments);
    if (file) {
      setUploadedFile(file);
    } else if (isDemo) {
      setUploadedFile(null);
    }
    setCurrentTime(0);
    if (isDemo) {
      const match = DEMO_VIDEOS.find((d) => d.videoUrl === url);
      if (match) {
        setAspectRatio(match.aspectRatio);
        if (PRESET_STYLES[match.recommendedPreset]) {
          setStyle((prev) => ({
            ...PRESET_STYLES[match.recommendedPreset],
            containerBgEnabled: prev.containerBgEnabled ?? false,
            removeEmojis: prev.removeEmojis ?? false,
          }));
        }
      }
    }
  };

  const handleApplyHook = (newText: string) => {
    if (segments.length === 0) return;
    const first = segments[0];
    const wordsArr = newText.split(/\s+/).filter(Boolean);
    const dur = Math.max(0.5, first.end - first.start);
    const newWords = wordsArr.map((w, idx) => ({
      word: w,
      start: Number((first.start + (idx / wordsArr.length) * dur).toFixed(2)),
      end: Number((first.start + ((idx + 1) / wordsArr.length) * dur).toFixed(2)),
      isHighlighted: idx === 0 || idx === wordsArr.length - 1,
    }));

    const updated = [
      {
        ...first,
        text: newText,
        words: newWords,
      },
      ...segments.slice(1),
    ];
    setSegments(updated);
  };

  const [isInsertingEmojis, setIsInsertingEmojis] = useState(false);
  const [isDetectingHighlights, setIsDetectingHighlights] = useState(false);

  const handleAutoInsertEmojis = async () => {
    if (segments.length === 0) return;
    try {
      setIsInsertingEmojis(true);
      const res = await fetch('/api/auto-insert-emojis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, tone: 'viral' }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        setSegments(data.segments);
        setStyle((prev) => ({ ...prev, showEmojis: true }));
      } else {
        const fallbackSegments = segments.map((s) => ({ ...s, emoji: s.emoji || '✨' }));
        setSegments(fallbackSegments);
        setStyle((prev) => ({ ...prev, showEmojis: true }));
      }
    } catch (err: any) {
      console.warn('Emoji auto-insert fallback in App:', err);
      const fallbackSegments = segments.map((s) => ({ ...s, emoji: s.emoji || '✨' }));
      setSegments(fallbackSegments);
      setStyle((prev) => ({ ...prev, showEmojis: true }));
    } finally {
      setIsInsertingEmojis(false);
    }
  };

  const handleDetectHighlights = async () => {
    if (segments.length === 0) return;
    try {
      setIsDetectingHighlights(true);
      const res = await fetch('/api/detect-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, intensity: 'balanced' }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        setSegments(data.segments);
      } else {
        alert(data.error || 'Failed to detect keyword highlights');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsDetectingHighlights(false);
    }
  };

  const handleToggleRemoveEmojis = (remove: boolean) => {
    setStyle((prev) => ({ ...prev, removeEmojis: remove }));
    if (remove) {
      // Strip emojis from all current segments immediately
      setSegments((prev) =>
        prev.map((s) => ({
          ...s,
          emoji: '',
          text: stripEmojis(s.text),
          words: (s.words || []).map((w) => ({
            ...w,
            word: stripEmojis(w.word),
          })),
        }))
      );
    }
  };

  const fullTranscript = segments.map((s) => s.text).join(' ');

  const isTeluguSpoken =
    segments.some((s) => /[\u0C00-\u0C7F]/.test(s.text || '')) ||
    videoTitle.toLowerCase().includes('telugu');

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className="h-screen max-h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative"
    >
      {/* Global Drag & Drop Overlay Feedback */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-50 bg-indigo-950/80 backdrop-blur-md border-4 border-dashed border-indigo-400 flex flex-col items-center justify-center p-6 pointer-events-none animate-in fade-in duration-150">
          <div className="w-20 h-20 rounded-3xl bg-indigo-600/30 text-indigo-300 border border-indigo-400/40 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <Layers className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">Drop Video to Import</h2>
          <p className="text-sm text-indigo-200">
            Supports MP4, MOV, MKV, WEBM, and AVI files
          </p>
        </div>
      )}

      {/* Navigation Header (shrink-0) */}
      <Header
        videoTitle={videoTitle}
        onOpenUploader={() => {
          setPreloadedFile(null);
          setIsUploaderOpen(true);
        }}
        onSelectVideoFile={(file) => {
          setPreloadedFile(file);
          setIsUploaderOpen(true);
        }}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSocialKit={() => setIsSocialKitOpen(true)}
        onOpenHookDoctor={() => setIsHookDoctorOpen(true)}
        onOpenVoiceCloning={() => setIsVoiceStudioOpen(true)}
        onOpenAutoDubbing={() => setIsDubbingStudioOpen(true)}
      />

      {/* Main Studio Viewport (Independent Scroll Layout) */}
      <main className="flex-1 min-h-0 w-full max-w-[1700px] mx-auto p-3 sm:p-4 lg:p-4 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
        {/* Left Column (Video Player & Controls) - Independent Fixed Viewport */}
        <section className="lg:col-span-7 xl:col-span-7 flex flex-col min-h-0 h-full overflow-hidden">
          {/* Telugu Spoken Dialogue Detected Banner */}
          {isTeluguSpoken && (
            <div className="w-full mb-3 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-950/80 via-teal-900/50 to-indigo-950/70 border border-teal-500/40 flex items-center justify-between gap-3 text-xs shadow-lg animate-in fade-in shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-sm shrink-0">
                  🇮🇳
                </div>
                <div className="truncate">
                  <span className="font-extrabold text-white">Telugu Speech Detected (తెలుగు)</span>
                  <span className="text-zinc-400 ml-1.5 hidden sm:inline text-[11px]">
                    &bull; Ready to Auto Dub into Hindi, English & Kannada
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setSidebarTab('dubbing');
                  setIsDubbingStudioOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/30 transition-all flex items-center gap-1.5 shrink-0"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Auto Dub Now</span>
              </button>
            </div>
          )}

          <div className="flex-1 min-h-0 flex flex-col justify-center items-center overflow-hidden">
            <VideoPlayer
              videoUrl={videoUrl}
              segments={segments}
              style={style}
              onStyleChange={setStyle}
              aspectRatio={aspectRatio}
              onAspectRatioChange={setAspectRatio}
              videoRef={videoRef}
              currentTime={currentTime}
              duration={duration}
              onTimeUpdate={setCurrentTime}
              onDurationChange={setDuration}
              onSeek={(time) => {
                setCurrentTime(time);
                if (videoRef.current) {
                  videoRef.current.currentTime = time;
                }
              }}
              onOpenSocialKit={() => setIsSocialKitOpen(true)}
              onOpenHookDoctor={() => setIsHookDoctorOpen(true)}
              activeDubbingTrack={activeDubbingTrack}
              onOpenDubbingStudio={() => setIsDubbingStudioOpen(true)}
              uploadedFile={uploadedFile}
              onTranscodeVideo={handleTranscodeVideo}
              isTranscoding={isTranscoding}
              onOpenUploader={() => {
                setPreloadedFile(null);
                setIsUploaderOpen(true);
              }}
            />
          </div>
        </section>

        {/* Right Column: Customization Studio (Independent Scroll Panel) */}
        <aside className="lg:col-span-5 xl:col-span-5 flex flex-col min-h-0 h-full overflow-hidden">
          {/* Top Switcher Tabs between Style, Timeline & Dubbing (shrink-0) */}
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-2xl p-1 mb-3 text-xs font-bold shadow-lg shrink-0">
            <button
              onClick={() => setSidebarTab('style')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'style'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Styles</span>
            </button>
            <button
              onClick={() => setSidebarTab('timeline')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'timeline'
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Captions ({segments.length})</span>
            </button>
            <button
              onClick={() => setSidebarTab('dubbing')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                sidebarTab === 'dubbing'
                  ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-md'
                  : 'text-zinc-400 hover:text-teal-300 hover:bg-zinc-800/50'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-teal-400" />
              <span>Auto Dub</span>
              {isTeluguSpoken && (
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Active Tab Panel with Independent Scrolling */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {sidebarTab === 'style' && (
              <StyleEditor
                style={style}
                onChange={setStyle}
                onAutoInsertEmojis={handleAutoInsertEmojis}
                isInsertingEmojis={isInsertingEmojis}
                onDetectHighlights={handleDetectHighlights}
                isDetectingHighlights={isDetectingHighlights}
                onToggleRemoveEmojis={handleToggleRemoveEmojis}
              />
            )}
            {sidebarTab === 'timeline' && (
              <CaptionEditor
                segments={segments}
                onSegmentsChange={setSegments}
                currentTime={currentTime}
                duration={duration}
                style={style}
                onStyleChange={setStyle}
                onSeek={(time) => {
                  setCurrentTime(time);
                  if (videoRef.current) {
                    videoRef.current.currentTime = time;
                  }
                }}
              />
            )}
            {sidebarTab === 'dubbing' && (
              <AutoDubbingPanel
                segments={segments}
                onSegmentsChange={setSegments}
                voiceProfiles={voiceProfiles}
                activeDubbingTrack={activeDubbingTrack}
                onApplyDubbingTrack={(track) => setActiveDubbingTrack(track)}
                onOpenFullStudio={() => setIsDubbingStudioOpen(true)}
                videoUrl={videoUrl}
                videoTitle={videoTitle}
                onOpenUploader={() => {
                  setPreloadedFile(null);
                  setIsUploaderOpen(true);
                }}
              />
            )}
          </div>
        </aside>
      </main>

      {/* Modals */}
      <VideoUploader
        isOpen={isUploaderOpen}
        onClose={() => {
          setIsUploaderOpen(false);
          setPreloadedFile(null);
        }}
        onVideoLoaded={handleVideoLoaded}
        preloadedFile={preloadedFile}
        onClearPreloadedFile={() => setPreloadedFile(null)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        segments={segments}
        style={style}
        videoRef={videoRef}
        videoTitle={videoTitle}
        videoUrl={videoUrl}
        uploadedFile={uploadedFile}
        activeDubbingTrack={activeDubbingTrack}
      />

      <SocialKitModal
        isOpen={isSocialKitOpen}
        onClose={() => setIsSocialKitOpen(false)}
        transcript={fullTranscript}
      />

      <HookDoctorModal
        isOpen={isHookDoctorOpen}
        onClose={() => setIsHookDoctorOpen(false)}
        segments={segments}
        onApplyHook={handleApplyHook}
      />

      <VoiceCloningStudio
        isOpen={isVoiceStudioOpen}
        onClose={() => setIsVoiceStudioOpen(false)}
        voiceProfiles={voiceProfiles}
        onVoiceProfilesChange={handleVoiceProfilesChange}
        onSelectVoiceForDubbing={(profile) => {
          setIsVoiceStudioOpen(false);
          setIsDubbingStudioOpen(true);
        }}
      />

      <AutoDubbingStudio
        isOpen={isDubbingStudioOpen}
        onClose={() => setIsDubbingStudioOpen(false)}
        segments={segments}
        onSegmentsChange={setSegments}
        voiceProfiles={voiceProfiles}
        onOpenVoiceCloningStudio={() => {
          setIsDubbingStudioOpen(false);
          setIsVoiceStudioOpen(true);
        }}
        activeDubbingTrack={activeDubbingTrack}
        onApplyDubbingTrack={(track) => setActiveDubbingTrack(track)}
      />
    </div>
  );
}
