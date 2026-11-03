import type { ChannelPermission } from '@sandshark/shared';

export type TChannelPermission = {
  permission: ChannelPermission;
  allow: boolean;
};

export type TChannelPermissionType = 'role' | 'user';
