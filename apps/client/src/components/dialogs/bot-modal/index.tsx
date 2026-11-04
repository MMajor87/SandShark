import { getTRPCClient } from '@/lib/trpc';
import {
  BotTextInputStyle,
  getTrpcError,
  type TBotModalOpen,
  type TBotTextInput
} from '@sandshark/shared';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Group,
  Input,
  Textarea
} from '@sandshark/ui';
import type { ChangeEvent } from 'react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { TDialogBaseProps } from '../types';

type TBotModalFieldProps = {
  input: TBotTextInput;
  value: string;
  onChange: (customId: string, value: string) => void;
};

const BotModalField = memo(({ input, value, onChange }: TBotModalFieldProps) => {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(input.customId, event.target.value),
    [onChange, input.customId]
  );

  const field =
    input.style === BotTextInputStyle.PARAGRAPH ? (
      <Textarea
        value={value}
        placeholder={input.placeholder}
        maxLength={input.maxLength}
        onChange={handleChange}
      />
    ) : (
      <Input
        value={value}
        placeholder={input.placeholder}
        maxLength={input.maxLength}
        onChange={handleChange}
      />
    );

  return (
    <Group
      label={input.label}
      description={input.description}
      required={input.required}
    >
      {field}
    </Group>
  );
});

type TBotModalDialogProps = TDialogBaseProps & TBotModalOpen;

// a form a bot answered the member with. closing it sends nothing, as on discord
const BotModalDialog = memo(
  ({ isOpen, close, interactionId, title, inputs }: TBotModalDialogProps) => {
    const { t } = useTranslation('dialogs');
    const [loading, setLoading] = useState(false);
    const [values, setValues] = useState<Record<string, string>>(() =>
      Object.fromEntries(inputs.map((input) => [input.customId, input.value ?? '']))
    );

    const onChange = useCallback(
      (customId: string, value: string) =>
        setValues((current) => ({ ...current, [customId]: value })),
      []
    );

    const onSubmit = useCallback(async () => {
      setLoading(true);

      try {
        const trpc = getTRPCClient();

        await trpc.bots.submitModal.mutate({ interactionId, values });
        close();
      } catch (error) {
        toast.error(getTrpcError(error, t('failedSubmitBotModal')));
      } finally {
        setLoading(false);
      }
    }, [interactionId, values, close, t]);

    return (
      <Dialog open={isOpen}>
        <DialogContent onInteractOutside={close} close={close}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {inputs.map((input) => (
            <BotModalField
              key={input.customId}
              input={input}
              value={values[input.customId] ?? ''}
              onChange={onChange}
            />
          ))}

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={close}>
              {t('cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={loading}>
              {t('botModalSubmit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);

export { BotModalDialog };
