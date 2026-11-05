import { Alert, AlertDescription, AlertTitle } from '@sandshark/ui';
import { Container } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

const IMAGE = 'ghcr.io/mmajor87/sandshark-server';

type TDockerNotesProps = {
  version: string | null;
};

const DockerNotes = memo(({ version }: TDockerNotesProps) => {
  const { t } = useTranslation('settings');

  return (
    <Alert>
      <Container />
      <AlertTitle>{t('dockerUpdatesTitle')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <p>{t('dockerUpdatesDesc')}</p>
        <p>{t('dockerManualUpdateDesc')}</p>
        <pre className="rounded bg-muted px-2 py-1 font-mono text-xs whitespace-pre-wrap break-all">
          docker pull {IMAGE}:{version || '<version>'}
        </pre>
      </AlertDescription>
    </Alert>
  );
});

export { DockerNotes };
