import { getTRPCClient } from '@/lib/trpc';
import { getTrpcError, type TJoinedUser } from '@sharkord/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Group,
  Input
} from '@sharkord/ui';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TDialogBaseProps } from '../types';

type TResetUserPasswordDialogProps = TDialogBaseProps & {
  user: TJoinedUser;
};

const ResetUserPasswordDialog = memo(
  ({ isOpen, close, user }: TResetUserPasswordDialogProps) => {
    const { t } = useTranslation('dialogs');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [isResetting, setIsResetting] = useState(false);

    const onSubmit = useCallback(async () => {
      const trpc = getTRPCClient();

      try {
        setIsResetting(true);
        await trpc.users.resetPassword.mutate({
          userId: user.id,
          newPassword,
          confirmNewPassword
        });

        toast.success(t('resetUserPasswordSuccess', { name: user.name }));
        close();
      } catch (error) {
        toast.error(getTrpcError(error, t('resetUserPasswordFailed')));
      } finally {
        setIsResetting(false);
      }
    }, [close, confirmNewPassword, newPassword, t, user.id, user.name]);

    const passwordsMatch = newPassword === confirmNewPassword;

    return (
      <AlertDialog open={isOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('resetUserPasswordTitle', { name: user.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('resetUserPasswordDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            <Group label={t('newPasswordLabel')}>
              <Input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
              />
            </Group>
            <Group label={t('confirmNewPasswordLabel')}>
              <Input
                type="password"
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                autoComplete="new-password"
                error={
                  confirmNewPassword && !passwordsMatch
                    ? t('passwordsDoNotMatch')
                    : undefined
                }
              />
            </Group>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={close}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={onSubmit}
              disabled={
                isResetting ||
                newPassword.length < 4 ||
                confirmNewPassword.length < 4 ||
                !passwordsMatch
              }
            >
              {t('resetUserPasswordBtn')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

export { ResetUserPasswordDialog };
