import React, { useState, useRef } from 'react';
import {
  Globe,
  Mic,
  Volume2,
  Sparkles,
  Download,
  CheckCircle2,
  Sliders,
  RotateCcw,
  Languages,
  Maximize2,
  Upload,
  Play,
  Film,
  Loader2,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  CaptionSegment,
  SupportedLanguage,
  VoiceProfile,
  DubbingTrack,
} from '../types';

interface AutoDubbingPanelProps {
  segments: CaptionSegment[];
  onSegmentsChange?: (newSegments: CaptionSegment[]) => void;
  voiceProfiles: VoiceProfile[];
  activeDubbingTrack: DubbingTrack | null;
  onApplyDubbingTrack: (track: DubbingTrack | null) => void;
  onOpenFullStudio: () => void;
  videoUrl?: string;
  videoTitle?: string;
  onOpenUploader?: () => void;
}

const VOICE_STYLES = [
  { id: 'Studio Narrator', name: 'Studio Narrator', desc: 'Clear, balanced, articulate cadence', icon: '🎙️' },
  { id: 'Cinematic Male', name: 'Cinematic Male', desc: 'Deep, resonant, trailer tone', icon: '🎬' },
  { id: 'Dynamic Female', name: 'Dynamic Female', desc: 'Expressive, upbeat, energetic pacing', icon: '⚡' },
  { id: 'Casual Creator', name: 'Casual Creator', desc: 'Warm, relatable, conversational feel', icon: '📱' },
  { id: 'Deep Authority', name: 'Deep Authority', desc: 'Rich baritone, documentary resonance', icon: '🏆' },
];

