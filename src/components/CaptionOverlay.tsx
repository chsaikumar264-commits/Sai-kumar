import React, { useMemo } from 'react';
import { CaptionSegment, CaptionStyleConfig, WordTimestamp } from '../types';
import { stripEmojis } from '../utils/subtitleParsers';

interface CaptionOverlayProps {
  currentTime: number;
  segments: CaptionSegment[];
  style: CaptionStyleConfig;
  isPlaying?: boolean;
  videoWidth?: number;
  videoHeight?: number;
}

export const CaptionOverlay: React.FC<CaptionOverlayProps> = React.memo(({
  currentTime,
  segments,
  style,
  isPlaying = false,
}) => {
  // Calibrated effective playback time incorporating optional sync offset calibration
  const effectiveTime = Math.max(0, currentTime + (style.syncOffset || 0));

  // Find currently active spoken segment:
  // When video is playing: strictly synchronize with actual speech timestamps.
  // When video is paused (e.g. seeking or editing styles): show the segment at currentTime
  // or the first/nearest segment so user can see their edits in real-time.
  const activeSegment = useMemo(() => {
    if (!segments || segments.length === 0) return null;

    if (isPlaying) {
      for (const seg of segments) {
        const words = seg.words && seg.words.length > 0 ? seg.words : null;
        const firstStart = words ? Math.min(seg.start, words[0].start) : seg.start;
        const lastEnd = words ? Math.max(seg.end, words[words.length - 1].end) : seg.end;

        if (effectiveTime >= firstStart - 0.05 && effectiveTime <= lastEnd + 0.15) {
          return seg;
        }
      }
      return null;
    }

    // When paused:
    // 1. Check exact match within [start, end]
    const exact = segments.find((s) => effectiveTime >= s.start && effectiveTime <= s.end);
    if (exact) return exact;

    // 2. If at start of video (e.g. 0.0s), show first segment so styles are immediately previewable
    if (effectiveTime <= (segments[0].start || 0)) {
      return segments[0];
    }

    // 3. Otherwise find closest segment to currentTime
    let closest = segments[0];
    let minDiff = Infinity;
    for (const seg of segments) {
      const diff = Math.min(Math.abs(effectiveTime - seg.start), Math.abs(effectiveTime - seg.end));
      if (diff < minDiff) {
        minDiff = diff;
        closest = seg;
      }
    }
    return closest;
  }, [segments, effectiveTime, isPlaying]);

  // Stroke CSS text-shadow simulation for crisp rendering across all browsers
  const strokeShadow = useMemo(() => {
    if (!style.strokeWidth || style.strokeWidth <= 0) return 'none';
    const w = style.strokeWidth;
    const c = style.strokeColor;
    return `
      -${w}px -${w}px 0 ${c},
       ${w}px -${w}px 0 ${c},
      -${w}px  ${w}px 0 ${c},
       ${w}px  ${w}px 0 ${c},
       0px -${w}px 0 ${c},
       0px  ${w}px 0 ${c},
      -${w}px  0px 0 ${c},
       ${w}px  0px 0 ${c}
    `;
  }, [style.strokeWidth, style.strokeColor]);

  // Compute words and group into lines by style.wordsPerLine
  const wordLines = useMemo(() => {
    if (!activeSegment) return [];
    const isRemovingEmojis = style.removeEmojis === true;

    const rawWords: WordTimestamp[] =
      activeSegment.words && activeSegment.words.length > 0
        ? activeSegment.words.map((w) => ({
            ...w,
            word: isRemovingEmojis ? stripEmojis(w.word) : w.word,
          })).filter((w) => w.word.trim().length > 0)
        : activeSegment.text.split(/\s+/).filter(Boolean).map((w, idx, arr) => {
            const clean = isRemovingEmojis ? stripEmojis(w) : w;
            const dur = Math.max(0.1, activeSegment.end - activeSegment.start);
            return {
              word: clean,
              start: activeSegment.start + (idx / arr.length) * dur,
              end: activeSegment.start + ((idx + 1) / arr.length) * dur,
              isHighlighted: false,
            };
          }).filter((w) => w.word.trim().length > 0);

    const maxPerLine = Math.max(1, style.wordsPerLine || 4);
    const lines: Array<Array<{ wordObj: WordTimestamp; globalIndex: number }>> = [];
    for (let i = 0; i < rawWords.length; i += maxPerLine) {
      lines.push(
        rawWords.slice(i, i + maxPerLine).map((wordObj, idx) => ({
          wordObj,
          globalIndex: i + idx,
        }))
      );
    }
    return lines;
  }, [activeSegment, style.wordsPerLine, style.removeEmojis]);

  if (!activeSegment || wordLines.length === 0) return null;

  // Glow shadow
  const glowShadow =
    style.shadowBlur > 0 ? `0 2px ${style.shadowBlur}px ${style.shadowColor}` : 'none';

  const combinedShadow =
    strokeShadow !== 'none'
      ? glowShadow !== 'none'
        ? `${strokeShadow}, ${glowShadow}`
        : strokeShadow
      : glowShadow;

  const speedMultiplier = style.animationSpeed ?? 1.0;
  const transitionMs = Math.max(35, Math.round(95 / speedMultiplier));
  const wordGapPx = style.wordSpacing ?? 8;
  const textAlign = style.textAlign || 'center';
  const fontWeight = style.isBold === false ? 600 : 900;
  const fontStyle = style.isItalic ? 'italic' : 'normal';

  const justifyClass =
    textAlign === 'left'
      ? 'justify-start'
      : textAlign === 'right'
      ? 'justify-end'
      : 'justify-center';

  // Emoji display condition: only if removeEmojis is NOT active, showEmojis is enabled, and emoji exists
  const showEmoji =
    !style.removeEmojis && (style.showEmojis ?? true) && !!activeSegment.emoji;

  return (
    <div
      className={`absolute inset-x-0 pointer-events-none flex ${justifyClass} items-center px-4 z-30 select-none transition-all duration-75`}
      style={{
        top: `${style.verticalPosition}%`,
        transform: 'translateY(-50%)',
      }}
    >
      <div
        className={`inline-flex flex-col ${
          textAlign === 'left'
            ? 'items-start'
            : textAlign === 'right'
            ? 'items-end'
            : 'items-center'
        } gap-y-1.5 max-w-[94%] transition-all duration-150 ${
          style.containerBgEnabled
            ? style.bgType === 'pill'
              ? 'px-5 py-2.5 rounded-3xl backdrop-blur-md'
              : style.bgType === 'box'
              ? 'px-4 py-2 rounded-xl'
              : style.bgType === 'outline'
              ? 'px-4 py-2 rounded-xl border-2'
              : 'px-4 py-2 rounded-lg'
            : 'px-1 py-0.5'
        }`}
        style={{
          backgroundColor:
            style.containerBgEnabled && style.bgType !== 'none'
              ? `${style.bgColor}${Math.round(style.bgOpacity * 255)
                  .toString(16)
                  .padStart(2, '0')}`
              : 'transparent',
          borderColor:
            style.containerBgEnabled && style.bgType === 'outline'
              ? style.highlightColor
              : 'transparent',
          boxShadow:
            style.containerBgEnabled && style.bgType !== 'none'
              ? '0 10px 25px -5px rgba(0,0,0,0.5)'
              : undefined,
        }}
      >
        {wordLines.map((line, lineIdx) => (
          <div
            key={`line-${lineIdx}`}
            className={`flex flex-wrap items-center ${justifyClass}`}
            style={{ columnGap: `${wordGapPx}px`, rowGap: '4px' }}
          >
            {/* Animated Emoji on first line (strictly hidden if Remove Emojis is toggled) */}
            {lineIdx === 0 && showEmoji && (
              <span
                className="text-2xl sm:text-3xl mr-1 transform transition-transform duration-200 animate-bounce inline-block"
                style={{ animationDuration: `${Math.round(1200 / speedMultiplier)}ms` }}
              >
                {activeSegment.emoji}
              </span>
            )}

            {/* Word-by-word kinetic rendering */}
            {line.map(({ wordObj: w, globalIndex }) => {
              // Word is actively spoken only between its spoken start and end
              const isSpoken = isPlaying
                ? effectiveTime >= w.start && effectiveTime <= w.end
                : true;
              const isPast = isPlaying ? effectiveTime > w.end : false;
              const isFuture = isPlaying
                ? effectiveTime < w.start && (globalIndex > 0 || effectiveTime < (activeSegment.start - 0.05))
                : false;
              const wordDuration = Math.max(0.08, w.end - w.start);
              const wordProgress = isSpoken
                ? Math.min(1, Math.max(0, ((effectiveTime - w.start) / wordDuration) * speedMultiplier))
                : isPast
                ? 1
                : 0;

              const isHighlighted =
                w.isHighlighted ||
                (activeSegment.highlightedWords &&
                  activeSegment.highlightedWords.includes(
                    w.word.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  ));

              // Casing
              let rawText = w.word;
              if (style.casing === 'uppercase') rawText = rawText.toUpperCase();
              if (style.casing === 'lowercase') rawText = rawText.toLowerCase();

              // Typewriter progressive character reveal
              let displayWord = rawText;
              if (style.animation === 'typewriter') {
                if (isFuture) {
                  return null;
                } else if (isSpoken) {
                  const charCount = Math.max(1, Math.ceil(wordProgress * rawText.length));
                  displayWord = rawText.slice(0, charCount);
                }
              }

              // Determine word color
              let color = style.textColor;
              if (isSpoken) {
                color = style.activeWordColor;
              } else if (isHighlighted) {
                color = style.highlightColor;
              } else if (style.animation === 'karaoke' && isFuture) {
                color = 'rgba(255, 255, 255, 0.32)';
              }

              // Kinetic Transform & Opacity:
              // Crucial fix: in kinetic word modes, words that have NOT yet been spoken (isFuture)
              // must never be displayed early before the speaker's voice!
              let transformStyle = 'scale(1) translateY(0px)';
              let opacity = 1;

              switch (style.animation) {
                case 'popup':
                  if (isFuture) {
                    opacity = 0;
                    transformStyle = 'scale(0.35) translateY(8px)';
                  } else if (isSpoken) {
                    opacity = 1;
                    transformStyle = 'scale(1.2) translateY(-3px)';
                  } else {
                    opacity = 1;
                    transformStyle = isHighlighted ? 'scale(1.06)' : 'scale(1)';
                  }
                  break;

                case 'bounce':
                  if (isFuture) {
                    opacity = 0;
                    transformStyle = 'scale(0.4) translateY(6px)';
                  } else if (isSpoken) {
                    opacity = 1;
                    transformStyle = 'scale(1.24) translateY(-5px)';
                  } else {
                    opacity = 1;
                    transformStyle = isHighlighted ? 'scale(1.06) translateY(0px)' : 'scale(1)';
                  }
                  break;

                case 'karaoke':
                  if (isFuture) {
                    opacity = 0.35;
                    transformStyle = 'scale(0.98)';
                  } else if (isSpoken) {
                    opacity = 1;
                    transformStyle = 'scale(1.15) translateY(-2px)';
                  } else {
                    opacity = 1;
                    transformStyle = 'scale(1)';
                  }
                  break;

                case 'slide':
                  if (isFuture) {
                    opacity = 0;
                    transformStyle = 'translateY(12px) scale(0.9)';
                  } else if (isSpoken) {
                    opacity = 1;
                    transformStyle = 'translateY(-3px) scale(1.12)';
                  } else {
                    opacity = 1;
                    transformStyle = 'translateY(0px) scale(1)';
                  }
                  break;

                case 'fade':
                  if (isFuture) {
                    opacity = 0;
                    transformStyle = 'scale(0.95)';
                  } else if (isSpoken) {
                    opacity = Math.min(1, 0.45 + wordProgress * 0.55);
                    transformStyle = 'scale(1.08)';
                  } else {
                    opacity = 1;
                    transformStyle = 'scale(1)';
                  }
                  break;

                case 'typewriter':
                  if (isSpoken) {
                    transformStyle = 'scale(1.05)';
                  }
                  break;

                default:
                  // Static mode: all words in active line visible
                  break;
              }

              const showWordBg = isSpoken && style.showActiveWordBg;

              return (
                <span
                  key={`${w.word}-${globalIndex}`}
                  className={`inline-block tracking-tight ${
                    showWordBg ? 'px-2 py-0.5 rounded-lg shadow-md' : ''
                  }`}
                  style={{
                    fontFamily: `"${style.fontFamily}", sans-serif`,
                    fontSize: `${style.fontSize}px`,
                    fontWeight,
                    fontStyle,
                    color,
                    backgroundColor: showWordBg
                      ? style.activeWordBgColor || '#6366F1'
                      : 'transparent',
                    textShadow: combinedShadow,
                    letterSpacing: `${style.letterSpacing}px`,
                    transform: transformStyle,
                    opacity,
                    lineHeight: style.lineHeight || 1.15,
                    transition: `transform ${transitionMs}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${transitionMs}ms ease, color ${transitionMs}ms ease`,
                  }}
                >
                  {displayWord}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});
