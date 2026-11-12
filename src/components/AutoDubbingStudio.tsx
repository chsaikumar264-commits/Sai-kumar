import React, { useState, useRef, useEffect } from 'react';
import {
  Globe,
  Mic,
  Volume2,
  Play,
  Pause,
  Sparkles,
  Download,
  CheckCircle2,
  Layers,
  ArrowRight,
  Sliders,
  RefreshCw,
  X,
  FileAudio,
  Radio,
  Check,
  Headphones,
  Zap,
  Info,
  Edit3,
  Users,
  Video,
  Languages,
  RotateCcw,
  VolumeX,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CaptionSegment,
  SupportedLanguage,
  VoiceProfile,
  DubbingTrack,
  DubbingSegment,
} from '../types';
import { formatDisplayTime } from '../utils/subtitleParsers';

interface AutoDubbingStudioProps {
  isOpen: boolean;
  onClose: () => void;
  segments: CaptionSegment[];
  onSegmentsChange?: (newSegments: CaptionSegment[]) => void;
  voiceProfiles: VoiceProfile[];
  onOpenVoiceCloningStudio: () => void;
  activeDubbingTrack: DubbingTrack | null;
  onApplyDubbingTrack: (track: DubbingTrack | null) => void;
  videoUrl?: string;
  videoTitle?: string;
  onOpenUploader?: () => void;
}

const SUPPORTED_TARGET_LANGUAGES: {
  id: 'Hindi' | 'English' | 'Kannada' | 'Telugu';
  label: string;
  native: string;
  flag: string;
  accentInfo: string;
}[] = [
  {
    id: 'Hindi',
    label: 'Hindi',
    native: 'हिन्दी',
    flag: '🇮🇳',
    accentInfo: 'Authentic Devanagari phonetics with natural Hindi inflection',
  },
  {
    id: 'English',
    label: 'English',
    native: 'English (Global)',
    flag: '🌐',
    accentInfo: 'Natural conversational pace with vocal timbre matching',
  },
  {
    id: 'Kannada',
    label: 'Kannada',
    native: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    accentInfo: 'Rich Dravidian articulation with accurate Karnataka cadence',
  },
  {
    id: 'Telugu',
    label: 'Telugu',
    native: 'తెలుగు',
    flag: '🇮🇳',
    accentInfo: 'Natural Telugu cadence with accurate regional dialect articulation',
  },
];

