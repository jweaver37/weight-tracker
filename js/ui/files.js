// Saving and opening files.
import { h } from './dom.js';

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Resolves the chosen File. (If the picker is cancelled the promise never settles, which is harmless.)
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept });
    input.addEventListener('change', () => resolve(input.files[0] ?? null));
    input.click();
  });
}

// Uses the phone's share sheet when it can share files, otherwise downloads.
// Resolves 'shared', 'downloaded' or 'cancelled'.
export async function shareOrDownload(blob, fileName, { title, text }) {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return 'shared';
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled';
      // Some browsers refuse at the last moment; fall back to a download.
    }
  }
  downloadBlob(blob, fileName);
  return 'downloaded';
}
