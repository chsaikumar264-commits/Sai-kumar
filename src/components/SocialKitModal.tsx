import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  X,
  Share2,
  Hash,
  MessageSquare,
  Flame,
  ArrowRight,
  TrendingUp,
  Video,
  FileText,
  Search,
  Globe,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { SocialKitData } from '../types';

interface SocialKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcript: string;
}

export const SocialKitModal: React.FC<SocialKitModalProps> = ({
  isOpen,
  onClose,
  transcript,
}) => {
  const [loading, setLoading] = useState(false);
  const [socialData, setSocialData] = useState<SocialKitData | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'instagram' | 'youtube' | 'seo' | 'strategy'>('all');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/generate-social-kit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSocialData(data.data);
      } else {
        throw new Error(data.error || 'Failed to generate social assets');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const igCaption = socialData?.instagramCaption || socialData?.caption || '';
  const ytTitles = socialData?.youtubeTitles && socialData.youtubeTitles.length > 0
    ? socialData.youtubeTitles
    : socialData?.titles || [];
  const ytDescription = socialData?.videoDescription || `${igCaption}\n\n#Viral #ContentCreation`;
  const seoKeywords = socialData?.seoKeywords || [
    'video editing',
    'viral captions',
    'youtube shorts',
    'instagram reels',
    'tiktok growth',
    'hook doctor',
    'auto dubbing',
  ];

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base">Viral Social Kit Generator</h3>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  AI Distribution
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Instagram captions, YouTube titles & descriptions, SEO tags & viral hashtags
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

        {/* Filter Navigation Tabs when data is available */}
        {socialData && (
          <div className="flex border-b border-zinc-800 bg-zinc-950/50 p-1.5 gap-1 text-xs font-semibold overflow-x-auto shrink-0">
            {[
              { id: 'all', label: 'All Assets' },
              { id: 'instagram', label: 'Instagram Caption' },
              { id: 'youtube', label: 'YouTube Titles & Info' },
              { id: 'seo', label: 'SEO & Hashtags' },
              { id: 'strategy', label: 'Platform Strategy' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as any)}
                className={`py-1.5 px-3 rounded-lg transition-all whitespace-nowrap ${
                  activeTab === t.id
                    ? 'bg-zinc-800 text-white font-bold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {!socialData && !loading && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="font-bold text-white text-base mb-1">
                  Ready to turn this video into a viral distribution campaign?
                </h4>
                <p className="text-xs text-zinc-400">
                  Gemini AI will analyze your video's transcript and generate ready-to-publish Instagram captions,
                  high-CTR YouTube titles, SEO keywords, hashtags, and platform-specific growth advice.
                </p>
              </div>
              <button
                onClick={handleGenerate}
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 mx-auto"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Viral Kit</span>
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin mx-auto" />
              <div className="text-sm font-bold text-white">Analyzing viral video angles...</div>
              <div className="text-xs text-zinc-400">Engineering hooks, SEO keywords, and social captions</div>
            </div>
          )}

          {socialData && (
            <div className="space-y-6">
              {/* Instagram Caption */}
              {(activeTab === 'all' || activeTab === 'instagram') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4" />
                      <span>Instagram Post Caption</span>
                    </h4>
                    <button
                      onClick={() => copyToClipboard(igCaption, 'ig-caption')}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                    >
                      {copiedKey === 'ig-caption' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'ig-caption' ? 'Copied!' : 'Copy Caption'}</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 whitespace-pre-line leading-relaxed font-sans">
                    {igCaption}
                  </div>
                </div>
              )}

              {/* YouTube Titles */}
              {(activeTab === 'all' || activeTab === 'youtube') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                      <Video className="w-4 h-4" />
                      <span>YouTube Titles (High CTR, Under 60 Chars)</span>
                    </h4>
                    <button
                      onClick={() => copyToClipboard(ytTitles.join('\n'), 'yt-titles-all')}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                    >
                      {copiedKey === 'yt-titles-all' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'yt-titles-all' ? 'Copied!' : 'Copy All'}</span>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {ytTitles.map((titleText, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between gap-3 group hover:border-red-500/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-red-500/10 text-red-400 text-xs font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-semibold text-zinc-200">{titleText}</span>
                        </div>
                        <button
                          onClick={() => copyToClipboard(titleText, `yt-title-${idx}`)}
                          className="text-zinc-500 hover:text-white p-1 rounded transition-colors shrink-0"
                          title="Copy title"
                        >
                          {copiedKey === `yt-title-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* YouTube Video Description */}
              {(activeTab === 'all' || activeTab === 'youtube') && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      <span>Video Description (YouTube / Reels / Shorts)</span>
                    </h4>
                    <button
                      onClick={() => copyToClipboard(ytDescription, 'yt-desc')}
                      className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                    >
                      {copiedKey === 'yt-desc' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedKey === 'yt-desc' ? 'Copied!' : 'Copy Description'}</span>
                    </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-line leading-relaxed font-mono">
                    {ytDescription}
                  </div>
                </div>
              )}

              {/* SEO Keywords & Viral Hashtags */}
              {(activeTab === 'all' || activeTab === 'seo') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* SEO Keywords */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                        <Search className="w-4 h-4" />
                        <span>SEO Search Keywords</span>
                      </h4>
                      <button
                        onClick={() => copyToClipboard(seoKeywords.join(', '), 'seo-keywords')}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'seo-keywords' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'seo-keywords' ? 'Copied!' : 'Copy Tags'}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                      {seoKeywords.map((kw, i) => (
                        <span
                          key={i}
                          onClick={() => copyToClipboard(kw, `kw-${i}`)}
                          className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 text-xs font-medium cursor-pointer transition-colors"
                          title="Click to copy"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Viral Hashtags */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                        <Hash className="w-4 h-4" />
                        <span>Viral Hashtags</span>
                      </h4>
                      <button
                        onClick={() => copyToClipboard(socialData.hashtags.join(' '), 'hashtags')}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white"
                      >
                        {copiedKey === 'hashtags' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedKey === 'hashtags' ? 'Copied!' : 'Copy All'}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-3 rounded-2xl bg-zinc-950 border border-zinc-800">
                      {socialData.hashtags.map((tag, i) => (
                        <span
                          key={i}
                          onClick={() => copyToClipboard(tag, `tag-${i}`)}
                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 text-xs font-mono cursor-pointer transition-colors"
                          title="Click to copy"
                        >
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Platform-Specific Strategy Recommendations */}
              {(activeTab === 'all' || activeTab === 'strategy') && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    <span>Platform-Specific Optimization Strategy</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(socialData.platformSuggestions || [
                      {
                        platform: 'Instagram',
                        advice: 'Use the spaced caption format with strong call-to-action in first 120 characters before "...more".',
                      },
                      {
                        platform: 'TikTok',
                        advice: 'Keep text on screen within vertical safe zones (top 15% to bottom 25%).',
                      },
                      {
                        platform: 'YouTube Shorts',
                        advice: 'Pair with high-CTR title and loop the last 2 seconds seamlessly to double average watch time.',
                      },
                      {
                        platform: 'LinkedIn',
                        advice: 'Lead with a contrarian take and prompt a professional discussion in the comments.',
                      },
                    ]).map((strat, i) => (
                      <div
                        key={i}
                        className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1"
                      >
                        <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                          {strat.platform}
                        </span>
                        <p className="text-xs text-zinc-300 leading-relaxed">{strat.advice}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Refresh */}
              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleGenerate}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate Assets</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
