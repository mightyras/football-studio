const MAX_LOGO_SIZE = 128; // px
const MAX_DATA_URL_LENGTH = 50_000; // ~50KB base64 limit for localStorage safety
const QUALITY = 0.85;

/**
 * Resize and compress an uploaded image file to a base64 data URL.
 * - Validates image type
 * - Resizes to max 128×128 preserving aspect ratio
 * - Tries PNG first (transparency), falls back to JPEG if too large
 * - Rejects if result still exceeds ~50KB
 */
export function resizeAndCompressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Resize preserving aspect ratio
        if (width > MAX_LOGO_SIZE || height > MAX_LOGO_SIZE) {
          if (width > height) {
            height = Math.round(height * (MAX_LOGO_SIZE / width));
            width = MAX_LOGO_SIZE;
          } else {
            width = Math.round(width * (MAX_LOGO_SIZE / height));
            height = MAX_LOGO_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        // Try PNG first (preserves transparency)
        let dataUrl = canvas.toDataURL('image/png');
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          // Fall back to JPEG for smaller size
          dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        }
        if (dataUrl.length > MAX_DATA_URL_LENGTH) {
          reject(new Error('Image too large even after compression'));
          return;
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
