import { useEffect, useState } from 'react';
import { loadDraftPhotos } from '../lib/draftPhotoStore';

/** Loads a draft's first photo from IndexedDB and returns an object URL for
 *  display. Returns null while loading or if the draft has no stored photos. */
export function useDraftThumbnail(draftId: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    loadDraftPhotos(draftId).then((files) => {
      if (cancelled || files.length === 0) return;
      objectUrl = URL.createObjectURL(files[0]);
      setUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [draftId]);

  return url;
}
