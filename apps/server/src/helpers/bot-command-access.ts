import type { TBotCommandRow } from './discord/command';
import { isAdministrator } from './discord/member';

// discord's default_member_permissions: null lets everyone run the command, "0" only
// administrators, anything else needs every one of those bits
const canUseBotCommand = (
  command: Pick<TBotCommandRow, 'defaultMemberPermissions'>,
  memberBits: bigint
) => {
  if (command.defaultMemberPermissions === null) return true;

  if (isAdministrator(memberBits)) return true;

  const required = BigInt(command.defaultMemberPermissions);

  return required !== 0n && (memberBits & required) === required;
};

export { canUseBotCommand };
