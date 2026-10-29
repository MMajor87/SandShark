import { uploadImage } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTrpcError, UploadPurpose } from '@sharkord/shared';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export type TPickedImage = {
  fileId: string;
  previewUrl: string;
};

// uploads to the temporary store only, the settings form commits the id when it saves
const usePickImage = (purpose: UploadPurpose = UploadPurpose.MESSAGE) => {
  const { t } = useTranslation('common');
  const openFilePicker = useFilePicker();

  return useCallback(async (): Promise<TPickedImage | undefined> => {
    try {
      const [file] = await openFilePicker('image/*');

      if (!file) return;

      const temporaryFile = await uploadImage(file, purpose);

      if (!temporaryFile) return;

      return {
        fileId: temporaryFile.id,
        previewUrl: URL.createObjectURL(file)
      };
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUploadImage')));
    }
  }, [openFilePicker, purpose, t]);
};

export { usePickImage };
