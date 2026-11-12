import React, { useState } from 'react';
import {
  Palette,
  Type,
  Sparkles,
  MoveVertical,
  Sliders,
  Check,
  Zap,
  Smile,
  Slash,
  Clock,
  Flame,
  Tv,
  Film,
  Music,
  Mic,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import { CaptionStyleConfig, BackgroundType, AnimationType, TextCasing } from '../types';
import { PRESET_STYLES } from '../utils/demoData';

interface StyleEditorProps {
  style: CaptionStyleConfig;
  onChange: (updated: CaptionStyleConfig) => void;
  onAutoInsertEmojis?: () => void;
  isInsertingEmojis?: boolean;
  onDetectHighlights?: () => void;
  isDetectingHighlights?: boolean;
  onToggleRemoveEmojis?: (remove: boolean) => void;
}

// 12 Professional Presets with custom thumbnails and realistic preview texts
const PRESET_CARDS: Array<{
  key: string;
  name: string;
  category: string;
  sampleText: string;
  badgeBg: string;
  badgeTextColor: string;
  borderAccent: string;
  icon: React.FC<{ className?: string }>;
}> = [
  {
    key: 'cinematicPro',
    name: 'Cinematic Pro',
    category: 'Film & Doc',
    sampleText: 'THE UNSEEN JOURNEY',
    badgeBg: '#0B0F19',
    badgeTextColor: '#F8FAFC',
    borderAccent: '#334155',
    icon: Film,
  },
  {
    key: 'neonHighlight',
    name: 'Neon Highlight',
    category: 'Reels / TikTok',
    sampleText: 'ELECTRIC NEON GLOW',
    badgeBg: '#090916',
    badgeTextColor: '#00F0FF',
    borderAccent: '#00F0FF',
    icon: Zap,
  },
  {
    key: 'viralBold',
    name: 'Viral Bold',
    category: 'Shorts & Hooks',
    sampleText: 'STOP WASTING TIME',
    badgeBg: '#000000',
    badgeTextColor: '#FFE600',
    borderAccent: '#FFE600',
    icon: Flame,
  },
  {
    key: 'minimalClean',
    name: 'Minimal Clean',
    category: 'Modern Aesthetic',
    sampleText: 'Clean timeless design',
    badgeBg: '#18181B',
    badgeTextColor: '#FFFFFF',
    borderAccent: '#3F3F46',
    icon: Type,
  },
  {
    key: 'karaokePro',
    name: 'Karaoke Pro',
    category: 'Dynamic Word Fill',
    sampleText: 'SING EVERY SYLLABLE',
    badgeBg: '#0B0F19',
    badgeTextColor: '#38BDF8',
    borderAccent: '#6366F1',
    icon: Music,
  },
  {
    key: 'podcastPro',
    name: 'Podcast Pro',
    category: 'Interview & Audio',
    sampleText: 'Deep conversational dive',
    badgeBg: '#0F172A',
    badgeTextColor: '#F59E0B',
    borderAccent: '#F59E0B',
    icon: Mic,
  },
  {
    key: 'hormoziPunch',
    name: 'Hormozi Punch',
    category: '100M Viral Offers',
    sampleText: '100M CASH OFFERS',
    badgeBg: '#000000',
    badgeTextColor: '#FFE600',
    borderAccent: '#00FF66',
    icon: Flame,
  },
  {
    key: 'mrBeastImpact',
    name: 'MrBeast Impact',
    category: 'High-Energy Retention',
    sampleText: 'WIN $1,000,000 CASH',
    badgeBg: '#E11D48',
    badgeTextColor: '#FFFFFF',
    borderAccent: '#FFE600',
    icon: Zap,
  },
  {
    key: 'elegantSubtitle',
    name: 'Elegant Subtitle',
    category: 'Subtle Lower Third',
    sampleText: 'Whispers in the dark night',
    badgeBg: '#0F172A',
    badgeTextColor: '#E2E8F0',
    borderAccent: '#475569',
    icon: Film,
  },
  {
    key: 'gradientGlow',
    name: 'Gradient Glow',
    category: 'Cyberpunk & Sci-Fi',
    sampleText: 'FUTURISTIC AI ENGINE',
    badgeBg: '#160826',
    badgeTextColor: '#EC4899',
    borderAccent: '#C084FC',
    icon: Sparkles,
  },
  {
    key: 'typewriter',
    name: 'Typewriter',
    category: 'Terminal / Story',
    sampleText: 'System initializing...',
    badgeBg: '#0B0F19',
    badgeTextColor: '#38BDF8',
    borderAccent: '#0284C7',
    icon: Type,
  },
  {
    key: 'retroVHS',
    name: 'Retro VHS',
    category: '90s Nostalgia',
    sampleText: 'PLAYBACK 1994 //',
    badgeBg: '#030803',
    badgeTextColor: '#39FF14',
    borderAccent: '#39FF14',
    icon: Tv,
  },
];

export const StyleEditor: React.FC<StyleEditorProps> = ({
  style,
  onChange,
  onAutoInsertEmojis,
  isInsertingEmojis = false,
  onDetectHighlights,
  isDetectingHighlights = false,
  onToggleRemoveEmojis,
}) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'typography' | 'colors' | 'motion' | 'controls'>('presets');

  const update = (patch: Partial<CaptionStyleConfig>) => {
    onChange({ ...style, ...patch });
  };

  const handlePresetSelect = (presetKey: string) => {
    const targetPreset = PRESET_STYLES[presetKey];
    if (targetPreset) {
      // Preserve user's current removeEmojis, syncOffset, and containerBgEnabled preferences across preset switches
      onChange({
        ...targetPreset,
        removeEmojis: style.removeEmojis ?? false,
        syncOffset: style.syncOffset ?? 0,
        containerBgEnabled: style.containerBgEnabled ?? false,
      });
    }
  };

  const fonts = [
    { name: 'Anton', label: 'Anton (Heavy Punch)', font: 'Anton' },
    { name: 'Montserrat', label: 'Montserrat (Modern Bold)', font: 'Montserrat' },
    { name: 'Space Grotesk', label: 'Space Grotesk (Tech / Cyber)', font: 'Space Grotesk' },
    { name: 'Outfit', label: 'Outfit (Sleek Clean)', font: 'Outfit' },
    { name: 'Inter', label: 'Inter (Refined Minimal)', font: 'Inter' },
    { name: 'Bungee', label: 'Bungee (Retro Arcade)', font: 'Bungee' },
  ];

  const quickHighlightColors = [
    '#FFE600', // Yellow
    '#00FF66', // Lime green
    '#00F0FF', // Cyan
    '#FF007F', // Hot Pink
    '#F59E0B', // Amber
    '#A855F7', // Purple
    '#EF4444', // Red
    '#FFFFFF', // White
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-zinc-800 bg-zinc-950/70 p-1.5 gap-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 min-w-[70px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'presets'
              ? 'bg-zinc-800 text-white shadow-sm font-bold ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Presets (12)</span>
        </button>

        <button
          onClick={() => setActiveTab('typography')}
          className={`flex-1 min-w-[65px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'typography'
              ? 'bg-zinc-800 text-white shadow-sm font-bold ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Type className="w-3.5 h-3.5 text-indigo-400" />
          <span>Font</span>
        </button>

        <button
          onClick={() => setActiveTab('colors')}
          className={`flex-1 min-w-[65px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'colors'
              ? 'bg-zinc-800 text-white shadow-sm font-bold ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Palette className="w-3.5 h-3.5 text-pink-400" />
          <span>Colors</span>
        </button>

        <button
          onClick={() => setActiveTab('motion')}
          className={`flex-1 min-w-[65px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'motion'
              ? 'bg-zinc-800 text-white shadow-sm font-bold ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Motion</span>
        </button>

        <button
          onClick={() => setActiveTab('controls')}
          className={`flex-1 min-w-[65px] py-2 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'controls'
              ? 'bg-zinc-800 text-white shadow-sm font-bold ring-1 ring-zinc-700'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>Sync & Emojis</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 overflow-y-auto space-y-5 text-zinc-300 text-sm flex-1">
        {/* PRESETS TAB: 12 DISTINCT PROFESSIONAL CARDS */}
        {activeTab === 'presets' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  12 Professional Text Presets
                </h4>
                <p className="text-[11px] text-zinc-400">
                  Engineered styles with custom typography, kinetics, and background boxes.
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Live Preview
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PRESET_CARDS.map((card) => {
                const presetObj = PRESET_STYLES[card.key];
                const isSelected = style.presetName === card.name;
                const IconComponent = card.icon;

                return (
                  <button
                    key={card.key}
                    onClick={() => handlePresetSelect(card.key)}
                    className={`relative p-3 rounded-xl border text-left transition-all duration-150 group flex flex-col justify-between h-32 overflow-hidden ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-950/40 shadow-xl shadow-indigo-600/15 ring-2 ring-indigo-500/80 scale-[1.01]'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* Top Row: Name + Checkmark / Category */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-1.5 truncate">
                        <IconComponent className="w-3.5 h-3.5 text-zinc-400 group-hover:text-white shrink-0" />
                        <span className="text-xs font-bold text-zinc-200 group-hover:text-white truncate">
                          {card.name}
                        </span>
                      </div>
                      {isSelected ? (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow">
                          <Check className="w-2.5 h-2.5" />
                        </div>
                      ) : (
                        <span className="text-[9px] text-zinc-400 shrink-0">
                          {card.category.split(' ')[0]}
                        </span>
                      )}
                    </div>

                    {/* Thumbnail Sample Preview Box */}
                    <div
                      className="w-full py-2 px-2 rounded-lg text-center truncate font-black transition-all flex items-center justify-center border shadow-inner my-1"
                      style={{
                        fontFamily: `"${presetObj?.fontFamily || 'sans-serif'}", sans-serif`,
                        backgroundColor: presetObj?.bgType !== 'none' ? presetObj?.bgColor || '#000000' : 'rgba(0,0,0,0.4)',
                        borderColor: isSelected ? card.borderAccent : 'rgba(255,255,255,0.08)',
                        color: presetObj?.highlightColor || card.badgeTextColor,
                        textTransform: presetObj?.casing || 'uppercase',
                        letterSpacing: `${presetObj?.letterSpacing || 1}px`,
                        textShadow: presetObj?.strokeWidth ? `0 0 6px ${presetObj.shadowColor}` : 'none',
                        fontSize: '11px',
                      }}
                    >
                      {card.sampleText}
                    </div>

                    {/* Bottom Metadata Pill */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 w-full pt-1 border-t border-zinc-800/60">
                      <span className="capitalize">{presetObj?.animation || 'Kinetic'}</span>
                      <span className="text-zinc-400 truncate max-w-[80px]">
                        {presetObj?.fontFamily}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TYPOGRAPHY TAB */}
        {activeTab === 'typography' && (
          <div className="space-y-4">
            {/* Font Family */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Font Family
              </label>
              <div className="grid grid-cols-2 gap-2">
                {fonts.map((f) => (
                  <button
                    key={f.font}
                    onClick={() => update({ fontFamily: f.font })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      style.fontFamily === f.font
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-300 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-sm truncate" style={{ fontFamily: `"${f.font}", sans-serif` }}>
                      Sample Subtitle
                    </div>
                    <div className="text-[10px] text-zinc-400 truncate">{f.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Font Size
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">{style.fontSize}px</span>
              </div>
              <input
                type="range"
                min="20"
                max="64"
                value={style.fontSize}
                onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />
            </div>

            {/* Weight, Italic & Alignment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Weight & Style
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => update({ isBold: style.isBold === false ? true : false })}
                    className={`py-2 px-2 rounded-lg border text-xs font-extrabold transition-all ${
                      style.isBold !== false
                        ? 'border-indigo-500 bg-indigo-950/40 text-white'
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Bold
                  </button>
                  <button
                    onClick={() => update({ isItalic: !style.isItalic })}
                    className={`py-2 px-2 rounded-lg border text-xs italic transition-all ${
                      style.isItalic
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Italic
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Text Alignment
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => update({ textAlign: align })}
                      className={`py-2 px-1 rounded-lg border text-xs font-medium flex items-center justify-center transition-all ${
                        (style.textAlign || 'center') === align
                          ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold'
                          : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {align === 'left' ? <AlignLeft className="w-3.5 h-3.5" /> : align === 'right' ? <AlignRight className="w-3.5 h-3.5" /> : <AlignCenter className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Casing */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Letter Casing
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['uppercase', 'normal', 'lowercase'] as TextCasing[]).map((c) => (
                  <button
                    key={c}
                    onClick={() => update({ casing: c })}
                    className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-all ${
                      style.casing === c
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold'
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {c === 'uppercase' ? 'UPPERCASE' : c === 'normal' ? 'Sentence' : 'lowercase'}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Words Per Line */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Max Words Per Line
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {style.wordsPerLine || 4} words
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="1"
                value={style.wordsPerLine || 4}
                onChange={(e) => update({ wordsPerLine: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />
            </div>

            {/* Line Spacing / Line Height */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Line Height / Spacing
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {(style.lineHeight || 1.15).toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="1.0"
                max="1.8"
                step="0.05"
                value={style.lineHeight || 1.15}
                onChange={(e) => update({ lineHeight: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />
            </div>

            {/* Word Spacing & Letter Spacing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Word Gap
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{style.wordSpacing ?? 8}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="1"
                  value={style.wordSpacing ?? 8}
                  onChange={(e) => update({ wordSpacing: parseInt(e.target.value) })}
                  className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Tracking
                  </label>
                  <span className="text-xs font-mono text-indigo-400 font-bold">{style.letterSpacing}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6"
                  step="0.5"
                  value={style.letterSpacing}
                  onChange={(e) => update({ letterSpacing: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* COLORS TAB */}
        {activeTab === 'colors' && (
          <div className="space-y-4">
            {/* Highlight Word Color */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Keyword Highlight Color
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {quickHighlightColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => update({ highlightColor: color })}
                    style={{ backgroundColor: color }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                      style.highlightColor.toLowerCase() === color.toLowerCase()
                        ? 'border-white scale-110 shadow-md'
                        : 'border-transparent'
                    }`}
                  />
                ))}
                <input
                  type="color"
                  value={style.highlightColor}
                  onChange={(e) => update({ highlightColor: e.target.value })}
                  className="w-7 h-7 rounded-full bg-transparent cursor-pointer border border-zinc-700"
                  title="Custom Highlight Color"
                />
              </div>

              {onDetectHighlights && (
                <button
                  onClick={onDetectHighlights}
                  disabled={isDetectingHighlights}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 text-yellow-400 ${isDetectingHighlights ? 'animate-spin' : ''}`} />
                  <span>{isDetectingHighlights ? 'Detecting Keywords...' : 'Auto-Highlight Keywords with AI'}</span>
                </button>
              )}
            </div>

            {/* Active Word Spoken Color & Background Pill */}
            <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Active Spoken Word Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={style.activeWordColor}
                    onChange={(e) => update({ activeWordColor: e.target.value })}
                    className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-700"
                  />
                  <span className="font-mono text-xs text-zinc-400">{style.activeWordColor}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-zinc-200">Active Spoken Pill Background</div>
                  <div className="text-[10px] text-zinc-400">Background pill highlighting current word</div>
                </div>
                <div className="flex items-center gap-2">
                  {style.showActiveWordBg && (
                    <input
                      type="color"
                      value={style.activeWordBgColor || '#6366F1'}
                      onChange={(e) => update({ activeWordBgColor: e.target.value })}
                      className="w-7 h-7 rounded-lg bg-transparent cursor-pointer border border-zinc-700"
                      title="Active Pill Color"
                    />
                  )}
                  <button
                    onClick={() => update({ showActiveWordBg: !style.showActiveWordBg })}
                    className={`w-10 h-5 rounded-full transition-colors relative flex items-center px-0.5 ${
                      style.showActiveWordBg ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white shadow-md transform transition-transform ${
                        style.showActiveWordBg ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Primary Text Color */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                Primary Text Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={style.textColor}
                  onChange={(e) => update({ textColor: e.target.value })}
                  className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-700"
                />
                <span className="font-mono text-xs text-zinc-400">{style.textColor}</span>
              </div>
            </div>

            {/* Stroke / Outline */}
            <div className="pt-2 border-t border-zinc-800">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Text Stroke Outline
                </label>
                <span className="text-xs font-mono text-indigo-400">{style.strokeWidth}px</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={style.strokeColor}
                  onChange={(e) => update({ strokeColor: e.target.value })}
                  className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-700"
                />
                <input
                  type="range"
                  min="0"
                  max="6"
                  value={style.strokeWidth}
                  onChange={(e) => update({ strokeWidth: parseInt(e.target.value) })}
                  className="flex-1 accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Drop Shadow / Glow */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Shadow & Neon Glow
                </label>
                <span className="text-xs font-mono text-indigo-400">{style.shadowBlur}px</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={style.shadowColor.startsWith('#') ? style.shadowColor : '#00F0FF'}
                  onChange={(e) => update({ shadowColor: e.target.value })}
                  className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border border-zinc-700"
                />
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={style.shadowBlur}
                  onChange={(e) => update({ shadowBlur: parseInt(e.target.value) })}
                  className="flex-1 accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* MOTION & LAYOUT TAB */}
        {activeTab === 'motion' && (
          <div className="space-y-4">
            {/* Animation Style */}
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Animation Engine Effect
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'popup', label: '1. Pop-Up', desc: 'Punchy scale-in per spoken word' },
                  { id: 'bounce', label: '2. Bounce', desc: 'High-energy scale bounce' },
                  { id: 'karaoke', label: '3. Karaoke', desc: 'Highlight active word with glow' },
                  { id: 'slide', label: '4. Slide Up', desc: 'Words glide upward smoothly' },
                  { id: 'fade', label: '5. Fade In', desc: 'Cinematic progressive fade' },
                  { id: 'typewriter', label: '6. Typewriter', desc: 'Character-by-character reveal' },
                  { id: 'none', label: 'Static', desc: 'Clean static readability' },
                ].map((anim) => (
                  <button
                    key={anim.id}
                    onClick={() => update({ animation: anim.id as AnimationType })}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      style.animation === anim.id
                        ? 'border-indigo-500 bg-indigo-950/40 text-white font-bold shadow-sm ring-1 ring-indigo-500/50'
                        : 'border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="text-xs text-zinc-200 font-semibold">{anim.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{anim.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Animation Speed */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Animation Pace
                </label>
                <span className="text-xs font-mono text-indigo-400 font-bold">
                  {(style.animationSpeed ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={style.animationSpeed ?? 1.0}
                onChange={(e) => update({ animationSpeed: parseFloat(e.target.value) })}
                className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />
            </div>

            {/* Caption Container Background – Manual Toggle Only */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
                    <span>Caption Container Background</span>
                  </label>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    {style.containerBgEnabled
                      ? 'Backdrop container is active behind subtitle lines'
                      : 'Completely transparent background (Default: OFF)'}
                  </p>
                </div>

                {/* Clear ON/OFF Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(style.containerBgEnabled)}
                  onClick={() =>
                    update({
                      containerBgEnabled: !style.containerBgEnabled,
                      // If enabling for the first time and bgType was 'none', set to 'pill'
                      bgType:
                        !style.containerBgEnabled && style.bgType === 'none'
                          ? 'pill'
                          : style.bgType || 'pill',
                    })
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    style.containerBgEnabled ? 'bg-indigo-600' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      style.containerBgEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* OFF State Helper Note */}
              {!style.containerBgEnabled ? (
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400/80"></span>
                    <span>Transparent Background Active</span>
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                    OFF
                  </span>
                </div>
              ) : (
                /* ON State: Customization Options */
                <div className="space-y-3 pt-2 border-t border-zinc-800 animate-in fade-in duration-150">
                  {/* Container Shape */}
                  <div>
                    <span className="text-[11px] font-semibold text-zinc-400 block mb-1.5">
                      Container Shape & Style
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['pill', 'box', 'outline'] as BackgroundType[]).map((bg) => (
                        <button
                          key={bg}
                          type="button"
                          onClick={() => update({ bgType: bg })}
                          className={`py-1.5 px-2 rounded-lg border text-xs capitalize text-center transition-all ${
                            style.bgType === bg
                              ? 'border-indigo-500 bg-indigo-950/60 text-white font-bold ring-1 ring-indigo-500/50'
                              : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          {bg === 'pill' ? 'Pill (Curved)' : bg === 'box' ? 'Box (Square)' : 'Neon Outline'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Background Color & Swatches */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-zinc-400">Backdrop Color</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase">
                          {style.bgColor || '#000000'}
                        </span>
                        <input
                          type="color"
                          value={style.bgColor || '#000000'}
                          onChange={(e) => update({ bgColor: e.target.value })}
                          className="w-6 h-6 rounded-md bg-transparent cursor-pointer border border-zinc-700 p-0"
                        />
                      </div>
                    </div>
                    {/* Quick Palette */}
                    <div className="flex gap-1.5">
                      {[
                        { label: 'Black', color: '#000000' },
                        { label: 'Dark Navy', color: '#0B0F19' },
                        { label: 'Deep Indigo', color: '#1E1B4B' },
                        { label: 'Charcoal', color: '#18181B' },
                        { label: 'Dark Red', color: '#450A0A' },
                        { label: 'Dark Emerald', color: '#064E3B' },
                      ].map((item) => (
                        <button
                          key={item.color}
                          type="button"
                          title={item.label}
                          onClick={() => update({ bgColor: item.color })}
                          className={`flex-1 h-5 rounded-md border transition-transform ${
                            style.bgColor === item.color
                              ? 'border-indigo-400 scale-110 shadow'
                              : 'border-zinc-700/80 hover:scale-105'
                          }`}
                          style={{ backgroundColor: item.color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Opacity */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-semibold text-zinc-400">Container Opacity</span>
                      <span className="text-xs font-mono text-indigo-400 font-bold">
                        {Math.round((style.bgOpacity ?? 0.85) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.05"
                      value={style.bgOpacity ?? 0.85}
                      onChange={(e) => update({ bgOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Position */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <MoveVertical className="w-3.5 h-3.5" />
                  <span>Vertical Position</span>
                </label>
                <span className="text-xs font-mono text-indigo-400">{style.verticalPosition}%</span>
              </div>
              <input
                type="range"
                min="15"
                max="90"
                value={style.verticalPosition}
                onChange={(e) => update({ verticalPosition: parseInt(e.target.value) })}
                className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-400 mt-1">
                <span>Top (15%)</span>
                <span>Center (50%)</span>
                <span>Lower Third (75%)</span>
              </div>
            </div>
          </div>
        )}

        {/* SYNC & EMOJI CONTROLS TAB */}
        {activeTab === 'controls' && (
          <div className="space-y-4">
            {/* Audio/Voice Sync Offset Slider */}
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <div>
                    <h5 className="text-xs font-bold text-white">Voice & Caption Sync Offset</h5>
                    <p className="text-[11px] text-zinc-400">
                      Fine-tune timestamp alignment if audio stream has container latency.
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/30">
                  {((style.syncOffset ?? 0) >= 0 ? '+' : '') + Math.round((style.syncOffset ?? 0) * 1000)}ms
                </span>
              </div>

              <input
                type="range"
                min="-0.5"
                max="0.5"
                step="0.05"
                value={style.syncOffset ?? 0}
                onChange={(e) => update({ syncOffset: parseFloat(e.target.value) })}
                className="w-full accent-cyan-500 bg-zinc-800 h-2 rounded cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                <span>-500ms (Shift earlier)</span>
                <button
                  onClick={() => update({ syncOffset: 0 })}
                  className="text-zinc-400 hover:text-white underline cursor-pointer"
                  title="Reset offset to 0"
                >
                  0ms (Exact speech)
                </button>
                <span>+500ms (Shift later)</span>
              </div>
            </div>

            {/* REMOVE EMOJIS TOGGLE CARD (User Requirement 2) */}
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    style.removeEmojis ? 'bg-rose-500/20 text-rose-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    <Slash className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Remove Emojis</span>
                      {style.removeEmojis && (
                        <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.2 rounded font-semibold border border-rose-500/30">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Strip all emojis from captions, timestamps, and exported MP4
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const nextVal = !style.removeEmojis;
                    update({ removeEmojis: nextVal });
                    if (onToggleRemoveEmojis) {
                      onToggleRemoveEmojis(nextVal);
                    }
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                    style.removeEmojis ? 'bg-rose-600' : 'bg-zinc-700'
                  }`}
                  title="Toggle Remove Emojis"
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                      style.removeEmojis ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <p className="text-[10px] text-zinc-400 pl-10">
                Preserves all words, punctuation, and sentence cadence while guaranteeing no emojis appear in preview or export.
              </p>
            </div>

            {/* SHOW AI EMOJIS (When removeEmojis is false) */}
            {!style.removeEmojis && (
              <div className="p-3.5 rounded-xl bg-zinc-950/50 border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smile className="w-4 h-4 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-zinc-200">Show AI Animated Emojis</div>
                      <div className="text-[11px] text-zinc-400">Display contextual bouncing emoji on caption lines</div>
                    </div>
                  </div>
                  <button
                    onClick={() => update({ showEmojis: !(style.showEmojis ?? true) })}
                    className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 shrink-0 ${
                      (style.showEmojis ?? true) ? 'bg-indigo-600' : 'bg-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        (style.showEmojis ?? true) ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {(style.showEmojis ?? true) && onAutoInsertEmojis && (
                  <button
                    onClick={onAutoInsertEmojis}
                    disabled={isInsertingEmojis}
                    className="w-full py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${isInsertingEmojis ? 'animate-spin' : ''}`} />
                    <span>{isInsertingEmojis ? 'Analyzing Sentiment & Emojis...' : 'Re-analyze Sentiment & Emojis'}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
