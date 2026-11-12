import { CaptionSegment, CaptionStyleConfig, DubbingTrack } from '../types';
import { stripEmojis } from './subtitleParsers';

interface RenderProgressCallback {
  (progress: number, currentSeconds: number, totalSeconds: number): void;
}

export async function burnSubtitlesToVideo(
  videoElement: HTMLVideoElement,
  segments: CaptionSegment[],
  style: CaptionStyleConfig,
  onProgress: RenderProgressCallback,
  activeDubbingTrack?: DubbingTrack | null
): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    try {
      const originalTime = videoElement.currentTime;
      const originalMuted = videoElement.muted;
      const originalPlaybackRate = videoElement.playbackRate;

      const duration = videoElement.duration || 10;
      const width = videoElement.videoWidth || 720;
      const height = videoElement.videoHeight || 1280;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas 2D context not available');
      }

      // Capture canvas stream at 30fps
      const canvasStream = canvas.captureStream(30);

      // Extract audio track from video and mix dubbed audio if available
      let combinedStream = canvasStream;
      let audioCtx: AudioContext | null = null;
      const scheduledSources: AudioBufferSourceNode[] = [];

      try {
        const videoStream = (videoElement as any).captureStream
          ? (videoElement as any).captureStream()
          : (videoElement as any).mozCaptureStream?.();

        const videoAudioTrack =
          videoStream && videoStream.getAudioTracks().length > 0
            ? videoStream.getAudioTracks()[0]
            : null;

        if (activeDubbingTrack && activeDubbingTrack.segments.some((s) => s.audioBase64)) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtx = new AudioContextClass();
            if (audioCtx.state === 'suspended') {
              await audioCtx.resume();
            }

            const destinationNode = audioCtx.createMediaStreamDestination();

            // Duck original audio track if present
            if (videoAudioTrack) {
              try {
                const streamSource = audioCtx.createMediaStreamSource(new MediaStream([videoAudioTrack]));
                const duckGain = audioCtx.createGain();
                duckGain.gain.value = activeDubbingTrack.duckOriginalVolume ?? 0.15;
                streamSource.connect(duckGain);
                duckGain.connect(destinationNode);
              } catch (e) {
                console.warn('Could not route video audio through AudioContext:', e);
              }
            }

            // Decode all dubbed segment audio buffers
            const dubbedGain = audioCtx.createGain();
            dubbedGain.gain.value = activeDubbingTrack.dubbedVoiceVolume ?? 1.0;
            dubbedGain.connect(destinationNode);

            const decodedSegments: Array<{ start: number; buffer: AudioBuffer }> = [];
            for (const seg of activeDubbingTrack.segments) {
              if (seg.audioBase64) {
                const buf = await base64ToAudioBuffer(seg.audioBase64, audioCtx);
                if (buf) {
                  decodedSegments.push({ start: seg.start, buffer: buf });
                }
              }
            }

            // Function to schedule dubbed audio sources at video start
            (canvas as any).__scheduleDubbedSpeech = (startPlaybackTime: number) => {
              if (!audioCtx) return;
              for (const seg of decodedSegments) {
                try {
                  const source = audioCtx.createBufferSource();
                  source.buffer = seg.buffer;
                  source.connect(dubbedGain);
                  source.start(startPlaybackTime + seg.start);
                  scheduledSources.push(source);
                } catch (e) {
                  console.warn('Failed to schedule segment audio:', e);
                }
              }
            };

            const mixedAudioTrack = destinationNode.stream.getAudioTracks()[0];
            if (mixedAudioTrack) {
              combinedStream = new MediaStream([
                ...canvasStream.getVideoTracks(),
                mixedAudioTrack,
              ]);
            }
          }
        } else if (videoAudioTrack) {
          combinedStream = new MediaStream([
            ...canvasStream.getVideoTracks(),
            videoAudioTrack,
          ]);
        }
      } catch (e) {
        console.warn('Audio capture/mixing from video element unavailable or restricted:', e);
      }

      // Determine supported mimeType
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/mp4')
        ? 'video/mp4'
        : 'video/webm';

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 4500000, // 4.5 Mbps high quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        // Clean up scheduled sources & audio context
        scheduledSources.forEach((s) => {
          try {
            s.stop();
          } catch {}
        });
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => {});
        }

        const finalBlob = new Blob(chunks, { type: mimeType });
        // Restore video state
        videoElement.currentTime = originalTime;
        videoElement.muted = originalMuted;
        videoElement.playbackRate = originalPlaybackRate;
        resolve(finalBlob);
      };

      recorder.start();

      // Ensure video is at 0
      videoElement.pause();
      videoElement.playbackRate = 1.0;
      videoElement.muted = true; // Avoid autoplay restrictions; audio is captured via stream/AudioContext

      await new Promise<void>((r) => {
        let finished = false;
        const finish = () => {
          if (!finished) {
            finished = true;
            videoElement.removeEventListener('seeked', onSeeked);
            r();
          }
        };
        const onSeeked = () => finish();
        videoElement.addEventListener('seeked', onSeeked);
        videoElement.currentTime = 0;
        setTimeout(finish, 600); // 600ms safety timeout if seeked does not fire
      });

      try {
        await videoElement.play();
      } catch (playErr) {
        console.warn('Playback error during capture, retrying muted:', playErr);
        videoElement.muted = true;
        await videoElement.play().catch(() => {});
      }

      if ((canvas as any).__scheduleDubbedSpeech && audioCtx) {
        (canvas as any).__scheduleDubbedSpeech(audioCtx.currentTime);
      }

      let animationFrameId: number;

      const renderLoop = () => {
        const currentTime = videoElement.currentTime;

        if (videoElement.paused || videoElement.ended || currentTime >= duration - 0.05) {
          cancelAnimationFrame(animationFrameId);
          onProgress(100, duration, duration);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          return;
        }

        // Draw current video frame to canvas
        ctx.drawImage(videoElement, 0, 0, width, height);

        // Render caption overlay for current time
        drawCaptionFrame(ctx, width, height, currentTime, segments, style);

        // Report progress
        const percent = Math.min(99, Math.round((currentTime / duration) * 100));
        onProgress(percent, currentTime, duration);

        animationFrameId = requestAnimationFrame(renderLoop);
      };

      animationFrameId = requestAnimationFrame(renderLoop);
    } catch (err) {
      reject(err);
    }
  });
}

