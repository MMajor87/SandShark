import { uploadFile } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  HostedBotSourceType,
  type THostedBot
} from '@sandshark/shared';
import { Button, Group, Input } from '@sandshark/ui';
import { Download, GitBranch, Upload } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type THostedSourceProps = {
  hosted: THostedBot;
};

const HostedSource = memo(({ hosted }: THostedSourceProps) => {
  const { t } = useTranslation('settings');
  const openFilePicker = useFilePicker();
  const { botId, source, codeUpdatedAt } = hosted;
  const isGithub = source?.type === HostedBotSourceType.GITHUB;
  const [url, setUrl] = useState(isGithub ? (source.url ?? '') : '');
  const [ref, setRef] = useState(isGithub ? (source.ref ?? '') : '');
  const [busy, setBusy] = useState(false);

  const onUrlChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setUrl(event.target.value),
    []
  );

  const onRefChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setRef(event.target.value),
    []
  );

  const onUpload = useCallback(async () => {
    const [file] = await openFilePicker('.zip');

    if (!file) return;

    setBusy(true);

    try {
      const tempFile = await uploadFile(file);

      if (!tempFile) return;

      const trpc = getTRPCClient();

      await trpc.bots.uploadHostedCode.mutate({ botId, fileId: tempFile.id });
      toast.success(t('hostedCodeUploaded'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUploadHostedCode')));
    } finally {
      setBusy(false);
    }
  }, [botId, openFilePicker, t]);

  const onUpdateFromGithub = useCallback(async () => {
    setBusy(true);

    try {
      const trpc = getTRPCClient();
      const trimmedRef = ref.trim();

      await trpc.bots.setHostedSource.mutate({
        botId,
        url: url.trim(),
        ref: trimmedRef || null
      });
      await trpc.bots.updateHostedCode.mutate({ botId });
      toast.success(t('hostedCodeUpdated'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUpdateHostedCode')));
    } finally {
      setBusy(false);
    }
  }, [botId, url, ref, t]);

  const onInstall = useCallback(async () => {
    try {
      const trpc = getTRPCClient();

      await trpc.bots.installHostedDependencies.mutate({ botId });
      toast.success(t('hostedInstallStarted'));
    } catch (error) {
      toast.error(getTrpcError(error, t('failedInstallHosted')));
    }
  }, [botId, t]);

  let updatedText = t('hostedNoCode');

  if (codeUpdatedAt) {
    updatedText = t('hostedLastUpdated', {
      date: new Date(codeUpdatedAt).toLocaleString()
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex-1 text-sm text-muted-foreground">{updatedText}</p>
        <Button size="sm" variant="outline" onClick={onUpload} disabled={busy}>
          <Upload className="h-4 w-4" />
          {t('hostedUploadZip')}
        </Button>
        <Button size="sm" variant="outline" onClick={onInstall} disabled={busy}>
          <Download className="h-4 w-4" />
          {t('hostedInstall')}
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <Group label={t('hostedGithubUrl')}>
          <Input
            value={url}
            onChange={onUrlChange}
            aria-label={t('hostedGithubUrl')}
            placeholder={t('hostedGithubUrlPlaceholder')}
          />
        </Group>
        <Group label={t('hostedGithubRef')}>
          <Input
            value={ref}
            onChange={onRefChange}
            aria-label={t('hostedGithubRef')}
            placeholder={t('hostedGithubRefPlaceholder')}
          />
        </Group>
        <Button
          size="sm"
          onClick={onUpdateFromGithub}
          disabled={busy || url.trim().length === 0}
        >
          <GitBranch className="h-4 w-4" />
          {t('hostedUpdateFromGithub')}
        </Button>
      </div>
    </div>
  );
});

export { HostedSource };