export const AutoDubbingPanel: React.FC<AutoDubbingPanelProps> = ({
  segments,
  onSegmentsChange,
  voiceProfiles,
  activeDubbingTrack,
  onApplyDubbingTrack,
  onOpenFullStudio,
  videoUrl = '',
  videoTitle = 'captio_video',
  onOpenUploader,
}) => {
  // Target language selection
  const [targetLanguage, setTargetLanguage] = useState<'Hindi' | 'English' | 'Kannada' | 'Telugu'>('Hindi');
  const [voiceStyle, setVoiceStyle] = useState<string>('Studio Narrator');
  const [duckVolume, setDuckVolume] = useState<number>(0.15); // 15% original audio preserved
  const [voiceVolume, setVoiceVolume] = useState<number>(1.0); // 100% dubbed speech volume
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0); // 1.0x default
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const panelAudioRef = useRef<HTMLAudioElement | null>(null);

  // 1-Click Pipeline State
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [stageProgressText, setStageProgressText] = useState('');
  const [dubbingError, setDubbingError] = useState<string | null>(null);

  // Dubbing Result State
  const [dubResult, setDubResult] = useState<{
    originalLanguage: string;
    nativeScript: string;
    targetLanguage: string;
    masterAudioUrl?: string;
    mp4ExportUrl?: string;
    streamUrl?: string;
    filename?: string;
    duration?: number;
    translatedSegments?: any[];
  } | null>(null);

  // Audio Switcher Preview: 'original' vs 'dubbed'
  const [previewMode, setPreviewMode] = useState<'original' | 'dubbed'>('dubbed');

  // Detect original spoken language from segments/transcript
  const fullText = segments.map((s) => s.text || '').join(' ');
  const isTelugu = /[\u0C00-\u0C7F]/.test(fullText) || videoTitle.toLowerCase().includes('telugu');
  const isHindi = /[\u0900-\u097F]/.test(fullText);
  const isKannada = /[\u0C80-\u0CFF]/.test(fullText);

  const detectedLanguage = isTelugu ? 'Telugu' : isHindi ? 'Hindi' : isKannada ? 'Kannada' : 'English';
  const detectedScript = isTelugu ? 'తెలుగు' : isHindi ? 'हिन्दी' : isKannada ? 'ಕನ್ನಡ' : 'English';

  const pipelineStages = [
    'Extracting & analyzing original video audio...',
    `Detecting speech & spoken language (${detectedLanguage} detected)...`,
    `Translating dialogue into fluent ${targetLanguage}...`,
    `Synthesizing natural AI voices (${voiceStyle})...`,
    'Synchronizing speech & compiling master dubbed MP4...',
  ];

  // Voice Audition / Preview Handler
  const handlePreviewVoice = async (vStyle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setPreviewingVoiceId(vStyle);
      const sampleTexts: Record<string, string> = {
        Hindi: 'नमस्ते, यह आपकी वीडियो के लिए एक प्राकृतिक एआई आवाज है।',
        Telugu: 'నమస్కారం, ఇది మీ వీడియో కోసం సహజమైన ఏఐ వాయిస్.',
        Kannada: 'ನಮಸ್ಕಾರ, ಇದು ನಿಮ್ಮ ವೀಡಿಯೊಗಾಗಿ ನೈಸರ್ಗಿಕ ಎಐ ಧ್ವನಿ.',
        English: 'Hello, this is a natural high-clarity AI voice for your video.',
      };
      const textToSpeak = sampleTexts[targetLanguage] || sampleTexts.English;
      const gender = vStyle.includes('Female') ? 'female' : 'male';

      const res = await fetch('/api/voice/preview-line', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToSpeak,
          language: targetLanguage,
          gender,
          speed: speechSpeed,
          voiceStyle: vStyle,
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        if (panelAudioRef.current) panelAudioRef.current.pause();
        const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`);
        panelAudioRef.current = audio;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.onerror = () => setPreviewingVoiceId(null);
        await audio.play();
      } else {
        setPreviewingVoiceId(null);
      }
    } catch {
      setPreviewingVoiceId(null);
    }
  };

  // MAIN 1-CLICK DUBBING ACTION
  const handleStartOneClickDubbing = async () => {
    try {
      setIsProcessing(true);
      setDubbingError(null);
      setCurrentStageIndex(0);
      setStageProgressText(pipelineStages[0]);

      // Progress Simulation across stages while backend executes
      const progressTimer = setInterval(() => {
        setCurrentStageIndex((prev) => {
          if (prev < pipelineStages.length - 1) {
            const next = prev + 1;
            setStageProgressText(pipelineStages[next]);
            return next;
          }
          return prev;
        });
      }, 1200);

      const res = await fetch('/api/voice/one-click-auto-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoSource: videoUrl || '/demo/sample1.mp4',
          targetLanguage,
          voiceStyle,
          duckOriginalVolume: duckVolume,
          dubbedVoiceVolume: voiceVolume,
          speed: speechSpeed,
          segments,
        }),
      });

      clearInterval(progressTimer);

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'One-click auto-dubbing failed');
      }

      setCurrentStageIndex(pipelineStages.length);
      setStageProgressText('Dubbing completed successfully!');

      setDubResult(data);

      // Create and apply dubbed track
      if (data.masterAudioUrl) {
        const newTrack: DubbingTrack = {
          id: data.jobId,
          language: data.targetLanguage as SupportedLanguage,
          voiceProfileId: voiceStyle,
          voiceProfileName: voiceStyle,
          segments: data.translatedSegments || [],
          compiledAudioUrl: data.masterAudioUrl,
          masterAudioUrl: data.masterAudioUrl,
          duckOriginalVolume: duckVolume,
          dubbedVoiceVolume: voiceVolume,
          createdAt: new Date().toISOString(),
        };
        onApplyDubbingTrack(newTrack);
        setPreviewMode('dubbed');
      }

      // If translated segments returned, update subtitle editor seamlessly
      if (data.translatedSegments && onSegmentsChange) {
        const newSegments: CaptionSegment[] = data.translatedSegments.map((d: any, idx: number) => ({
          id: d.segmentId || `seg_${idx + 1}`,
          text: d.translatedText,
          start: d.start,
          end: d.end,
          speaker: d.speaker,
          speakerGender: d.speakerGender,
          words: (d.translatedText || '').split(/\s+/).map((w: string, wIdx: number, arr: string[]) => {
            const dur = d.end - d.start;
            const wStart = d.start + (wIdx / arr.length) * dur;
            const wEnd = d.start + ((wIdx + 1) / arr.length) * dur;
            return { word: w, start: Number(wStart.toFixed(2)), end: Number(wEnd.toFixed(2)) };
          }),
        }));
        onSegmentsChange(newSegments);
      }

      try {
        confetti({ particleCount: 75, spread: 60, origin: { y: 0.6 } });
      } catch {}
    } catch (err: any) {
      console.error('[1ClickDub] Error:', err);
      setDubbingError(err.message || 'Auto-dubbing failed. Please check network and retry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadMp4 = () => {
    if (!dubResult?.mp4ExportUrl) return;
    const a = document.createElement('a');
    a.href = dubResult.mp4ExportUrl;
    a.download = dubResult.filename || `${videoTitle}_dubbed_${targetLanguage.toLowerCase()}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl text-zinc-200">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-white text-sm flex items-center gap-1.5">
              <span>1-Click Auto Video Dubbing</span>
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                AI Powered
              </span>
            </h3>
            <p className="text-[11px] text-zinc-400">Translate dialogue & replace audio with 1 click</p>
          </div>
        </div>
        <button
          onClick={onOpenFullStudio}
          className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors"
          title="Open Full Auto Dubbing Studio"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-4 text-xs">
        {/* Step 1: Video & Original Language Detection */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Film className="w-3.5 h-3.5 text-indigo-400" />
              <span>Source Video & Audio</span>
            </span>
            {onOpenUploader && (
              <button
                onClick={onOpenUploader}
                className="px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-semibold flex items-center gap-1 transition-colors"
              >
                <Upload className="w-3 h-3" />
                <span>Upload New</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-800/80">
            <div className="truncate max-w-[200px]">
              <span className="text-zinc-400 text-[11px]">Video: </span>
              <span className="text-white font-medium text-[11px] truncate">{videoTitle}</span>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px]">
              {segments.length} dialogue lines
            </span>
          </div>

          {/* Auto Detect Badge */}
          <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <div>
                <span className="text-zinc-400 text-[11px]">Original Language: </span>
                <span className="font-bold text-white text-[11px]">
                  {detectedLanguage} ({detectedScript})
                </span>
              </div>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
              Auto-Detected
            </span>
          </div>
        </div>

        {/* Step 2: Target Language Selection */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="font-bold text-white flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-indigo-400" />
              <span>Target Dubbed Language</span>
            </label>
            <span className="text-[10px] text-zinc-400 font-mono">
              {detectedLanguage} → {targetLanguage}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'Hindi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
              { id: 'English', label: 'English', native: 'English', flag: '🌐' },
              { id: 'Kannada', label: 'Kannada', native: 'ಕನ್ನಡ', flag: '🇮🇳' },
              { id: 'Telugu', label: 'Telugu', native: 'తెలుగు', flag: '🇮🇳' },
            ].map((lang) => {
              const isSelected = targetLanguage === lang.id;
              const isSource = detectedLanguage === lang.id;
              return (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setTargetLanguage(lang.id as any)}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-950/50 shadow-md ring-1 ring-indigo-500/60'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{lang.flag}</span>
                    <div>
                      <div className="font-bold text-white text-xs">{lang.label}</div>
                      <div className="text-[10px] text-zinc-400">{lang.native}</div>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                  {isSource && !isSelected && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      Source
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 3: AI Voice Style Selection */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2.5">
          <label className="font-bold text-white flex items-center gap-1.5">
            <Mic className="w-3.5 h-3.5 text-purple-400" />
            <span>AI Voice Style & Timbre</span>
          </label>

          <div className="space-y-1.5">
            {VOICE_STYLES.map((v) => {
              const isSelected = voiceStyle === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setVoiceStyle(v.id)}
                  className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500/50'
                      : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{v.icon}</span>
                    <div>
                      <div className="font-bold text-white text-xs">{v.name}</div>
                      <div className="text-[10px] text-zinc-400">{v.desc}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => handlePreviewVoice(v.id, e)}
                      disabled={previewingVoiceId === v.id}
                      className="px-2 py-1 rounded-md bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 text-[10px] font-semibold flex items-center gap-1 transition-colors"
                      title={`Preview ${v.name} voice`}
                    >
                      {previewingVoiceId === v.id ? (
                        <>
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          <span>Voicing...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-2.5 h-2.5" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>
                    {isSelected && (
                      <div className="w-4 h-4 rounded-full bg-purple-600 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 4: Background Music Preservation & Speech Speed Sliders */}
        <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3.5">
          {/* Ducking Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                <span>Preserve Background Music & Ambience</span>
              </label>
              <span className="font-mono text-indigo-400 font-bold text-xs">
                {Math.round(duckVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.05"
              value={duckVolume}
              onChange={(e) => setDuckVolume(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>Mute (0%)</span>
              <span>Balanced (15%)</span>
              <span>Audible (50%)</span>
            </div>
          </div>

          {/* Speech Speed Slider */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="font-bold text-white flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-teal-400" />
                <span>Speech Speed / Tempo</span>
              </label>
              <span className="font-mono text-teal-400 font-bold text-xs">
                {speechSpeed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="0.8"
              max="1.3"
              step="0.05"
              value={speechSpeed}
              onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
              className="w-full accent-teal-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>0.8x (Slower)</span>
              <span>1.0x (Natural Default)</span>
              <span>1.2x (Fast Viral)</span>
            </div>
          </div>
        </div>

        {/* PROCESSING PROGRESS VIEW */}
        {isProcessing && (
          <div className="p-4 rounded-2xl bg-zinc-950 border border-indigo-500/40 space-y-3 shadow-xl animate-in fade-in">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-300 flex items-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Auto Dubbing in Progress...</span>
              </span>
              <span className="font-mono text-xs text-indigo-400 font-bold">
                {Math.min(100, (currentStageIndex + 1) * 20)}%
              </span>
            </div>

            {/* Stage Progress Bar */}
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                style={{ width: `${Math.min(100, (currentStageIndex + 1) * 20)}%` }}
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
              />
            </div>

            <p className="text-[11px] text-zinc-300 font-medium text-center">
              {stageProgressText || pipelineStages[currentStageIndex]}
            </p>
          </div>
        )}

        {/* ERROR VIEW */}
        {dubbingError && (
          <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 space-y-2 text-left">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-200">
                <span className="font-bold">Auto Dubbing Error: </span>
                <span>{dubbingError}</span>
              </div>
            </div>
            <button
              onClick={handleStartOneClickDubbing}
              className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Dubbing</span>
            </button>
          </div>
        )}

        {/* SUCCESS / DUBBED PREVIEW & DOWNLOAD CARD */}
        {dubResult && !isProcessing && (
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/40 space-y-3.5 shadow-xl animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-xs">Dubbing Complete: {dubResult.originalLanguage} → {dubResult.targetLanguage}!</h4>
                <p className="text-[11px] text-zinc-400">
                  Full dialogue translated, synced, and exported to broadcast MP4.
                </p>
              </div>
            </div>

            {/* Audio Switcher: Original vs Dubbed */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('original');
                  onApplyDubbingTrack(null);
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  previewMode === 'original'
                    ? 'bg-zinc-800 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Original ({dubResult.originalLanguage})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewMode('dubbed');
                  if (dubResult.masterAudioUrl) {
                    onApplyDubbingTrack({
                      id: dubResult.originalLanguage,
                      language: dubResult.targetLanguage as any,
                      voiceProfileId: voiceStyle,
                      voiceProfileName: voiceStyle,
                      segments: dubResult.translatedSegments || [],
                      compiledAudioUrl: dubResult.masterAudioUrl,
                      masterAudioUrl: dubResult.masterAudioUrl,
                      duckOriginalVolume: duckVolume,
                      dubbedVoiceVolume: voiceVolume,
                      createdAt: new Date().toISOString(),
                    });
                  }
                }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  previewMode === 'dubbed'
                    ? 'bg-emerald-600 text-white shadow-sm font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Dubbed ({dubResult.targetLanguage})
              </button>
            </div>

            {/* Final MP4 Download Button */}
            <button
              onClick={handleDownloadMp4}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              <span>Download Final Dubbed MP4 Video</span>
            </button>
          </div>
        )}
      </div>

      {/* Main 1-Click Action Footer Button */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
        <button
          onClick={handleStartOneClickDubbing}
          disabled={isProcessing}
          className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-xl active:scale-[0.99] ${
            isProcessing
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/30 group'
          }`}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Processing Auto Dubbing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform text-amber-300" />
              <span>START AUTO DUBBING ({detectedLanguage} → {targetLanguage})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
