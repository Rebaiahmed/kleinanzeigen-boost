/** Photo upload limits for AI photo analysis. Shared by the interceptor and
 *  the global exception filter so the enforced limit and the error message
 *  never drift apart. */
export const MAX_PHOTOS = 8;
export const MAX_PHOTO_SIZE_MB = 4;
export const MAX_PHOTO_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
