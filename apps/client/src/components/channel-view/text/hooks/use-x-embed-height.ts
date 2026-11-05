import { useEffect, useState, type RefObject } from 'react';
import { getXEmbedHeight, X_EMBED_ORIGIN } from '../helpers';

// the height x's embed reports for its post, so the iframe fits it with no scrollbar. every x
// embed in the page posts to the same window, so a message only counts when it comes from this
// iframe. undefined until the embed has reported
const useXEmbedHeight = (iframeRef: RefObject<HTMLIFrameElement | null>) => {
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== X_EMBED_ORIGIN) return;

      const iframe = iframeRef.current;

      if (!iframe || event.source !== iframe.contentWindow) return;

      const reported = getXEmbedHeight(event.data);

      if (reported !== undefined) setHeight(reported);
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [iframeRef]);

  return height;
};

export { useXEmbedHeight };
