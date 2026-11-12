export interface WordTimestamp {
  word: string;
  start: number; // in seconds
  end: number;   // in seconds
  isHighlighted?: boolean;
}

export interface CaptionSegment {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
  emoji?: string;
  sentiment?: string;
  contextReasoning?: string;
  highlightedWords?: string[];
  words: WordTimestamp[];
  speaker?: string;
  speakerGender?: 'male' | 'female';
}

export type AnimationType = 'popup' | 'karaoke' | 'bounce' | 'slide' | 'fade' | 'typewriter' | 'none';
export type BackgroundType = 'none' | 'box' | 'pill' | 'outline';
export type TextCasing = 'uppercase' | 'normal' | 'lowercase';
export type AspectRatio = '9:16' | '16:9' | '1:1';
export type TextAlign = 'left' | 'center' | 'right';

export interface CaptionStyleConfig {
  presetName: string;
  fontFamily: string; // 'Anton' | 'Montserrat' | 'Inter' | 'Outfit' | 'Space Grotesk' | 'Bungee'
  fontSize: number;   // e.g. 28 to 56
  textColor: string;  // e.g. '#ffffff'
  highlightColor: string; // e.g. '#ffe600' (Hormozi yellow)
  activeWordColor: string; // e.g. '#00ff66' (active spoken word)
  activeWordBgColor?: string; // Background pill color on currently spoken word
  showActiveWordBg?: boolean; // Toggle active word background pill
  strokeColor: string; // e.g. '#000000'
  strokeWidth: number; // e.g. 0 to 6
  shadowColor: string;
  shadowBlur: number;
  bgType: BackgroundType;
  bgColor: string;
  bgOpacity: number;
  containerBgEnabled?: boolean; // Manual toggle only: default false (100% transparent)
  containerBgPadding?: 'compact' | 'normal' | 'generous';
  containerBgRadius?: 'pill' | 'box' | 'rounded';
  animation: AnimationType;
  animationSpeed?: number; // 0.5x to 2.0x speed multiplier
  casing: TextCasing;
  verticalPosition: number; // 10% (top) to 90% (bottom safe zone)
  wordsPerLine: number; // 1 (hyper punchy) to 8
  wordSpacing?: number; // Horizontal gap between words in px (default 8)
  textAlign?: TextAlign;
  isBold?: boolean;
  isItalic?: boolean;
  showEmojis: boolean;
  removeEmojis?: boolean;
  syncOffset?: number; // In seconds (e.g. -0.2 to +0.2) to calibrate voice/caption synchronization
  letterSpacing: number; // e.g. 0 to 4
  lineHeight?: number;
}

export interface PlatformSuggestion {
  platform: 'Instagram' | 'TikTok' | 'YouTube Shorts' | 'LinkedIn';
  advice: string;
}

export interface SocialKitData {
  hooks: string[];
  titles: string[];
  caption: string;
  hashtags: string[];
  callToActions: string[];
  instagramCaption?: string;
  youtubeTitles?: string[];
  videoDescription?: string;
  seoKeywords?: string[];
  platformSuggestions?: PlatformSuggestion[];
}

export interface HookAlternative {
  style: string;
  text: string;
  whyItWorks: string;
}

export interface HookAnalysisData {
  score: number;
  verdict: string;
  weakness: string;
  critique: string;
  alternatives: HookAlternative[];
}

export interface DemoVideo {
  id: string;
  title: string;
  duration: number;
  category: string;
  aspectRatio: AspectRatio;
  videoUrl: string;
  thumbnail: string;
  segments: CaptionSegment[];
  recommendedPreset: string;
  detectedLanguage?: string;
}

export type SupportedLanguage = 'English' | 'Hindi' | 'Kannada' | 'Telugu';

export interface AudioQualityMetrics {
  durationSeconds: number;
  snrLevel: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  clarityScore: number; // 0 - 100
  backgroundNoise: 'Low' | 'Medium' | 'High';
  hasClipping: boolean;
  isValid: boolean;
  recommendations: string[];
}

export interface VoiceProfile {
  id: string;
  name: string;
  description?: string;
  gender: 'male' | 'female' | 'neutral';
  accent?: string;
  tone?: string;
  pitch?: string;
  sampleAudioBase64?: string;
  durationSeconds: number;
  qualityScore: number;
  hasConsent: boolean;
  consentTimestamp: string;
  provider: 'elevenlabs' | 'gemini_voice_design';
  externalVoiceId?: string; // ElevenLabs voice_id if cloned via ElevenLabs
  createdAt: string;
}

export interface DubbingSegment {
  segmentId: string;
  originalText: string;
  translatedText: string;
  start: number;
  end: number;
  audioBase64?: string;
  audioUrl?: string;
  speaker?: string;
  speakerGender?: 'male' | 'female';
}

export interface DubbingTrack {
  id: string;
  language: SupportedLanguage;
  voiceProfileId: string;
  voiceProfileName: string;
  segments: DubbingSegment[];
  compiledAudioUrl?: string;
  masterAudioUrl?: string;
  duckOriginalVolume: number; // 0 to 1 (e.g. 0.15 = 15% original background)
  dubbedVoiceVolume: number;  // 0 to 1 (e.g. 1.0 = 100%)
  createdAt: string;
  speakerVoices?: Record<string, string>;
}

export interface MultiLanguageDubbingResult {
  originalLanguage: string;
  tracks: Partial<Record<SupportedLanguage, DubbingTrack>>;
}

export interface VideoCodecInspection {
  videoCodec: string;
  audioCodec: string;
  pixFmt: string;
  width: number;
  height: number;
  duration: number;
  isBrowserCompatible: boolean;
  needsTranscode: boolean;
  reason?: string;
}

