import { TestId } from '@sandshark/shared';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input
} from '@sandshark/ui';
import { Copy } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TDialogBaseProps } from '../types';

type TBotTokenDialogProps = TDialogBaseProps & {
  botName: string;
  token: string;
};

// the server only keeps a hash, so this is the one chance to copy the token
const BotTokenDialog = memo(
  ({ isOpen, close, botName, token }: TBotTokenDialogProps) => {
    const { t } = useTranslation('dialogs');

    const onCopy = useCallback(async () => {
      try {
        await navigator.clipboard.writeText(token);

        toast.success(t('botTokenCopied'));
      } catch {
        toast.error(t('failedCopyBotToken'));
      }
    }, [token, t]);

    return (
      <AlertDialog open={isOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('botTokenTitle', { name: botName })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('botTokenMsg')}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <Input
              readOnly
              value={token}
              aria-label={t('botTokenLabel')}
              data-testid={TestId.BOT_TOKEN_VALUE}
              className="font-mono text-xs"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={onCopy}
              title={t('copyBotToken')}
              aria-label={t('copyBotToken')}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={close}>
              {t('botTokenDone')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }
);

export { BotTokenDialog };
