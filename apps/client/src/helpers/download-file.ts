import type { TFile } from '@sharkord/shared';
import { getFileUrl } from './get-file-url';
import { isDesktopClient } from '@/platform/environment';

const downloadFile = async (file: TFile) => {
  const fileUrl = getFileUrl(file);

  if (!fileUrl) {
    console.error('Failed to get file URL.');
    return;
  }

  if (isDesktopClient() && window.sandSharkDesktop) {
    await window.sandSharkDesktop.downloadFile({
      url: fileUrl,
      filename: file.originalName
    });
    return;
  }

  const response = await fetch(fileUrl);

  if (!response.ok) {
    console.error(`Failed to download file: ${response.statusText}`);
    return;
  }

  const link = document.createElement('a');

  link.href = URL.createObjectURL(await response.blob());
  link.download = file.originalName;

  link.click();
  URL.revokeObjectURL(link.href);
};

export { downloadFile };
