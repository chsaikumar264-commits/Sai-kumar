import React, { useRef } from 'react';
import {
  Sparkles,
  Download,
  Video,
  Wand2,
  Zap,
  Flame,
  HelpCircle,
  Mic,
  Globe,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  videoTitle: string;
  onOpenUploader: () => void;
  onOpenExport: () => void;
  onOpenSocialKit: () => void;
  onOpenHookDoctor: () => void;
  onOpenVoiceCloning: () => void;
  onOpenAutoDubbing: () => void;
  onSelectVideoFile?: (file: File) => void;
}

export const Header: React.FC<HeaderProps> = ({
  videoTitle,
  onOpenUploader,
  onOpenExport,
  onOpenSocialKit,
  onOpenHookDoctor,
  onOpenVoiceCloning,
  onOpenAutoDubbing,
  onSelectVideoFile,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onSelectVideoFile) {
      onSelectVideoFile(file);
    }
    e.target.value = '';
  };

  const handleImportClick = () => {
    // Open the full Import modal containing browse button, drag & drop, and preview
    onOpenUploader();
  };
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Left: Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-amber-400 p-0.5 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-indigo-400 fill-indigo-400/30" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-white text-base tracking-tight">Captio<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">AI</span></span>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 tracking-wider">
                  STUDIO
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 font-medium truncate max-w-[180px] sm:max-w-xs">
                {videoTitle}
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right: Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Hidden File Input for Direct Native File Dialog */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mp4,.mov,.mkv,.webm,.avi,video/mp4,video/quicktime,video/x-matroska,video/webm,video/x-msvideo"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Import / Change Video Button Group */}
          <div className="flex items-center rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-300 hover:text-white transition-all shadow-sm">
            <button
              onClick={handleImportClick}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold hover:bg-indigo-600/20 rounded-l-xl transition-colors cursor-pointer"
              title="Open file selection dialog from your computer (MP4, MOV, MKV, WEBM, AVI)"
            >
              <Video className="w-3.5 h-3.5 text-indigo-400" />
              <span>Import Video</span>
            </button>
            <button
              onClick={onOpenUploader}
              className="px-1.5 py-2 hover:bg-indigo-600/20 border-l border-indigo-500/20 rounded-r-xl text-zinc-400 hover:text-indigo-200 transition-colors cursor-pointer"
              title="More import options: Web URL, Camera recording, or Templates"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>

          {/* Voice Cloning Studio */}
          <button
            onClick={onOpenVoiceCloning}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Create and manage your AI voice profiles with real voice cloning"
          >
            <Mic className="w-3.5 h-3.5 text-pink-400" />
            <span className="hidden sm:inline">Voice Cloning</span>
          </button>

          {/* Multilingual Auto Dubbing */}
          <button
            onClick={onOpenAutoDubbing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Translate & auto-dub into English, Hindi, Kannada, & Telugu"
          >
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Auto Dubbing</span>
          </button>

          {/* Hook Doctor */}
          <button
            onClick={onOpenHookDoctor}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Analyze retention of your first 3 seconds"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline">Hook Doctor</span>
          </button>

          {/* Social Kit */}
          <button
            onClick={onOpenSocialKit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all shadow-sm"
            title="Generate viral hooks and post captions"
          >
            <Flame className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline">Viral Social Kit</span>
          </button>

          {/* Export & Burn Button */}
          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all transform hover:scale-105 active:scale-95"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export & Burn</span>
          </button>
        </div>
      </div>
    </header>
  );
};
