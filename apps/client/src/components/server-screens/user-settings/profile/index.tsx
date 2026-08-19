import { closeServerScreens } from '@/features/server-screens/actions';
import { updateUser } from '@/features/server/users/actions';
import { useOwnPublicUser } from '@/features/server/users/hooks';
import { getFileUrl } from '@/helpers/get-file-url';
import { useForm } from '@/hooks/use-form';
import { getTRPCClient } from '@/lib/trpc';
import { DEFAULT_PROFILE_COLOR, getTrpcError } from '@sharkord/shared';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ColorPicker,
  Group,
  ImageSwatchPicker,
  Input,
  Textarea
} from '@sharkord/ui';
import { memo, useCallback, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AvatarManager } from './avatar-manager';
import { BannerManager } from './banner-manager';

const Profile = memo(() => {
  const { t } = useTranslation('settings');
  const ownPublicUser = useOwnPublicUser();
  const [saving, setSaving] = useState(false);
  const legacyBannerColor = (
    ownPublicUser as
      | (typeof ownPublicUser & { bannerColor?: unknown })
      | undefined
  )?.bannerColor;
  const { setTrpcErrors, r, values, onChange } = useForm({
    name: ownPublicUser?.name ?? '',
    profileColor: ownPublicUser?.profileColor ?? DEFAULT_PROFILE_COLOR,
    bio: ownPublicUser?.bio ?? '',
    // Older Sharkord servers require this legacy field even though SandShark
    // now uses profileColor. Newer servers ignore it.
    bannerColor:
      typeof legacyBannerColor === 'string' ? legacyBannerColor : '#FFFFFF'
  });

  const handleColorChange = useCallback(
    (color: string) => {
      onChange('profileColor', color);
    },
    [onChange]
  );

  const onUpdateUser = useCallback(async () => {
    if (saving || !ownPublicUser) return;

    setSaving(true);
    const trpc = getTRPCClient();

    try {
      const updatedUser = (await trpc.users.update.mutate(values)) as unknown;
      if (
        updatedUser &&
        typeof updatedUser === 'object' &&
        'id' in updatedUser &&
        typeof updatedUser.id === 'number'
      ) {
        updateUser(
          updatedUser.id,
          updatedUser as Partial<NonNullable<typeof ownPublicUser>>
        );
      } else {
        // Older Sharkord servers apply the update but return no user payload.
        // Keep the current profile in sync until its normal event arrives.
        updateUser(ownPublicUser.id, {
          name: values.name,
          profileColor: values.profileColor,
          bio: values.bio
        });
      }
      toast.success(t('profileUpdated'));
    } catch (error) {
      setTrpcErrors(error);
      toast.error(getTrpcError(error, 'Could not update your profile.'));
    } finally {
      setSaving(false);
    }
  }, [saving, ownPublicUser, values, setTrpcErrors, t]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void onUpdateUser();
    },
    [onUpdateUser]
  );

  if (!ownPublicUser) return null;

  const userAvatarUrl = getFileUrl(ownPublicUser.avatar);
  const userBannerUrl = getFileUrl(ownPublicUser.banner);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profileTitle')}</CardTitle>
        <CardDescription>{t('profileDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-start gap-4">
            <AvatarManager user={ownPublicUser} />

            <BannerManager user={ownPublicUser} />

            <Group label={t('profileColorLabel')}>
              <ColorPicker
                value={values.profileColor}
                onChange={handleColorChange}
                defaultValue={DEFAULT_PROFILE_COLOR}
              />
              <ImageSwatchPicker
                src={userAvatarUrl}
                onChange={handleColorChange}
              />
              <ImageSwatchPicker
                src={userBannerUrl}
                onChange={handleColorChange}
              />
            </Group>
          </div>

          <Group label={t('usernameLabel')}>
            <Input placeholder={t('usernamePlaceholder')} {...r('name')} />
          </Group>

          <Group label={t('bioLabel')}>
            <Textarea placeholder={t('bioPlaceholder')} {...r('bio')} />
          </Group>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeServerScreens}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving} aria-busy={saving}>
              {t('saveChanges')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
});

export { Profile };
