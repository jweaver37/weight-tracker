// Choosing a recipe photo. Photos are shrunk (longest side 1024 px, JPEG) so a 4 MB phone picture
// becomes roughly 100–200 KB — small enough to keep in the recipe, in backups and in shared files.
import { pickFile } from './files.js';

const MAX_SIDE = 1024;
const QUALITY = 0.82;

// Only image data URLs we made (or that match the same formats) are accepted, e.g. from shared files.
export const isRecipeImage = (value) =>
  typeof value === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) && value.length < 3_000_000;

async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to <img> decoding (older Safari).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Resolves a small JPEG data URL, or null if no photo was chosen or it couldn't be read.
export async function pickRecipePhoto() {
  const file = await pickFile('image/*');
  if (!file) return null;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', QUALITY);
  } catch (err) {
    console.warn('Could not read the photo', err);
    return null;
  }
}
