/**
 * Extracts audio track from a video file using browser Web Audio API
 * and converts to a base64 encoded audio/wav payload for Gemini transcription.
 */

export async function extractAudioFromVideo(
  videoFile: File | Blob
): Promise<{ base64Audio: string; mimeType: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000, // 16kHz is optimal for speech models
      });

      const arrayBuffer = await videoFile.arrayBuffer();

      // Decode audio data from video
      let audioBuffer: AudioBuffer;
      try {
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      } catch (decodeErr) {
        // Fallback: If decodeAudioData fails directly on the container, try MediaElement extraction
        try {
          const fallbackData = await extractViaMediaRecorder(videoFile);
          return resolve(fallbackData);
        } catch (mediaErr) {
          throw new Error('Could not extract audio track from this video file. Ensure the video contains audio.');
        }
      }

      // Convert audio buffer to 16kHz mono WAV
      const wavBlob = audioBufferToWav(audioBuffer);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        resolve({
          base64Audio: base64String,
          mimeType: 'audio/wav',
        });
      };
      reader.onerror = () => reject(new Error('Failed to read extracted audio as base64'));
      reader.readAsDataURL(wavBlob);
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Fallback audio extractor using video element playback and captureStream
 */
function extractViaMediaRecorder(file: File | Blob): Promise<{ base64Audio: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.muted = true;

    video.onloadedmetadata = async () => {
      try {
        const stream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream?.();
        if (!stream) {
          return reject(new Error('Stream capture not supported'));
        }

        const audioTrack = stream.getAudioTracks()[0];
        if (!audioTrack) {
          return reject(new Error('No audio track detected in video file.'));
        }

        const audioStream = new MediaStream([audioTrack]);
        const recorder = new MediaRecorder(audioStream, { mimeType: 'audio/webm' });
        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            resolve({
              base64Audio: reader.result as string,
              mimeType: 'audio/webm',
            });
          };
          reader.readAsDataURL(blob);
          URL.revokeObjectURL(video.src);
        };

        recorder.start();
        video.muted = false;
        video.volume = 0.001; // barely audible to allow decoding
        await video.play();

        // Sample up to 60 seconds
        const recordDuration = Math.min(60, video.duration || 15) * 1000;
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
            video.pause();
          }
        }, recordDuration);
      } catch (err) {
        URL.revokeObjectURL(video.src);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video element for audio extraction'));
    };
  });
}

/**
 * Convert an AudioBuffer to a standard 16-bit mono WAV Blob
 */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  // We'll downmix to mono for speech transcription
  const numOfChan = 1;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let samples: Float32Array;
  if (buffer.numberOfChannels === 1) {
    samples = buffer.getChannelData(0);
  } else {
    // Average left and right channels to mono
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.getChannelData(1);
    samples = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
      samples[i] = (ch0[i] + ch1[i]) / 2;
    }
  }

  // Cap audio samples to 90 seconds max to keep payload lean and speed up transcription
  const maxSamples = sampleRate * 90;
  if (samples.length > maxSamples) {
    samples = samples.subarray(0, maxSamples);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChan * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  // Write WAV RIFF Header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numOfChan, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    // Scale to 16-bit signed integer
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
