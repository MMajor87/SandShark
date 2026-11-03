import { Dialog } from '@/components/dialogs/dialogs';
import { describe, expect, test } from 'bun:test';
import { dialogSliceActions, dialogSliceReducer } from '../slice';

const initial = () => dialogSliceReducer(undefined, { type: 'init' });

describe('dialog reducers', () => {
  test('the delayed close shuts a dialog that is fading out', () => {
    let state = dialogSliceReducer(
      initial(),
      dialogSliceActions.openDialog({ dialog: Dialog.TEXT_INPUT })
    );

    state = dialogSliceReducer(state, dialogSliceActions.setClosing(true));
    state = dialogSliceReducer(state, dialogSliceActions.closeDialogs());

    expect(state.isOpen).toBe(false);
    expect(state.openDialog).toBeUndefined();
  });

  // creating a bot closes its name prompt and opens the token dialog before the prompt
  // has finished fading out, and the token is never shown again
  test('a dialog opened while another fades out survives the delayed close', () => {
    let state = dialogSliceReducer(
      initial(),
      dialogSliceActions.openDialog({ dialog: Dialog.TEXT_INPUT })
    );

    state = dialogSliceReducer(state, dialogSliceActions.setClosing(true));
    state = dialogSliceReducer(
      state,
      dialogSliceActions.openDialog({
        dialog: Dialog.BOT_TOKEN,
        props: { token: 'secret' }
      })
    );
    state = dialogSliceReducer(state, dialogSliceActions.closeDialogs());

    expect(state.isOpen).toBe(true);
    expect(state.openDialog).toBe(Dialog.BOT_TOKEN);
    expect(state.props).toEqual({ token: 'secret' });
  });
});
