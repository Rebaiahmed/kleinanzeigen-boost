/**
 * Downscale + re-encode an image in the browser before uploading. Phone photos
 * are often 5-12 MB; the AI analysis only needs ~1600px, so compressing client-
 * side keeps uploads small (faster, and well under the server/nginx limits) with
 * no meaningful quality loss for ad photos.
 *
 * Falls back to the original file on any error or if compression doesn't help.
 */
export interface CompressOptions {
  maxDim?: number;     // longest edge in px
  quality?: number;    // JPEG quality 0..1
  skipBelowBytes?: number; // leave already-small JPEG/WebP untouched
}

export async function compressImage(file: File, opts: CompressOptions = {}): Promise<File> {
  const maxDim = opts.maxDim ?? 1600;
  const quality = opts.quality ?? 0.82;
  const skipBelowBytes = opts.skipBelowBytes ?? 1.2 * 1024 * 1024;

  // Only handle raster images we can draw to a canvas.
  if (!/^image\/(jpe?g|png|webp)$/i.test(file.type)) return file;
  // Small JPEG/WebP already fine — re-encoding would only add work. (PNGs are
  // always re-encoded to JPEG since they're typically much larger.)
  if (file.size <= skipBelowBytes && !/png/i.test(file.type)) return file;

  try {
    const bitmap = await loadBitmap(file);
    let { width, height } = bitmap;

    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // White matte so transparent PNGs don't turn black when flattened to JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    if ('close' in bitmap) (bitmap as ImageBitmap).close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size >= file.size) return file; // no gain → keep original

    const baseName = file.name.replace(/\.(png|webp|jpe?g)$/i, '') || 'photo';
    return new File([blob], `${baseName}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file; // any decode/encode failure → upload the original
  }
}

/** Decode a file to an ImageBitmap (respecting EXIF orientation) with an
 *  <img>-based fallback for browsers without createImageBitmap options. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
