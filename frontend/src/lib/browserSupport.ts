/**
 * The AnzeigenBoost extension is distributed via the Chrome Web Store and only
 * runs in Chromium-based browsers (Chrome, Edge, Brave, Opera, Arc). Firefox and
 * Safari can't run it, so we warn those users that the connect/repost features
 * won't work there.
 */
export interface BrowserSupport {
  supported: boolean;
  name: string;
}

export function detectBrowserSupport(): BrowserSupport {
  if (typeof navigator === 'undefined') return { supported: true, name: 'Browser' };
  const ua = navigator.userAgent;

  const isFirefox = /firefox|fxios/i.test(ua);
  // Safari = has "Safari" but none of the Chromium/Chrome markers.
  const isSafari = /safari/i.test(ua) && !/chrome|chromium|crios|edg|opr|android/i.test(ua);

  if (isFirefox) return { supported: false, name: 'Firefox' };
  if (isSafari) return { supported: false, name: 'Safari' };

  // Everything Chromium-based supports the extension.
  return { supported: true, name: 'Browser' };
}