async function base64ToAudioBuffer(base64: string, audioCtx: AudioContext): Promise<AudioBuffer | null> {
  try {
    const cleanBase64 = base64.replace(/^data:audio\/\w+;base64,/, '');
    const binary = atob(cleanBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return await audioCtx.decodeAudioData(bytes.buffer.slice(0));
  } catch (err) {
    console.warn('Failed to decode segment audio buffer:', err);
    return null;
  }
}

function drawCaptionFrame(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  segments: CaptionSegment[],
  style: CaptionStyleConfig
) {
  // Calibrated effective playback time
  const effectiveTime = Math.max(0, currentTime + (style.syncOffset || 0));

  // Find segment strictly matching effective spoken dialogue window
  const currentSeg = segments.find((s) => {
    const words = s.words && s.words.length > 0 ? s.words : null;
    const firstStart = words ? words[0].start : s.start;
    const lastEnd = words ? words[words.length - 1].end : s.end;
    return effectiveTime >= firstStart && effectiveTime <= lastEnd + 0.15;
  });
  if (!currentSeg) return;

  const isRemovingEmojis = style.removeEmojis === true;
  const showEmoji = !isRemovingEmojis && (style.showEmojis ?? true) && !!currentSeg.emoji;

  const rawWordList =
    currentSeg.words && currentSeg.words.length > 0
      ? currentSeg.words
      : currentSeg.text.split(/\s+/).filter(Boolean).map((w, i, arr) => {
          const dur = Math.max(0.1, currentSeg.end - currentSeg.start);
          return {
            word: w,
            start: currentSeg.start + (i / arr.length) * dur,
            end: currentSeg.start + ((i + 1) / arr.length) * dur,
            isHighlighted: false,
          };
        });

  const activeWords = rawWordList
    .map((w) => ({
      ...w,
      word: isRemovingEmojis ? stripEmojis(w.word) : w.word,
    }))
    .filter((w) => w.word.trim().length > 0);

  if (activeWords.length === 0) return;

  // Scale font size proportionally to video height (relative to base 720p)
  const scale = canvasHeight / 720;
  const scaledFontSize = Math.round(style.fontSize * scale);
  const fontWeight = style.isBold === false ? '600' : style.fontFamily === 'Inter' ? '800' : '900';
  const fontStyle = style.isItalic ? 'italic' : 'normal';
  ctx.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px "${style.fontFamily}", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const speedMultiplier = style.animationSpeed ?? 1.0;
  const spaceGap = (style.wordSpacing ?? 8) * scale;
  const maxPerLine = Math.max(1, style.wordsPerLine || 4);

  // Prepare words with active state and kinetic animation visibility
  const preparedWords = activeWords.map((w) => {
    let rawText = w.word;
    if (style.casing === 'uppercase') rawText = rawText.toUpperCase();
    if (style.casing === 'lowercase') rawText = rawText.toLowerCase();

    const isCurrent = effectiveTime >= w.start && effectiveTime <= w.end;
    const isPast = effectiveTime > w.end;
    const isFuture = effectiveTime < w.start;
    const wordDur = Math.max(0.08, w.end - w.start);
    const wordProgress = isCurrent
      ? Math.min(1, Math.max(0, ((effectiveTime - w.start) / wordDur) * speedMultiplier))
      : isPast
      ? 1
      : 0;

    let text = rawText;
    let hidden = false;

    // In kinetic modes, never render future words before voice starts
    if (style.animation === 'typewriter') {
      if (isFuture) {
        hidden = true;
      } else if (isCurrent) {
        const charCount = Math.max(1, Math.ceil(wordProgress * rawText.length));
        text = rawText.slice(0, charCount);
      }
    } else if (['popup', 'bounce', 'slide', 'fade'].includes(style.animation) && isFuture) {
      hidden = true;
    }

    const isHighlighted =
      w.isHighlighted ||
      (currentSeg.highlightedWords &&
        currentSeg.highlightedWords.includes(w.word.toUpperCase().replace(/[^A-Z0-9]/g, '')));

    return {
      text,
      isCurrent,
      isPast,
      isFuture,
      wordProgress,
      isHighlighted,
      hidden,
    };
  });

  // Group into lines according to wordsPerLine
  const lines: Array<typeof preparedWords> = [];
  for (let i = 0; i < preparedWords.length; i += maxPerLine) {
    lines.push(preparedWords.slice(i, i + maxPerLine));
  }

  const lineHeight = scaledFontSize * (style.lineHeight || 1.25);
  const totalLinesHeight = lines.length * lineHeight;
  const basePosY = (style.verticalPosition / 100) * canvasHeight;

  // Measure maximum line width for background box
  let maxLineWidth = 0;
  const lineWidths: number[] = [];

  lines.forEach((line, lIdx) => {
    let wSum = 0;
    if (lIdx === 0 && showEmoji) {
      wSum += ctx.measureText(`${currentSeg.emoji} `).width;
    }
    const visibleWords = line.filter((item) => !item.hidden);
    visibleWords.forEach((w, idx) => {
      wSum += ctx.measureText(w.text).width;
      if (idx < visibleWords.length - 1) wSum += spaceGap;
    });
    lineWidths.push(wSum);
    if (wSum > maxLineWidth) maxLineWidth = wSum;
  });

  // If no words are visible yet (silence or awaiting first vocalization), don't draw anything
  if (maxLineWidth === 0) return;

  const paddingX = 24 * scale;
  const paddingY = 14 * scale;
  const boxWidth = maxLineWidth + paddingX * 2;
  const boxHeight = totalLinesHeight + paddingY * 1.5;

  const align = style.textAlign || 'center';
  const boxX =
    align === 'left'
      ? 36 * scale
      : align === 'right'
      ? canvasWidth - boxWidth - 36 * scale
      : (canvasWidth - boxWidth) / 2;
  const boxY = basePosY - boxHeight / 2;

  // Background rendering: Only if user explicitly enabled Caption Container Background
  if (style.containerBgEnabled && (style.bgType === 'box' || style.bgType === 'pill' || style.bgType === 'outline')) {
    ctx.save();
    const radius = style.bgType === 'pill' ? Math.min(boxHeight / 2, 32 * scale) : 12 * scale;
    drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
    if (style.bgType !== 'outline') {
      ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity);
      ctx.fill();
    } else {
      ctx.fillStyle = hexToRgba(style.bgColor, style.bgOpacity * 0.6);
      ctx.fill();
      ctx.strokeStyle = style.highlightColor;
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
    }
    ctx.restore();
  }

  // Render each line and word
  lines.forEach((line, lIdx) => {
    const lineY =
      basePosY - totalLinesHeight / 2 + lIdx * lineHeight + lineHeight / 2;
    const lineW = lineWidths[lIdx];

    let currentX =
      align === 'left'
        ? boxX + paddingX
        : align === 'right'
        ? boxX + boxWidth - paddingX - lineW
        : (canvasWidth - lineW) / 2;

    if (lIdx === 0 && showEmoji) {
      const emojiStr = `${currentSeg.emoji} `;
      const ew = ctx.measureText(emojiStr).width;
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(emojiStr, currentX + ew / 2, lineY);
      ctx.restore();
      currentX += ew;
    }

    for (const w of line) {
      if (w.hidden) continue;

      const wordWidth = ctx.measureText(w.text).width;
      const wordCenterX = currentX + wordWidth / 2;

      ctx.save();

      // Compute animation transform & alpha matching CaptionOverlay
      let scaleFactor = 1.0;
      let offsetY = 0;
      let alpha = 1.0;

      switch (style.animation) {
        case 'popup':
          if (w.isCurrent) {
            scaleFactor = 1.2;
            offsetY = -3 * scale;
          } else if (w.isHighlighted) {
            scaleFactor = 1.06;
          }
          break;
        case 'bounce':
          if (w.isCurrent) {
            scaleFactor = 1.24;
            offsetY = -5 * scale;
          } else if (w.isHighlighted) {
            scaleFactor = 1.06;
          }
          break;
        case 'karaoke':
          if (w.isCurrent) {
            scaleFactor = 1.15;
            offsetY = -2 * scale;
          } else if (w.isFuture) {
            alpha = 0.35;
          }
          break;
        case 'slide':
          if (w.isCurrent) {
            offsetY = -3 * scale;
            scaleFactor = 1.12;
          }
          break;
        case 'fade':
          if (w.isCurrent) {
            alpha = Math.min(1, 0.45 + w.wordProgress * 0.55);
            scaleFactor = 1.08;
          }
          break;
        case 'typewriter':
          if (w.isCurrent) {
            scaleFactor = 1.05;
          }
          break;
        default:
          break;
      }

      ctx.globalAlpha = alpha;
      ctx.translate(wordCenterX, lineY + offsetY);
      ctx.scale(scaleFactor, scaleFactor);
      ctx.translate(-wordCenterX, -(lineY + offsetY));

      // Active word background pill if enabled
      if (w.isCurrent && style.showActiveWordBg) {
        ctx.save();
        ctx.fillStyle = style.activeWordBgColor || '#6366F1';
        const pillPadX = 8 * scale;
        const pillPadY = 4 * scale;
        drawRoundedRect(
          ctx,
          wordCenterX - wordWidth / 2 - pillPadX,
          lineY + offsetY - scaledFontSize / 2 - pillPadY,
          wordWidth + pillPadX * 2,
          scaledFontSize + pillPadY * 2,
          8 * scale
        );
        ctx.fill();
        ctx.restore();
      }

      // Determine word color
      let fill = style.textColor;
      if (w.isCurrent) {
        fill = style.activeWordColor;
      } else if (w.isHighlighted) {
        fill = style.highlightColor;
      } else if (style.animation === 'karaoke' && w.isFuture) {
        fill = 'rgba(255, 255, 255, 0.35)';
      }

      // Shadow
      if (style.shadowBlur > 0) {
        ctx.shadowColor = style.shadowColor;
        ctx.shadowBlur = style.shadowBlur * scale;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2 * scale;
      }

      // Stroke
      if (style.strokeWidth > 0) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth * scale * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(w.text, wordCenterX, lineY + offsetY);
      }

      // Fill
      ctx.fillStyle = fill;
      ctx.fillText(w.text, wordCenterX, lineY + offsetY);

      ctx.restore();

      currentX += wordWidth + spaceGap;
    }
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map((char) => char + char).join('');
  }
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
