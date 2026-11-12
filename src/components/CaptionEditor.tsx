import React, { useState } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Globe,
  UploadCloud,
  Download,
  Smile,
  ChevronDown,
  Layers,
  Wand2,
  FileText,
  Zap,
  Scissors,
  Merge,
} from 'lucide-react';
import { CaptionSegment, CaptionStyleConfig } from '../types';
import { formatDisplayTime, generateSRT, parseSRT, formatSegmentsTo1SecondPacing } from '../utils/subtitleParsers';

interface CaptionEditorProps {
  segments: CaptionSegment[];
  onSegmentsChange: (segments: CaptionSegment[]) => void;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  style?: CaptionStyleConfig;
  onStyleChange?: (style: CaptionStyleConfig) => void;
}

export const CaptionEditor: React.FC<CaptionEditorProps> = ({
  segments,
  onSegmentsChange,
  currentTime,
  duration,
  onSeek,
  style,
  onStyleChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [translating, setTranslating] = useState(false);
  const [targetLang, setTargetLang] = useState('Spanish');
  const [showTranslateDropdown, setShowTranslateDropdown] = useState(false);
  const [showScriptAlignModal, setShowScriptAlignModal] = useState(false);
  const [scriptInput, setScriptInput] = useState('');
  const [aligningScript, setAligningScript] = useState(false);

  // Auto-Insert Emojis State
  const [autoInsertingEmojis, setAutoInsertingEmojis] = useState(false);
  const [showEmojiToneDropdown, setShowEmojiToneDropdown] = useState(false);
  const [selectedEmojiTone, setSelectedEmojiTone] = useState<'viral' | 'inspirational' | 'humorous' | 'tech'>('viral');
  const [emojiToast, setEmojiToast] = useState<string | null>(null);

  // Auto-Detect Highlights State
  const [detectingHighlights, setDetectingHighlights] = useState(false);
  const [showHighlightDropdown, setShowHighlightDropdown] = useState(false);
  const [highlightIntensity, setHighlightIntensity] = useState<'viral_high' | 'balanced' | 'subtle'>('balanced');

  // Filter segments by search
  const filteredSegments = segments.filter((seg) =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeSegmentId = segments.find(
    (s) => currentTime >= s.start && currentTime <= s.end
  )?.id;

  const updateSegment = (id: string, patch: Partial<CaptionSegment>) => {
    onSegmentsChange(
      segments.map((seg) => {
        if (seg.id !== id) return seg;
        const updated = { ...seg, ...patch };

        // If text was edited, update words array if needed
        if (patch.text !== undefined && patch.text !== seg.text) {
          const wordsArr = patch.text.split(/\s+/).filter(Boolean);
          const dur = Math.max(0.2, updated.end - updated.start);
          updated.words = wordsArr.map((w, idx) => {
            const existingWord = seg.words?.[idx];
            return {
              word: w,
              start: Number((updated.start + (idx / wordsArr.length) * dur).toFixed(2)),
              end: Number((updated.start + ((idx + 1) / wordsArr.length) * dur).toFixed(2)),
              isHighlighted: existingWord?.isHighlighted || false,
            };
          });
        }
        if (patch.emoji && onStyleChange && style && !style.showEmojis) {
          onStyleChange({ ...style, showEmojis: true });
        }
        return updated;
      })
    );
  };

  const toggleWordHighlight = (segmentId: string, wordIndex: number) => {
    onSegmentsChange(
      segments.map((seg) => {
        if (seg.id !== segmentId) return seg;
        const newWords = [...seg.words];
        if (newWords[wordIndex]) {
          newWords[wordIndex] = {
            ...newWords[wordIndex],
            isHighlighted: !newWords[wordIndex].isHighlighted,
          };
        }
        return {
          ...seg,
          words: newWords,
        };
      })
    );
  };

  const addSegment = (afterIndex: number) => {
    const prev = segments[afterIndex];
    const newStart = prev ? Number((prev.end + 0.1).toFixed(2)) : 0;
    const newEnd = Number((newStart + 2.0).toFixed(2));

    const newSeg: CaptionSegment = {
      id: `seg-${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: 'New viral caption phrase',
      emoji: '🔥',
      words: [
        { word: 'New', start: newStart, end: newStart + 0.5, isHighlighted: true },
        { word: 'viral', start: newStart + 0.5, end: newStart + 1.0 },
        { word: 'caption', start: newStart + 1.0, end: newStart + 1.5 },
        { word: 'phrase', start: newStart + 1.5, end: newEnd },
      ],
    };

    const updated = [...segments];
    updated.splice(afterIndex + 1, 0, newSeg);
    onSegmentsChange(updated);
  };

  const deleteSegment = (id: string) => {
    if (segments.length <= 1) return;
    onSegmentsChange(segments.filter((s) => s.id !== id));
  };

  const splitSegment = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const seg = segments[idx];
    const words = seg.words && seg.words.length > 0
      ? seg.words
      : seg.text.split(/\s+/).filter(Boolean).map((w, i, arr) => ({
          word: w,
          start: Number((seg.start + (i / arr.length) * (seg.end - seg.start)).toFixed(2)),
          end: Number((seg.start + ((i + 1) / arr.length) * (seg.end - seg.start)).toFixed(2)),
        }));
    if (words.length < 2) return;

    const mid = Math.ceil(words.length / 2);
    const firstWords = words.slice(0, mid);
    const secondWords = words.slice(mid);
    const splitTime = secondWords[0].start;

    const firstSeg: CaptionSegment = {
      ...seg,
      end: splitTime,
      text: firstWords.map((w) => w.word).join(' '),
      words: firstWords,
    };

    const secondSeg: CaptionSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      start: splitTime,
      end: seg.end,
      text: secondWords.map((w) => w.word).join(' '),
      emoji: seg.emoji || '✨',
      words: secondWords,
    };

    const updated = [...segments];
    updated.splice(idx, 1, firstSeg, secondSeg);
    onSegmentsChange(updated);
  };

  const mergeWithNext = (id: string) => {
    const idx = segments.findIndex((s) => s.id === id);
    if (idx === -1 || idx >= segments.length - 1) return;
    const current = segments[idx];
    const next = segments[idx + 1];

    const mergedWords = [...(current.words || []), ...(next.words || [])];
    const mergedSeg: CaptionSegment = {
      ...current,
      end: next.end,
      text: `${current.text.trim()} ${next.text.trim()}`.trim(),
      words: mergedWords,
    };

    const updated = [...segments];
    updated.splice(idx, 2, mergedSeg);
    onSegmentsChange(updated);
  };

  const nudgeTime = (id: string, field: 'start' | 'end', delta: number) => {
    onSegmentsChange(
      segments.map((seg) => {
        if (seg.id !== id) return seg;
        const newVal = Number((seg[field] + delta).toFixed(2));
        if (field === 'start' && (newVal < 0 || newVal >= seg.end)) return seg;
        if (field === 'end' && newVal <= seg.start) return seg;
        return { ...seg, [field]: newVal };
      })
    );
  };

  // AI Translation Handler
  const handleTranslate = async (lang: string) => {
    try {
      setTranslating(true);
      setShowTranslateDropdown(false);
      const res = await fetch('/api/translate-captions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, targetLanguage: lang }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        onSegmentsChange(data.segments);
      } else {
        alert(data.error || 'Failed to translate captions');
      }
    } catch (err: any) {
      alert('Error translating captions: ' + err.message);
    } finally {
      setTranslating(false);
    }
  };

  // AI Script Align Handler
  const handleAlignScript = async () => {
    if (!scriptInput.trim()) return;
    try {
      setAligningScript(true);
      const res = await fetch('/api/align-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptInput, duration }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        onSegmentsChange(data.segments);
        setShowScriptAlignModal(false);
        setScriptInput('');
      } else {
        alert(data.error || 'Failed to align script');
      }
    } catch (err: any) {
      alert('Error aligning script: ' + err.message);
    } finally {
      setAligningScript(false);
    }
  };

  // AI Auto-Insert Emojis Based on Sentiment & Context
  const handleAutoInsertEmojis = async (tone = selectedEmojiTone) => {
    if (segments.length === 0) return;
    try {
      setAutoInsertingEmojis(true);
      setShowEmojiToneDropdown(false);
      const res = await fetch('/api/auto-insert-emojis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, tone }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        onSegmentsChange(data.segments);
        if (onStyleChange && style) {
          onStyleChange({ ...style, showEmojis: true });
        }
        const count = data.stats?.totalUpdated || data.segments.length;
        setEmojiToast(`✨ Inserted ${count} context emojis & enabled on video!`);
        setTimeout(() => setEmojiToast(null), 3500);
      } else {
        // Fallback: Assign sentiment emojis locally if server error
        const fallbackSegments = segments.map((s) => {
          const t = (s.text || '').toLowerCase();
          let em = '✨';
          if (/stop|never|wait|warning|don't/i.test(t)) em = '🛑';
          else if (/secret|trick|hack|key|nobody/i.test(t)) em = '🤫';
          else if (/fire|viral|crazy|insane|explode/i.test(t)) em = '🔥';
          else if (/money|views|results|rich|revenue|grow/i.test(t)) em = '💰';
          else if (/ai|tech|algorithm|robot|code/i.test(t)) em = '🤖';
          else if (/first|seconds|fast|speed/i.test(t)) em = '⚡';
          else if (/win|champion|leader|best/i.test(t)) em = '🏆';
          else if (/workout|gym|fitness|discipline/i.test(t)) em = '💪';
          else if (/free|try|click|below|link/i.test(t)) em = '👇';
          return { ...s, emoji: em };
        });
        onSegmentsChange(fallbackSegments);
        if (onStyleChange && style) {
          onStyleChange({ ...style, showEmojis: true });
        }
        setEmojiToast(`✨ Inserted ${fallbackSegments.length} context emojis & enabled on video!`);
        setTimeout(() => setEmojiToast(null), 3500);
      }
    } catch (err: any) {
      console.warn('Emoji auto-insert fallback:', err);
      const fallbackSegments = segments.map((s) => ({ ...s, emoji: s.emoji || '✨' }));
      onSegmentsChange(fallbackSegments);
      if (onStyleChange && style) {
        onStyleChange({ ...style, showEmojis: true });
      }
      setEmojiToast('✨ Context emojis active and enabled on video!');
      setTimeout(() => setEmojiToast(null), 3500);
    } finally {
      setAutoInsertingEmojis(false);
    }
  };

  // Re-sync all captions to 1-second natural spoken lines
  const handleRechunkTo1Second = () => {
    if (segments.length === 0) return;
    const rechunked = formatSegmentsTo1SecondPacing(segments);
    onSegmentsChange(rechunked);
    setEmojiToast(`⚡ Re-synced ${rechunked.length} chunks to 1-second spoken lines!`);
    setTimeout(() => setEmojiToast(null), 3500);
  };

  // AI Auto-Detect High-Impact Keyword Highlights
  const handleDetectHighlights = async (intensity = highlightIntensity) => {
    if (segments.length === 0) return;
    try {
      setDetectingHighlights(true);
      setShowHighlightDropdown(false);
      const res = await fetch('/api/detect-highlights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments, intensity }),
      });
      const data = await res.json();
      if (data.success && data.segments) {
        onSegmentsChange(data.segments);
        const count = data.totalHighlightedWords || 0;
        setEmojiToast(`⚡ Highlighted ${count} viral keywords with Gemini AI!`);
        setTimeout(() => setEmojiToast(null), 3500);
      } else {
        alert(data.error || 'Failed to detect keyword highlights');
      }
    } catch (err: any) {
      alert('Error detecting highlights: ' + err.message);
    } finally {
      setDetectingHighlights(false);
    }
  };

  // SRT file import
  const handleSRTUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseSRT(text);
      if (parsed.length > 0) {
        onSegmentsChange(parsed);
      } else {
        alert('Could not parse subtitles from this SRT file.');
      }
    };
    reader.readAsText(file);
  };

  const languages = [
    'Spanish',
    'French',
    'German',
    'Japanese',
    'Portuguese',
    'Hindi',
    'Italian',
    'Korean',
    'Arabic',
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header Bar */}
      <div className="p-3.5 border-b border-zinc-800 bg-zinc-950/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-400" />
          <h3 className="font-bold text-zinc-100 text-sm">Subtitle Timeline</h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono">
            {segments.length} chunks
          </span>
        </div>

        {/* AI Action Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* 1s Line Pacing Button */}
          <button
            onClick={handleRechunkTo1Second}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-all shadow-sm"
            title="Automatically format captions to natural ~1-second spoken lines"
          >
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>1s Line Pacing</span>
          </button>

          {/* AI Auto-Insert Emojis Menu */}
          <div className="relative inline-flex items-center">
            <div className="inline-flex rounded-lg bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 overflow-hidden shadow-sm">
              <button
                onClick={() => handleAutoInsertEmojis(selectedEmojiTone)}
                disabled={autoInsertingEmojis}
                className="flex items-center gap-1.5 px-2.5 py-1.5 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 text-xs font-bold transition-all disabled:opacity-50"
                title="Automatically analyze sentiment and insert emojis on all captions (activates on video)"
              >
                <Sparkles className={`w-3.5 h-3.5 text-amber-400 ${autoInsertingEmojis ? 'animate-spin' : ''}`} />
                <span>{autoInsertingEmojis ? 'Analyzing...' : 'AI Emojis'}</span>
              </button>
              <button
                onClick={() => setShowEmojiToneDropdown(!showEmojiToneDropdown)}
                disabled={autoInsertingEmojis}
                className="px-1.5 py-1.5 hover:bg-amber-500/20 border-l border-amber-500/30 text-amber-400 transition-colors"
                title="Select Emoji Tone / Mood"
              >
                <ChevronDown className="w-3 h-3 text-amber-400/80" />
              </button>
            </div>

            {showEmojiToneDropdown && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Sentiment & Tone Style
                </div>
                {[
                  { id: 'viral', label: 'Viral / Hype 🔥', desc: 'High energy, punchy & scroll-stopping' },
                  { id: 'inspirational', label: 'Motivation / Fitness 💪', desc: 'Discipline, triumph & drive' },
                  { id: 'humorous', label: 'Humorous / Relatable 😂', desc: 'Fun, witty & expressive' },
                  { id: 'tech', label: 'Tech / Smart 🤖', desc: 'Insightful, futuristic & clean' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedEmojiTone(t.id as any);
                      handleAutoInsertEmojis(t.id as any);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-xs text-zinc-200 transition-colors"
                  >
                    <div className="font-semibold text-zinc-100">{t.label}</div>
                    <div className="text-[10px] text-zinc-400">{t.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Highlights Menu */}
          <div className="relative">
            <button
              onClick={() => setShowHighlightDropdown(!showHighlightDropdown)}
              disabled={detectingHighlights}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-amber-500/20 hover:from-yellow-500/30 hover:to-amber-500/30 text-yellow-300 border border-yellow-500/30 text-xs font-bold transition-all disabled:opacity-50"
              title="Detect and highlight high-impact keywords with Gemini AI"
            >
              <Zap className={`w-3.5 h-3.5 text-yellow-400 ${detectingHighlights ? 'animate-spin' : ''}`} />
              <span>{detectingHighlights ? 'Detecting...' : 'AI Highlights'}</span>
              <ChevronDown className="w-3 h-3 text-yellow-400/80" />
            </button>

            {showHighlightDropdown && (
              <div className="absolute right-0 mt-1 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Highlighting Intensity
                </div>
                {[
                  { id: 'viral_high', label: 'Viral Punch 🔥', desc: 'Highlights 2-3 power words per chunk' },
                  { id: 'balanced', label: 'Balanced ✨', desc: 'Highlights 1-2 core keywords per chunk' },
                  { id: 'subtle', label: 'Minimalist ⚡', desc: 'Highlights top 1 word per chunk' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setHighlightIntensity(item.id as any);
                      handleDetectHighlights(item.id as any);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-zinc-800 text-xs text-zinc-200 transition-colors"
                  >
                    <div className="font-semibold text-zinc-100">{item.label}</div>
                    <div className="text-[10px] text-zinc-400">{item.desc}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Translate Menu */}
          <div className="relative">
            <button
              onClick={() => setShowTranslateDropdown(!showTranslateDropdown)}
              disabled={translating}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors disabled:opacity-50"
              title="Translate all captions with AI"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span>{translating ? 'Translating...' : 'Translate'}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showTranslateDropdown && (
              <div className="absolute right-0 mt-1 w-40 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-1 z-50">
                <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 uppercase">
                  Select Target Language
                </div>
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => handleTranslate(lang)}
                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-indigo-600 hover:text-white transition-colors"
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* AI Script Aligner */}
          <button
            onClick={() => setShowScriptAlignModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
            title="Paste full script to auto-generate timings"
          >
            <Wand2 className="w-3.5 h-3.5 text-amber-400" />
            <span>Align Script</span>
          </button>

          {/* Import SRT */}
          <label className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs cursor-pointer transition-colors" title="Import .SRT file">
            <UploadCloud className="w-3.5 h-3.5" />
            <input
              type="file"
              accept=".srt"
              onChange={handleSRTUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Emoji Toast Banner */}
      {emojiToast && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 border-b border-amber-500/30 px-3.5 py-2 text-xs font-semibold text-amber-300 flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{emojiToast}</span>
          </div>
          <button
            onClick={() => setEmojiToast(null)}
            className="text-amber-400/80 hover:text-white text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-3.5 py-2 border-b border-zinc-800/80 bg-zinc-900/50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search in subtitles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {/* Segments List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {segments.length === 0 ? (
          <div className="text-center py-12 px-4 flex flex-col items-center justify-center text-zinc-500 text-xs">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 mb-3">
              <Layers className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="font-bold text-zinc-300 text-sm mb-1">No Captions Yet</p>
            <p className="text-zinc-500 text-xs max-w-xs mb-4">
              Add your first subtitle line or import an .SRT file.
            </p>
            <button
              onClick={() => addSegment(-1)}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Caption Line</span>
            </button>
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 text-xs">
            No subtitles found matching "{searchQuery}"
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isActive = seg.id === activeSegmentId;
            return (
              <div
                key={seg.id}
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                    : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900/60'
                }`}
              >
                {/* Segment Meta Row: Time, Nudge, Jump, Delete */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onSeek(seg.start)}
                      className="flex items-center gap-1.5 font-mono text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Jump video to this subtitle"
                    >
                      <Clock className="w-3 h-3" />
                      <span>
                        {formatDisplayTime(seg.start, true)} - {formatDisplayTime(seg.end, true)}
                      </span>
                    </button>
                    <span
                      className="px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/20"
                      title="Chunk duration in seconds"
                    >
                      {Math.max(0.1, seg.end - seg.start).toFixed(1)}s
                    </span>
                  </div>

                  {/* Nudge Controls */}
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <span className="text-[10px] text-zinc-400">Start:</span>
                    <button
                      onClick={() => nudgeTime(seg.id, 'start', -0.1)}
                      className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      title="-0.1s"
                    >
                      -
                    </button>
                    <button
                      onClick={() => nudgeTime(seg.id, 'start', 0.1)}
                      className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      title="+0.1s"
                    >
                      +
                    </button>

                    <span className="text-[10px] text-zinc-400 ml-1">End:</span>
                    <button
                      onClick={() => nudgeTime(seg.id, 'end', -0.1)}
                      className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      title="-0.1s"
                    >
                      -
                    </button>
                    <button
                      onClick={() => nudgeTime(seg.id, 'end', 0.1)}
                      className="px-1 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      title="+0.1s"
                    >
                      +
                    </button>

                    <button
                      onClick={() => deleteSegment(seg.id)}
                      className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-1"
                      title="Delete subtitle chunk"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Subtitle Input & Emoji with Sentiment Context */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex flex-col items-center">
                    <input
                      type="text"
                      value={seg.emoji || '✨'}
                      onChange={(e) => updateSegment(seg.id, { emoji: e.target.value })}
                      className="w-9 h-9 text-center bg-zinc-900 border border-zinc-800 rounded-lg text-lg focus:outline-none focus:border-indigo-500 transition-colors"
                      title={
                        seg.contextReasoning
                          ? `AI Sentiment: ${seg.sentiment || 'Contextual'} (${seg.contextReasoning})`
                          : 'Change Emoji'
                      }
                    />
                    {seg.sentiment && (
                      <span
                        className="text-[8px] font-bold uppercase tracking-wider text-amber-400/90 mt-0.5 truncate max-w-[42px] text-center"
                        title={`Reasoning: ${seg.contextReasoning || seg.sentiment}`}
                      >
                        {seg.sentiment}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={seg.text}
                      onChange={(e) => updateSegment(seg.id, { text: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-100 focus:outline-none focus:border-indigo-500"
                    />
                    {seg.contextReasoning && (
                      <div className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1 font-medium">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>AI Context: {seg.contextReasoning}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Word Highlighting Pills */}
                <div>
                  <div className="text-[10px] text-zinc-400 mb-1 flex items-center justify-between">
                    <span>Click word to toggle viral highlight:</span>
                    {isActive && (
                      <span className="text-indigo-400 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping" />
                        Now Speaking
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {seg.words.map((w, wIdx) => {
                      const isHigh = w.isHighlighted;
                      return (
                        <button
                          key={`${w.word}-${wIdx}`}
                          onClick={() => toggleWordHighlight(seg.id, wIdx)}
                          className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                            isHigh
                              ? 'bg-amber-400 text-black shadow-sm scale-105 ring-1 ring-amber-300'
                              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                          }`}
                          title={isHigh ? 'Remove Highlight' : 'Make Highlight Word'}
                        >
                          {w.word}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Split, Merge & Add Segment Below Controls */}
                <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => splitSegment(seg.id)}
                      disabled={(seg.words?.length || seg.text.split(/\s+/).filter(Boolean).length) < 2}
                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-amber-400 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                      title="Split this caption into two separate timed segments"
                    >
                      <Scissors className="w-3 h-3" />
                      <span>Split</span>
                    </button>
                    {idx < filteredSegments.length - 1 && (
                      <button
                        onClick={() => mergeWithNext(seg.id)}
                        className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-400 transition-colors"
                        title="Merge this caption with the next segment"
                      >
                        <Merge className="w-3 h-3" />
                        <span>Merge next</span>
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => addSegment(idx)}
                    className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-indigo-400 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add chunk below</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: AI Script Aligner */}
      {showScriptAlignModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center gap-2 mb-2">
              <Wand2 className="w-5 h-5 text-indigo-400" />
              <h3 className="font-bold text-white text-base">AI Script to Timed Subtitles</h3>
            </div>
            <p className="text-xs text-zinc-400 mb-4">
              Paste your spoken video script or teleprompter text. AI will segment it into viral, punchy chunks distributed across your video's {Math.round(duration)} seconds.
            </p>

            <textarea
              rows={6}
              value={scriptInput}
              onChange={(e) => setScriptInput(e.target.value)}
              placeholder="Paste script here... (e.g. Stop making boring videos. The first three seconds are everything. Watch your retention explode!)"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowScriptAlignModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAlignScript}
                disabled={aligningScript || !scriptInput.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/30"
              >
                {aligningScript ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Timings...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Generate Aligned Subtitles</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
