import { CaptionSegment } from '../types';

export interface UploadOptions {
  action?: 'save' | 'transcribe' | 'transcode';
  language?: string;
  onProgress?: (percent: number, message: string) => void;
  signal?: AbortSignal;
}

export interface UploadResult {
  success: boolean;
  filename: string;
  streamUrl: string;
  fileSize: number;
  duration: number;
  width?: number;
  height?: number;
  segments?: CaptionSegment[];
  transcript?: string;
  detectedLanguage?: string;
  error?: string;
}

const CHUNK_SIZE = 8 * 1024 * 1024; // 8MB per chunk (safely under Cloud Run 32MB limit)

/**
 * Resilient video uploader supporting both single binary upload (small files)
 * and auto-chunked upload (large files) with full error diagnosis.
 */
export async function uploadVideoFile(
  file: File | Blob,
  fileName: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const { action = 'save', language = 'Auto-detect', onProgress, signal } = options;
  const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'video.mp4';
  const fileSize = file.size;

  // Check backend server reachability first if needed
  const checkHealth = async (): Promise<boolean> => {
    try {
      const hRes = await fetch('/api/health', { signal });
      return hRes.ok;
    } catch {
      return false;
    }
  };

  // If file is 20MB or smaller, attempt single fast binary upload
  if (fileSize <= 20 * 1024 * 1024) {
    onProgress?.(15, `Preparing ${(fileSize / (1024 * 1024)).toFixed(1)} MB video...`);

    try {
      const buffer = await file.arrayBuffer();
      onProgress?.(35, action === 'transcribe' ? 'Uploading & transcribing video...' : 'Uploading video to server...');

      const res = await fetch('/api/video/binary-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'x-filename': encodeURIComponent(cleanName),
          'x-action': action,
          'x-language': encodeURIComponent(language),
        },
        body: buffer,
        signal,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const serverError = errJson?.error || `HTTP ${res.status} (${res.statusText || 'Server Error'})`;
        throw new Error(serverError);
      }

      const data = await res.json();
      onProgress?.(100, 'Video ready!');
      return data;
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;

      // If single upload failed with Failed to fetch, check if chunking helps
      console.warn('[videoUploaderClient] Direct binary upload failed, attempting chunked upload fallback:', err.message);
      const isOnline = await checkHealth();
      if (!isOnline) {
        throw new Error('Render server is currently unreachable. Please check your internet connection or reload the application.');
      }
      // Fall through to chunked upload
    }
  }

  // Chunked upload for files > 20MB or as fallback
  const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  onProgress?.(5, `Uploading ${(fileSize / (1024 * 1024)).toFixed(1)} MB in ${totalChunks} chunks...`);

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(fileSize, start + CHUNK_SIZE);
    const chunkBlob = file.slice(start, end);
    const chunkBuffer = await chunkBlob.arrayBuffer();

    const percent = Math.min(95, Math.round(((chunkIndex + 0.5) / totalChunks) * 85));
    onProgress?.(percent, `Uploading chunk ${chunkIndex + 1}/${totalChunks} (${((end - start) / (1024 * 1024)).toFixed(1)} MB)...`);

    let retries = 2;
    let success = false;
    let lastError: any = null;

    while (retries >= 0 && !success) {
      try {
        const res = await fetch('/api/video/chunk-upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/octet-stream',
            'x-upload-id': uploadId,
            'x-chunk-index': String(chunkIndex),
            'x-total-chunks': String(totalChunks),
            'x-filename': encodeURIComponent(cleanName),
            'x-action': action,
            'x-language': encodeURIComponent(language),
          },
          body: chunkBuffer,
          signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          throw new Error(errJson?.error || `Chunk ${chunkIndex + 1} failed: HTTP ${res.status}`);
        }

        const data = await res.json();
        // If this was the last chunk, it returns the final completed UploadResult
        if (chunkIndex === totalChunks - 1) {
          onProgress?.(100, action === 'transcribe' ? 'Transcription complete!' : 'Video upload complete!');
          return data;
        }

        success = true;
      } catch (chunkErr: any) {
        if (chunkErr.name === 'AbortError') throw chunkErr;
        lastError = chunkErr;
        retries--;
        if (retries >= 0) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
    }

    if (!success) {
      const isOnline = await checkHealth();
      const diagnostic = isOnline
        ? `Chunk ${chunkIndex + 1} of ${totalChunks} failed: ${lastError?.message || 'Network disconnected'}`
        : 'Render server is offline or unreachable. Please check connection.';
      throw new Error(`Upload aborted: ${diagnostic}`);
    }
  }

  throw new Error('Chunked upload completed without server response.');
}
