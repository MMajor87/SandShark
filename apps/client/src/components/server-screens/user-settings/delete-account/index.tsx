import { SettingsSection } from '@/components/server-screens/settings-shell/section';
import { requestConfirmation } from '@/features/dialogs/actions';
import {
  useOwnUserHasRole,
  useOwnUserPasswordSet
} from '@/features/server/users/hooks';
import { getUrlFromServer } from '@/helpers/get-file-url';
import { suppressOidcAutoRedirect } from '@/helpers/oidc';
import { cleanup, getTRPCClient } from '@/lib/trpc';
import { OWNER_ROLE_ID, getTrpcError } from '@sharkord/shared';
import { Button, Group, Input, Switch } from '@sharkord/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

const DeleteAccount = memo(() => {
  const { t } = useTranslation('settings');
  const hasPassword = useOwnUserPasswordSet();
  const isOwner = useOwnUserHasRole(OWNER_ROLE_ID);
  const [password, setPassword] = useState('');
  const [wipe, setWipe] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const onPasswordChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(event.target.value);
    },
    []
  );
  const onWipeChange = useCallback((value: boolean) => setWipe(value), []);

  const onDelete = useCallback(async () => {
    const confirmed = await requestConfirmation({
      title: t('deleteAccountTab'),
      message: wipe
        ? t('deleteAccountWipeMessage')
        : t('deleteAccountKeepMessage'),
      confirmLabel: t('deleteAccountButton'),
      variant: 'danger'
    });

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const trpc = getTRPCClient();

      if (hasPassword) {
        await trpc.users.deleteOwn.mutate({ password, wipe });
        cleanup();
      } else {
        const intent = await trpc.users.beginOidcDelete.mutate({ wipe });

        suppressOidcAutoRedirect();

        if (window.sandSharkDesktop) {
          const result = await window.sandSharkDesktop.startOidcLogin(
            getUrlFromServer(),
            undefined,
            intent
          );

          if (result === 'deleted') cleanup();
        } else {
          const url = new URL('/oidc/login', getUrlFromServer());

          url.searchParams.set('delete_intent', intent);
          window.location.assign(url.href);
        }
      }
    } catch (error) {
      toast.error(getTrpcError(error, t('failedDeleteAccount')));
    } finally {
      setIsDeleting(false);
    }
  }, [hasPassword, password, t, wipe]);

  return (
    <SettingsSection
      title={t('deleteAccountTab')}
      description={t('deleteAccountDescription')}
    >
      {isOwner ? (
        <p>{t('deleteAccountOwner')}</p>
      ) : (
        <>
          {hasPassword && (
            <Group label={t('currentPasswordLabel')}>
              <Input
                type="password"
                value={password}
                onChange={onPasswordChange}
                autoComplete="current-password"
              />
            </Group>
          )}
          {!hasPassword && <p>{t('deleteAccountSso')}</p>}
          <Group
            label={t('deleteAccountWipeLabel')}
            description={t('deleteAccountWipeDescription')}
          >
            <Switch checked={wipe} onCheckedChange={onWipeChange} />
          </Group>
          <Button
            variant="destructive"
            onClick={onDelete}
            disabled={isDeleting || (hasPassword && !password)}
          >
            {t('deleteAccountButton')}
          </Button>
        </>
      )}
    </SettingsSection>
  );
});

export { DeleteAccount };
