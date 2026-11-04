import { getTRPCClient } from '@/lib/trpc';
import {
  getTrpcError,
  HOSTED_BOT_DEFAULT_TOKEN_ENV_NAMES,
  type THostedBot
} from '@sandshark/shared';
import { Badge, Button, Group, IconButton, Input } from '@sandshark/ui';
import { Plus, X } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type TEnvNameProps = {
  botId: number;
  name: string;
  onChanged: () => Promise<void>;
};

const EnvName = memo(({ botId, name, onChanged }: TEnvNameProps) => {
  const { t } = useTranslation('settings');

  const onRemove = useCallback(async () => {
    try {
      const trpc = getTRPCClient();

      await trpc.bots.setHostedEnv.mutate({ botId, name, value: null });
      await onChanged();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUpdateHostedEnv')));
    }
  }, [botId, name, onChanged, t]);

  return (
    <Badge variant="secondary" className="gap-1 pr-1 font-mono">
      {name}
      <IconButton
        icon={X}
        variant="ghost"
        size="sm"
        className="h-4 w-4"
        title={t('hostedEnvRemove', { name })}
        onClick={onRemove}
      />
    </Badge>
  );
});

type THostedEnvProps = {
  hosted: THostedBot;
  onChanged: () => Promise<void>;
};

// values go to the server and never come back, so the list shows names only
const HostedEnv = memo(({ hosted, onChanged }: THostedEnvProps) => {
  const { t } = useTranslation('settings');
  const { botId, envNames, tokenEnvNames } = hosted;
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [tokenNames, setTokenNames] = useState(tokenEnvNames.join(', '));

  const onNameChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value),
    []
  );

  const onValueChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setValue(event.target.value),
    []
  );

  const onTokenNamesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setTokenNames(event.target.value),
    []
  );

  const onAdd = useCallback(async () => {
    try {
      const trpc = getTRPCClient();

      await trpc.bots.setHostedEnv.mutate({ botId, name: name.trim(), value });
      setName('');
      setValue('');
      await onChanged();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUpdateHostedEnv')));
    }
  }, [botId, name, value, onChanged, t]);

  const onSaveTokenNames = useCallback(async () => {
    const names = tokenNames
      .split(',')
      .map((tokenName) => tokenName.trim())
      .filter((tokenName) => tokenName.length > 0);

    try {
      const trpc = getTRPCClient();

      await trpc.bots.setHostedTokenEnvNames.mutate({ botId, names });
      await onChanged();
    } catch (error) {
      toast.error(getTrpcError(error, t('failedUpdateHostedTokenNames')));
    }
  }, [botId, tokenNames, onChanged, t]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('hostedEnvDesc')}</p>
      {envNames.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {envNames.map((envName) => (
            <EnvName
              key={envName}
              botId={botId}
              name={envName}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <Group label={t('hostedEnvName')}>
          <Input
            value={name}
            onChange={onNameChange}
            aria-label={t('hostedEnvName')}
            className="font-mono"
          />
        </Group>
        <Group label={t('hostedEnvValue')}>
          <Input
            type="password"
            value={value}
            onChange={onValueChange}
            aria-label={t('hostedEnvValue')}
          />
        </Group>
        <Button
          size="sm"
          variant="outline"
          onClick={onAdd}
          disabled={name.trim().length === 0}
        >
          <Plus className="h-4 w-4" />
          {t('hostedEnvAdd')}
        </Button>
      </div>
      <Group
        label={t('hostedTokenNames')}
        description={t('hostedTokenNamesDesc', {
          names: HOSTED_BOT_DEFAULT_TOKEN_ENV_NAMES.join(', ')
        })}
      >
        <div className="flex gap-2">
          <Input
            value={tokenNames}
            onChange={onTokenNamesChange}
            aria-label={t('hostedTokenNames')}
            className="font-mono"
          />
          <Button size="sm" variant="outline" onClick={onSaveTokenNames}>
            {t('hostedTokenNamesSave')}
          </Button>
        </div>
      </Group>
    </div>
  );
});

export { HostedEnv };