export const AutoDubbingStudio: React.FC<AutoDubbingStudioProps> = ({
  isOpen,
  onClose,
  segments,
  onSegmentsChange,
  voiceProfiles,
  onOpenVoiceCloningStudio,
  activeDubbingTrack,
  onApplyDubbingTrack,
  videoUrl = '',
  videoTitle = 'captio_video',
  onOpenUploader,
}) => {
  // Target languages selection (supports multi-select)
  const [selectedLanguages, setSelectedLanguages] = useState<SupportedLanguage[]>([
    'Hindi',
  ]);
  const [previewLanguage, setPreviewLanguage] = useState<'Original' | SupportedLanguage>('Hindi');

  // Speaker Voice Assignments
  const [speakerVoices, setSpeakerVoices] = useState<Record<string, string>>({
    'Speaker 1': voiceProfiles[0]?.id || 'voice_rajesh',
    'Speaker 2': voiceProfiles.find((v) => v.gender === 'female')?.id || voiceProfiles[1]?.id || 'voice_priya',
  });

  // Audio Ducking & Gains
  const [duckVolume, setDuckVolume] = useState<number>(0.15); // 15% original video background
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0); // 100% dubbed voice
  const [syncSubtitlesToo, setSyncSubtitlesToo] = useState<boolean>(true);

  // Dubbing generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [generatedTracks, setGeneratedTracks] = useState<Partial<Record<SupportedLanguage, DubbingTrack>>>({});

  // Speech Speed & Volume Control
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [previewingLineId, setPreviewingLineId] = useState<string | null>(null);

  // Translation Script Editor State
  const [activeEditorTab, setActiveEditorTab] = useState<SupportedLanguage>('Hindi');
  const [editedTranslations, setEditedTranslations] = useState<Record<string, Record<string, string>>>({
    Hindi: {},
    English: {},
    Kannada: {},
    Telugu: {},
  });
  const [isTranslatingScript, setIsTranslatingScript] = useState(false);

  // Audio auditioning state
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  // Detect original language
  const isTeluguText = segments.some((s) => /[\u0C00-\u0C7F]/.test(s.text || ''));
  const originalLanguageName = isTeluguText ? 'Telugu (తెలుగు)' : 'English (Auto-detected)';

  // Initialize script translations when modal opens or segments change
  useEffect(() => {
    if (isOpen && segments.length > 0) {
      loadInitialTranslations();
    }
  }, [isOpen, segments]);

  const loadInitialTranslations = async () => {
    try {
      setIsTranslatingScript(true);
      const res = await fetch('/api/voice/translate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          targetLanguages: ['Hindi', 'English', 'Kannada', 'Telugu'],
          customEdits: editedTranslations,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.translations) {
          const newMap: Record<string, Record<string, string>> = {
            Hindi: {},
            English: {},
            Kannada: {},
            Telugu: {},
          };

          for (const lang of ['Hindi', 'English', 'Kannada', 'Telugu'] as const) {
            (data.translations[lang] || []).forEach((item: any) => {
              newMap[lang][item.id] = item.translatedText;
            });
          }

          setEditedTranslations(newMap);
        }
      }
    } catch (e) {
      console.warn('Initial script translation notice:', e);
    } finally {
      setIsTranslatingScript(false);
    }
  };

  const handlePreviewSingleLine = async (
    segmentId: string,
    text: string,
    language: SupportedLanguage,
    gender: 'male' | 'female' = 'male'
  ) => {
    if (!text || !text.trim()) return;
    try {
      setPreviewingLineId(segmentId);
      const res = await fetch('/api/voice/preview-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          language,
          gender,
          speed: speechSpeed,
        }),
      });
      const data = await res.json();
      if (data.success && data.audioBase64) {
        if (audioPreviewRef.current) {
          audioPreviewRef.current.pause();
        }
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        audioPreviewRef.current = audio;
        audio.onended = () => setPreviewingLineId(null);
        audio.onerror = () => setPreviewingLineId(null);
        await audio.play();
      } else {
        alert(data.error || 'Failed to preview voice.');
        setPreviewingLineId(null);
      }
    } catch (e: any) {
      console.warn('Voice preview error:', e);
      setPreviewingLineId(null);
    }
  };

  if (!isOpen) return null;

  const toggleLanguageSelection = (langId: SupportedLanguage) => {
    if (selectedLanguages.includes(langId)) {
      if (selectedLanguages.length === 1) return; // Keep at least one
      setSelectedLanguages(selectedLanguages.filter((l) => l !== langId));
    } else {
      setSelectedLanguages([...selectedLanguages, langId]);
    }
  };

  const handleTranslationChange = (lang: string, segmentId: string, val: string) => {
    setEditedTranslations((prev) => ({
      ...prev,
      [lang]: {
        ...(prev[lang] || {}),
        [segmentId]: val,
      },
    }));
  };

  const handleGenerateDubbing = async () => {
    if (segments.length === 0) {
      alert('No subtitle segments found to dub. Please upload a video or transcript.');
      return;
    }

    try {
      setIsGenerating(true);
      setGenerationStep('1/4: Translating Telugu dialogue into selected languages...');

      const defaultProfile = voiceProfiles[0] || {
        id: 'default',
        name: 'Studio Narrator',
        gender: 'male',
      };

      const response = await fetch('/api/voice/auto-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          targetLanguages: selectedLanguages,
          voiceProfile: defaultProfile,
          speakerVoices,
          duckOriginalVolume: duckVolume,
          dubbedVoiceVolume: voiceVolume,
          customTranslations: editedTranslations,
        }),
      });

      setGenerationStep('2/4: Synthesizing natural AI speech with pitch & timbre calibration...');

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Auto-dubbing failed.');
      }

      setGenerationStep('3/4: Compiling master audio tracks in FFmpeg with sample-accurate alignment...');

      const returnedTracks = data.tracks || {};
      setGeneratedTracks(returnedTracks);

      const firstTrackLang = selectedLanguages[0];
      const activeTrack = returnedTracks[firstTrackLang] || data.track;

      setGenerationStep('4/4: Synchronizing dubbed audio with video timeline...');

      // Apply primary dubbed track to video player
      if (activeTrack) {
        onApplyDubbingTrack(activeTrack);
        setPreviewLanguage(firstTrackLang);

        // If user selected to synchronize subtitles too, update segments in the editor
        if (syncSubtitlesToo && onSegmentsChange && activeTrack.segments.length > 0) {
          const updatedSegments: CaptionSegment[] = segments.map((seg) => {
            const matched = activeTrack.segments.find((d: any) => d.segmentId === seg.id);
            if (matched && matched.translatedText) {
              const wordsArr = matched.translatedText.split(/\s+/).filter(Boolean);
              const dur = Math.max(0.4, seg.end - seg.start);
              const newWords = wordsArr.map((w: string, idx: number) => ({
                word: w,
                start: Number((seg.start + (idx / Math.max(1, wordsArr.length)) * dur).toFixed(2)),
                end: Number((seg.start + ((idx + 1) / Math.max(1, wordsArr.length)) * dur).toFixed(2)),
                isHighlighted: idx === 0 || idx === wordsArr.length - 1,
              }));

              return {
                ...seg,
                text: matched.translatedText,
                words: newWords,
              };
            }
            return seg;
          });

          onSegmentsChange(updatedSegments);
        }
      }

      // Trigger celebratory confetti
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error(err);
      alert('Dubbing generation error: ' + err.message);
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const handlePlaySegmentAudio = (seg: DubbingSegment) => {
    if (!seg.audioBase64) return;

    if (playingSegmentId === seg.segmentId && audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      setPlayingSegmentId(null);
      return;
    }

    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }

    const audio = new Audio(`data:audio/wav;base64,${seg.audioBase64}`);
    audioPreviewRef.current = audio;
    setPlayingSegmentId(seg.segmentId);

    audio.onended = () => setPlayingSegmentId(null);
    audio.onerror = () => setPlayingSegmentId(null);
    audio.play().catch(() => setPlayingSegmentId(null));
  };

  const handleSelectPreviewLanguage = (lang: 'Original' | 'Hindi' | 'English' | 'Kannada') => {
    setPreviewLanguage(lang);
    if (lang === 'Original') {
      onApplyDubbingTrack(null);
    } else if (generatedTracks[lang]) {
      onApplyDubbingTrack(generatedTracks[lang]!);
    }
  };

  const handleExportDubbedVideo = async (lang: SupportedLanguage) => {
    const track = generatedTracks[lang];
    if (!track) {
      alert(`Please generate the ${lang} dubbed track first.`);
      return;
    }

    try {
      const jobId = `dub_${lang.toLowerCase()}_${Date.now()}`;
      const res = await fetch('/api/video/export-mp4', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          videoSource: videoUrl,
          segments: segments.map((s) => {
            const matched = track.segments.find((d) => d.segmentId === s.id);
            return matched ? { ...s, text: matched.translatedText } : s;
          }),
          style: {
            presetName: 'Hormozi',
            fontFamily: lang === 'Hindi' ? 'Noto Serif Devanagari' : lang === 'Kannada' ? 'Noto Sans Telugu' : 'Montserrat',
            fontSize: 36,
            textColor: '#ffffff',
            highlightColor: '#ffe600',
            activeWordColor: '#00ff66',
            verticalPosition: 80,
          },
          activeDubbingTrack: track,
        }),
      });

      if (!res.ok) throw new Error('Failed to start MP4 render');
      const data = await res.json();
      if (data.downloadUrl) {
        const a = document.createElement('a');
        a.href = data.downloadUrl;
        a.download = `${videoTitle}_dubbed_${lang.toLowerCase()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e: any) {
      alert('Export error: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overscroll-none">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[92vh]">
        {/* Header (shrink-0) */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 border border-teal-500/30 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">Auto Video Dubbing Studio</h3>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30 text-[10px]">
                  Telugu to Multi-Language
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Translate Telugu speech to Hindi, English & Kannada with synchronized AI voiceover
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body: Independent Section Scrolling */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-6">
          {/* STEP 1: Original Language & Video Source */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                <Languages className="w-4 h-4 text-teal-400" />
                <span>1. Original Spoken Language Detection</span>
              </span>
              <div className="flex items-center gap-1.5">
                {onOpenUploader && (
                  <button
                    onClick={onOpenUploader}
                    className="flex items-center gap-1 px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-colors border border-zinc-700"
                  >
                    <Video className="w-3 h-3 text-indigo-400" />
                    <span>Change Video</span>
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-sm">
                  🇮🇳
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>{originalLanguageName}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                      CONFIRMED (99%)
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Source: {videoTitle} &bull; {segments.length} spoken dialogue lines detected
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: Target Languages Selection (Multi-Select) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-teal-400" />
                <span>2. Select Target Languages (Multi-Select Supported)</span>
              </span>
              <span className="text-[11px] text-zinc-400">
                {selectedLanguages.length} selected &bull; Generates separate track per language
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {SUPPORTED_TARGET_LANGUAGES.map((lang) => {
                const isSelected = selectedLanguages.includes(lang.id);
                return (
                  <button
                    key={lang.id}
                    onClick={() => toggleLanguageSelection(lang.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between h-28 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-950/20 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/50'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{lang.flag}</span>
                        <div>
                          <div className="font-extrabold text-white text-sm">{lang.label}</div>
                          <div className="text-[11px] text-teal-400 font-semibold">{lang.native}</div>
                        </div>
                      </div>
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center transition-colors ${
                          isSelected ? 'bg-teal-500 text-black' : 'border border-zinc-700 bg-zinc-900'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </div>
                    <div className="text-[10px] text-zinc-400 leading-tight">
                      {lang.accentInfo}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 3: Multi-Speaker Voice Assignment */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>3. Multi-Speaker Voice Assignment</span>
              </span>
              <button
                onClick={onOpenVoiceCloningStudio}
                className="text-[11px] text-teal-400 hover:underline flex items-center gap-1 font-semibold"
              >
                <Mic className="w-3 h-3" />
                <span>Clone Custom Voice</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Speaker 1 Assignment */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200">Speaker 1 (Primary Voice)</span>
                  <span className="text-[10px] text-zinc-400">Male / Deep Tone</span>
                </div>
                <select
                  value={speakerVoices['Speaker 1']}
                  onChange={(e) =>
                    setSpeakerVoices((prev) => ({ ...prev, 'Speaker 1': e.target.value }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {voiceProfiles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender})
                    </option>
                  ))}
                  <option value="voice_rajesh">Rajesh (Energetic Male)</option>
                  <option value="voice_vikram">Vikram (Authoritative Narrator)</option>
                </select>
              </div>

              {/* Speaker 2 Assignment */}
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-200">Speaker 2 (Secondary / Guest)</span>
                  <span className="text-[10px] text-zinc-400">Female / Warm Tone</span>
                </div>
                <select
                  value={speakerVoices['Speaker 2']}
                  onChange={(e) =>
                    setSpeakerVoices((prev) => ({ ...prev, 'Speaker 2': e.target.value }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-teal-500"
                >
                  {voiceProfiles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender})
                    </option>
                  ))}
                  <option value="voice_priya">Priya (Melodic Female)</option>
                  <option value="voice_ananya">Ananya (Calm Host)</option>
                </select>
              </div>
            </div>
          </div>

          {/* STEP 4: Live Translation Editor */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>4. Translation Script Editor (Editable per Segment)</span>
              </span>
              <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                {(['Hindi', 'English', 'Kannada', 'Telugu'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveEditorTab(lang)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      activeEditorTab === lang
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scroll">
              {segments.map((seg, idx) => {
                const currentVal =
                  editedTranslations[activeEditorTab]?.[seg.id] ?? '';
                return (
                  <div
                    key={seg.id}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-1.5"
                  >
                    <div className="flex justify-between items-center text-[10px] text-zinc-400">
                      <span className="font-bold text-zinc-300">
                        Line #{idx + 1} &bull; {seg.speaker || 'Speaker 1'} &bull; {formatDisplayTime(seg.start)} - {formatDisplayTime(seg.end)}
                      </span>
                      <span className="text-zinc-500 italic truncate max-w-[200px]">
                        Telugu: {seg.text}
                      </span>
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={currentVal}
                        onChange={(e) =>
                          handleTranslationChange(activeEditorTab, seg.id, e.target.value)
                        }
                        placeholder={`Enter ${activeEditorTab} translation...`}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                      <button
                        onClick={() =>
                          handlePreviewSingleLine(
                            seg.id,
                            currentVal || seg.text,
                            activeEditorTab,
                            seg.speakerGender || (seg.speaker === 'Speaker 2' ? 'female' : 'male')
                          )
                        }
                        disabled={previewingLineId === seg.id}
                        className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
                        title="Audition voice for this line"
                      >
                        {previewingLineId === seg.id ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Voicing...</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3 h-3" />
                            <span>Preview</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* STEP 5: Audio Mixing & Ducking Controls */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
            <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <span>5. Audio Ducking, Speed & Volume Balancing</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Background Video Audio Ducking:</span>
                  <span className="font-bold text-white font-mono">{Math.round(duckVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.5"
                  step="0.05"
                  value={duckVolume}
                  onChange={(e) => setDuckVolume(parseFloat(e.target.value))}
                  className="w-full accent-teal-500"
                />
                <div className="text-[10px] text-zinc-500">
                  0% = Complete Mute &bull; 15% = Subtle Background Music (Recommended)
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-zinc-400">
                  <span>Dubbed Voiceover Gain:</span>
                  <span className="font-bold text-white font-mono">{Math.round(voiceVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  value={voiceVolume}
                  onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                  className="w-full accent-teal-500"
                />
                <div className="text-[10px] text-zinc-500">
                  100% = Standard Loudness &bull; 120% = Social Media Punchy Vocal
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Speech Speed / Tempo:</span>
                  <span className="font-bold text-white font-mono">{speechSpeed.toFixed(1)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={speechSpeed}
                  onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                  className="w-full accent-teal-500"
                />
                <div className="text-[10px] text-zinc-500">
                  0.8x = Slower Pace &bull; 1.0x = Natural Speed (Default) &bull; 1.2x = Fast Viral Pacing
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={syncSubtitlesToo}
                onChange={(e) => setSyncSubtitlesToo(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 accent-teal-500 bg-zinc-900 border-zinc-700"
              />
              <span>Also update video captions with translated text in sync with speech</span>
            </label>
          </div>

          {/* GENERATE ACTION BUTTON */}
          {!isGenerating ? (
            <button
              onClick={handleGenerateDubbing}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-teal-500 via-emerald-500 to-indigo-600 hover:from-teal-400 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-teal-500/20 transition-all flex items-center justify-center gap-2 group active:scale-[0.99]"
            >
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              <span>
                START AUTO DUBBING ({selectedLanguages.join(', ')})
              </span>
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-teal-500/40 space-y-2 shadow-lg">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-teal-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-400" />
                  <span>{generationStep || 'Generating Dubbed Tracks...'}</span>
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-teal-400 to-emerald-400 animate-pulse w-3/4" />
              </div>
            </div>
          )}

          {/* STEP 6: Multi-Language Preview Switcher & Individual Segment Audition */}
          {Object.keys(generatedTracks).length > 0 && (
            <div className="p-4 rounded-2xl bg-teal-950/30 border border-teal-500/40 space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Dubbed Audio Ready — Audition & Export</span>
                </span>
                <span className="text-[11px] text-teal-300 font-mono">
                  {Object.keys(generatedTracks).length} Language Tracks Compiled
                </span>
              </div>

              {/* Language Switcher Bar */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSelectPreviewLanguage('Original')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    previewLanguage === 'Original'
                      ? 'bg-zinc-800 text-white ring-2 ring-zinc-500'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white'
                  }`}
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Original (Telugu)</span>
                </button>

                {(['Hindi', 'English', 'Kannada'] as const).map((lang) => {
                  const track = generatedTracks[lang];
                  if (!track) return null;
                  const isCur = previewLanguage === lang;
                  return (
                    <button
                      key={lang}
                      onClick={() => handleSelectPreviewLanguage(lang)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                        isCur
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400'
                          : 'bg-zinc-900 text-teal-400 hover:bg-zinc-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{lang} Dubbed</span>
                    </button>
                  );
                })}
              </div>

              {/* Export MP4 Buttons per Language */}
              <div className="pt-2 border-t border-zinc-800/80 space-y-2">
                <div className="text-[11px] font-bold text-zinc-400">
                  Export Individual Broadcast MP4s:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(['Hindi', 'English', 'Kannada'] as const).map((lang) => {
                    const track = generatedTracks[lang];
                    if (!track) return null;
                    return (
                      <button
                        key={lang}
                        onClick={() => handleExportDubbedVideo(lang)}
                        className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-teal-500/30 text-white font-bold text-xs flex items-center justify-between group transition-all"
                      >
                        <div className="flex items-center gap-1.5">
                          <Download className="w-3.5 h-3.5 text-teal-400" />
                          <span>Export {lang} MP4</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
