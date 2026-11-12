import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Upload,
  Play,
  Pause,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Volume2,
  X,
  ShieldCheck,
  Globe,
  Radio,
  FileAudio,
  Check,
  RefreshCw,
  Plus,
  Info,
} from 'lucide-react';
import { VoiceProfile, SupportedLanguage, AudioQualityMetrics } from '../types';

interface VoiceCloningStudioProps {
  isOpen: boolean;
  onClose: () => void;
  voiceProfiles: VoiceProfile[];
  onVoiceProfilesChange: (profiles: VoiceProfile[]) => void;
  onSelectVoiceForDubbing?: (profile: VoiceProfile) => void;
}

export const VoiceCloningStudio: React.FC<VoiceCloningStudioProps> = ({
  isOpen,
  onClose,
  voiceProfiles,
  onVoiceProfilesChange,
  onSelectVoiceForDubbing,
}) => {
  const [activeTab, setActiveTab] = useState<'profiles' | 'create'>('profiles');
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    voiceProfiles[0]?.id || ''
  );

  // Creation State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'neutral'>('male');
  const [sampleBase64, setSampleBase64] = useState<string | null>(null);
  const [sampleFileName, setSampleFileName] = useState<string>('');
  const [sampleDuration, setSampleDuration] = useState<number>(0);
  const [qualityMetrics, setQualityMetrics] = useState<AudioQualityMetrics | null>(null);
  const [analyzingQuality, setAnalyzingQuality] = useState(false);

  // Microphone Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  // Consent State
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);

  // Cloning State
  const [isCloning, setIsCloning] = useState(false);
  const [cloningStatus, setCloningStatus] = useState('');

  // Multilingual Voice Tester State
  const [testLanguage, setTestLanguage] = useState<SupportedLanguage>('Hindi');
  const [testText, setTestText] = useState('');
  const [isGeneratingTest, setIsGeneratingTest] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isPlayingTest, setIsPlayingTest] = useState(false);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  // Sample playback for uploaded recording
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const sampleAudioRef = useRef<HTMLAudioElement | null>(null);

  const activeProfile = voiceProfiles.find((p) => p.id === selectedProfileId) || voiceProfiles[0];

  // Default test sample phrases in 4 languages
  const samplePhrases: Record<SupportedLanguage, string> = {
    English: 'Stop making boring videos. The first three seconds are everything!',
    Hindi: 'बोरिंग वीडियो बनाना बंद करें। पहले तीन सेकंड ही सब कुछ तय करते हैं!',
    Kannada: 'ಬೋರಿಂಗ್ ವೀಡಿಯೊಗಳನ್ನು ಮಾಡುವುದನ್ನು ನಿಲ್ಲಿಸಿ. ಮೊದಲ ಮೂರು ಸೆಕೆಂಡುಗಳೇ ಎಲ್ಲವೂ!',
    Telugu: 'బోరింగ్ వీడియోలు చేయడం ఆపండి. మొదటి మూడు సెకన్లు మాత్రమే అత్యంత కీలకం!',
  };

  useEffect(() => {
    setTestText(samplePhrases[testLanguage]);
  }, [testLanguage]);

  useEffect(() => {
    if (voiceProfiles.length > 0 && !selectedProfileId) {
      setSelectedProfileId(voiceProfiles[0].id);
    }
  }, [voiceProfiles]);

  if (!isOpen) return null;

  // Handle Local File Upload (MP3, WAV, M4A, MP4)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSampleFileName(file.name);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSampleBase64(base64);
      analyzeAudioSample(base64, file.type || 'audio/wav');
    };
    reader.readAsDataURL(file);
  };

  // Analyze Audio Quality via Server API
  const analyzeAudioSample = async (base64Data: string, mimeType: string) => {
    try {
      setAnalyzingQuality(true);
      const res = await fetch('/api/voice/analyze-quality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleBase64: base64Data, mimeType }),
      });
      const data = await res.json();
      if (data.success && data.metrics) {
        setQualityMetrics(data.metrics);
        setSampleDuration(data.metrics.durationSeconds);
      }
    } catch (err) {
      console.error('Audio quality check failed:', err);
    } finally {
      setAnalyzingQuality(false);
    }
  };

  // Microphone Recording Handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setSampleFileName('Microphone Recording.wav');

        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          setSampleBase64(base64);
          analyzeAudioSample(base64, 'audio/wav');
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      alert('Microphone access denied: ' + err.message);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(recordTimerRef.current);
    }
  };

  // Clone Voice Handler
  const handleCloneVoice = async () => {
    if (!name.trim()) {
      alert('Please enter a voice profile name.');
      return;
    }
    if (!sampleBase64) {
      alert('Please upload or record a voice sample first.');
      return;
    }
    if (!consentAcknowledged) {
      alert('Explicit voice owner authorization and consent are strictly required.');
      return;
    }

    try {
      setIsCloning(true);
      setCloningStatus('Learning acoustic timbre & speaker identity...');

      const res = await fetch('/api/voice/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          sampleBase64,
          gender,
          consentGiven: true,
        }),
      });

      const data = await res.json();
      if (data.success && data.profile) {
        const updated = [data.profile, ...voiceProfiles];
        onVoiceProfilesChange(updated);
        setSelectedProfileId(data.profile.id);
        setActiveTab('profiles');
        // Reset form
        setName('');
        setDescription('');
        setSampleBase64(null);
        setQualityMetrics(null);
        setConsentAcknowledged(false);
      } else {
        alert(data.error || 'Failed to clone voice');
      }
    } catch (err: any) {
      alert('Error during voice cloning: ' + err.message);
    } finally {
      setIsCloning(false);
      setCloningStatus('');
    }
  };

  // Multilingual Test Voice Generation
  const handleTestVoice = async () => {
    if (!activeProfile) return;
    try {
      setIsGeneratingTest(true);
      if (testAudioRef.current) {
        testAudioRef.current.pause();
        setIsPlayingTest(false);
      }

      const res = await fetch('/api/voice/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: testText,
          language: testLanguage,
          voiceProfile: activeProfile,
        }),
      });

      const data = await res.json();
      if (data.success && data.audioBase64) {
        const mime = data.mimeType || 'audio/wav';
        const url = `data:${mime};base64,${data.audioBase64}`;
        setTestAudioUrl(url);

        // Auto play generated sample
        setTimeout(() => {
          if (testAudioRef.current) {
            testAudioRef.current.src = url;
            testAudioRef.current.play().then(() => setIsPlayingTest(true)).catch(() => {});
          }
        }, 100);
      } else {
        alert(data.error || 'Failed to synthesize test speech');
      }
    } catch (err: any) {
      alert('Error testing voice: ' + err.message);
    } finally {
      setIsGeneratingTest(false);
    }
  };

  // Delete Voice Profile
  const handleDeleteProfile = async (profileId: string) => {
    const profile = voiceProfiles.find((p) => p.id === profileId);
    if (!profile) return;
    if (!confirm(`Are you sure you want to permanently delete "${profile.name}"?`)) return;

    try {
      await fetch(`/api/voice/${profileId}?externalVoiceId=${profile.externalVoiceId || ''}`, {
        method: 'DELETE',
      });
      const updated = voiceProfiles.filter((p) => p.id !== profileId);
      onVoiceProfilesChange(updated);
      if (selectedProfileId === profileId) {
        setSelectedProfileId(updated[0]?.id || '');
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Studio Top Header */}
        <div className="p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[14px] flex items-center justify-center">
                <Mic className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-base">AI Voice Cloning Studio</h3>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Multilingual v2
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Clone any speaker voice and synthesize speech in English, Hindi, Kannada & Telugu
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

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800 bg-zinc-950/40 p-1.5 gap-2 text-xs font-bold">
          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'profiles'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Radio className="w-4 h-4 text-indigo-400" />
            <span>My Voice Profiles ({voiceProfiles.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`flex-1 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'create'
                ? 'bg-zinc-800 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Create New AI Voice</span>
          </button>
        </div>

        {/* Studio Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB 1: PROFILES & MULTILINGUAL TESTER */}
          {activeTab === 'profiles' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
              {/* Left Column: Voice Profiles List */}
              <div className="md:col-span-5 space-y-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Saved Voice Profiles
                  </span>
                  <button
                    onClick={() => setActiveTab('create')}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Voice</span>
                  </button>
                </div>

                {voiceProfiles.length === 0 ? (
                  <div className="text-center py-10 rounded-2xl border border-dashed border-zinc-800 p-6">
                    <Mic className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                    <p className="text-xs text-zinc-400 mb-3">No voice profiles cloned yet.</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                    >
                      Clone Your First Voice
                    </button>
                  </div>
                ) : (
                  voiceProfiles.map((profile) => {
                    const isSelected = profile.id === selectedProfileId;
                    return (
                      <div
                        key={profile.id}
                        onClick={() => setSelectedProfileId(profile.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-950/25 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500'
                            : 'border-zinc-800 bg-zinc-950/50 hover:border-zinc-700 hover:bg-zinc-900/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                              {profile.name[0]?.toUpperCase() || 'V'}
                            </div>
                            <div>
                              <div className="font-bold text-white text-xs flex items-center gap-1.5">
                                <span>{profile.name}</span>
                                {profile.provider === 'elevenlabs' && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                    ElevenLabs
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-zinc-400 capitalize">
                                {profile.gender} • {profile.tone || 'Natural speaker'}
                              </div>
                            </div>
                          </div>

                          {/* Delete Action */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile.id);
                            }}
                            className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Voice Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Badges */}
                        <div className="mt-2.5 pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-500">
                          <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                            <ShieldCheck className="w-3 h-3" />
                            <span>Consent Verified</span>
                          </span>
                          <span>EN • HI • KN • TE</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Multilingual Voice Tester & Audio Inspector */}
              <div className="md:col-span-7 bg-zinc-950/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
                {activeProfile ? (
                  <>
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                      <div>
                        <div className="text-xs uppercase font-bold text-indigo-400 tracking-wider">
                          Active Cloned Voice Profile
                        </div>
                        <h4 className="text-sm font-black text-white">{activeProfile.name}</h4>
                      </div>
                      {onSelectVoiceForDubbing && (
                        <button
                          onClick={() => onSelectVoiceForDubbing(activeProfile)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-1"
                        >
                          <span>Use for Dubbing</span>
                        </button>
                      )}
                    </div>

                    {/* Acoustic Characteristics */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Tone</span>
                        <span className="text-xs font-semibold text-zinc-200">{activeProfile.tone || 'Conversational'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Pitch</span>
                        <span className="text-xs font-semibold text-zinc-200">{activeProfile.pitch || 'Medium'}</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-center">
                        <span className="text-[10px] text-zinc-500 uppercase font-bold block">Quality</span>
                        <span className="text-xs font-semibold text-emerald-400">{activeProfile.qualityScore}% Crisp</span>
                      </div>
                    </div>

                    {/* Multilingual Voice Generation Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Test Voice Across 4 Languages</span>
                        </label>
                      </div>

                      {/* Language Tabs: English, Hindi, Kannada, Telugu */}
                      <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-800">
                        {(['English', 'Hindi', 'Kannada', 'Telugu'] as SupportedLanguage[]).map((lang) => (
                          <button
                            key={lang}
                            onClick={() => setTestLanguage(lang)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all text-center ${
                              testLanguage === lang
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-zinc-400 hover:text-white'
                            }`}
                          >
                            <div>{lang}</div>
                            <div className="text-[9px] opacity-75 font-normal">
                              {lang === 'Hindi' ? 'हिन्दी' : lang === 'Kannada' ? 'ಕನ್ನಡ' : lang === 'Telugu' ? 'తెలుగు' : 'Native'}
                            </div>
                          </button>
                        ))}
                      </div>

                      {/* Text Input to Synthesize */}
                      <textarea
                        rows={3}
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        placeholder={`Type text in ${testLanguage} to speak with your cloned voice...`}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                      />

                      {/* Generate / Play Controls */}
                      <div className="flex items-center justify-between gap-3 pt-1">
                        <button
                          onClick={handleTestVoice}
                          disabled={isGeneratingTest || !testText.trim()}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {isGeneratingTest ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Synthesizing in {testLanguage}...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Generate Speech ({testLanguage})</span>
                            </>
                          )}
                        </button>

                        {testAudioUrl && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (!testAudioRef.current) return;
                                if (isPlayingTest) {
                                  testAudioRef.current.pause();
                                  setIsPlayingTest(false);
                                } else {
                                  testAudioRef.current.play().then(() => setIsPlayingTest(true)).catch(() => {});
                                }
                              }}
                              className="w-9 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-all shadow-md"
                              title={isPlayingTest ? 'Pause' : 'Play'}
                            >
                              {isPlayingTest ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5 fill-white" />}
                            </button>
                            <span className="text-xs font-semibold text-emerald-400">Audio Ready!</span>
                          </div>
                        )}
                      </div>

                      {/* Hidden Audio Elements */}
                      <audio
                        ref={testAudioRef}
                        onEnded={() => setIsPlayingTest(false)}
                        className="hidden"
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-zinc-500 text-xs">
                    Select a voice profile on the left to test.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CREATE NEW AI VOICE */}
          {activeTab === 'create' && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Step 1: Upload or Record Sample */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">Step 1: Provide Your Voice Sample</h4>
                    <p className="text-xs text-zinc-400">
                      Upload an audio file (MP3, WAV, M4A, MP4) or record 10 seconds of clear speech.
                    </p>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Acoustic Sample
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* File Upload Box */}
                  <label className="flex flex-col items-center justify-center border border-dashed border-zinc-700 hover:border-indigo-500 rounded-2xl p-6 cursor-pointer bg-zinc-900/60 hover:bg-zinc-900 transition-all text-center">
                    <Upload className="w-6 h-6 text-indigo-400 mb-2" />
                    <span className="font-bold text-xs text-zinc-200">Upload Audio File</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">MP3, WAV, M4A, MP4</span>
                    <input
                      type="file"
                      accept="audio/*,video/mp4"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>

                  {/* Microphone Recorder Box */}
                  <div className="flex flex-col items-center justify-center border border-zinc-800 rounded-2xl p-6 bg-zinc-900/60 text-center">
                    <Mic className={`w-6 h-6 mb-2 ${isRecording ? 'text-red-500 animate-pulse' : 'text-zinc-400'}`} />
                    {!isRecording ? (
                      <button
                        onClick={startRecording}
                        className="px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition-all shadow-md"
                      >
                        Record from Mic
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all flex items-center gap-1.5"
                      >
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>Stop (00:{recordSeconds.toString().padStart(2, '0')})</span>
                      </button>
                    )}
                    <span className="text-[10px] text-zinc-500 mt-1.5">Record 5–15 seconds</span>
                  </div>
                </div>

                {/* Sample Playback & Quality Analysis Report */}
                {sampleBase64 && (
                  <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FileAudio className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white truncate max-w-xs">{sampleFileName}</span>
                      </div>
                      <span className="font-mono text-zinc-400">{sampleDuration}s</span>
                    </div>

                    {analyzingQuality ? (
                      <div className="text-center py-2 text-xs text-indigo-300 flex items-center justify-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Analyzing acoustic quality & signal-to-noise ratio...</span>
                      </div>
                    ) : qualityMetrics ? (
                      <div className="space-y-2 pt-2 border-t border-zinc-800">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-zinc-400">Audio Quality Score:</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {qualityMetrics.clarityScore}/100 ({qualityMetrics.snrLevel})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {qualityMetrics.recommendations.map((rec, i) => (
                            <span
                              key={i}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300"
                            >
                              ✓ {rec}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              {/* Step 2: Voice Profile Information */}
              <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-4">
                <h4 className="font-bold text-white text-sm">Step 2: Speaker Profile Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Voice Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. My Personal Voice"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-zinc-300 block mb-1">
                      Gender Category
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['male', 'female', 'neutral'] as const).map((g) => (
                        <button
                          key={g}
                          onClick={() => setGender(g)}
                          className={`py-2 rounded-xl text-xs font-bold capitalize transition-all ${
                            gender === g
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'bg-zinc-900 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 block mb-1">
                    Tone / Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Energetic entrepreneur, confident and fast-paced"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Step 3: Explicit Legal & Ethical Consent */}
              <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-3">
                <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Step 3: Voice Owner Authorization & Consent</span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  In compliance with AI safety and voice synthesis standards, voice cloning requires explicit permission from the original speaker.
                </p>

                <label className="flex items-start gap-3 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={consentAcknowledged}
                    onChange={(e) => setConsentAcknowledged(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-amber-500 rounded cursor-pointer shrink-0"
                  />
                  <span className="text-xs text-zinc-300 leading-normal">
                    I confirm that I own this voice or have explicit authorization to create this AI voice clone. I authorize CaptioAI to process this recording for speech synthesis.
                  </span>
                </label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setActiveTab('profiles')}
                  className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCloneVoice}
                  disabled={isCloning || !name.trim() || !sampleBase64 || !consentAcknowledged}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isCloning ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>{cloningStatus || 'Cloning AI Voice...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Clone My AI Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
