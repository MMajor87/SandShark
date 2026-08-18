import { isDesktopClient } from '@/platform/environment';
import { memo, useEffect } from 'react';
import { toast } from 'sonner';

const getProgressLabel = (receivedBytes: number, totalBytes: number) => {
  if (totalBytes <= 0) return 'Downloading file...';

  return `Downloading file... ${Math.min(
    100,
    Math.round((receivedBytes / totalBytes) * 100)
  )}%`;
};

const DesktopDownloadController = memo(() => {
  useEffect(() => {
    if (!isDesktopClient() || !window.sandSharkDesktop) return;

    const desktopApi = window.sandSharkDesktop;

    return desktopApi.onDownloadProgress((progress) => {
      const toastId = `desktop-download-${progress.id}`;

      if (progress.state === 'progressing') {
        toast.loading(
          getProgressLabel(progress.receivedBytes, progress.totalBytes),
          {
            id: toastId,
            description: progress.filename
          }
        );
        return;
      }

      if (progress.state === 'completed') {
        toast.success('Download complete', {
          id: toastId,
          description: progress.filename,
          action: {
            label: 'Open',
            onClick: () => void desktopApi.openDownloadedFile(progress.id)
          },
          cancel: {
            label: 'Show',
            onClick: () => void desktopApi.showDownloadedFile(progress.id)
          }
        });
        return;
      }

      toast.error(
        progress.state === 'cancelled'
          ? 'Download cancelled'
          : 'Download interrupted',
        { id: toastId, description: progress.filename }
      );
    });
  }, []);

  return null;
});

DesktopDownloadController.displayName = 'DesktopDownloadController';

export { DesktopDownloadController };
