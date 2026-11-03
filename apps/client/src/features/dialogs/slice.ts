import type { Dialog } from '@/components/dialogs/dialogs';
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { TGenericObject } from '@sandshark/shared';

export type TDialogState = {
  openDialog: Dialog | undefined;
  props: TGenericObject;
  isOpen: boolean;
  closing: boolean;
};

const initialState: TDialogState = {
  openDialog: undefined,
  props: {},
  isOpen: false,
  closing: false
};

export const dialogSlice = createSlice({
  name: 'dialog',
  initialState,
  reducers: {
    resetDialogs: () => initialState,
    openDialog: (
      state,
      action: PayloadAction<{ dialog: Dialog; props?: TGenericObject }>
    ) => {
      state.openDialog = action.payload.dialog;
      state.props = action.payload.props || {};
      state.isOpen = true;
      state.closing = false;
    },
    // runs once the fade out of a closed dialog ends. a dialog opened during that fade,
    // such as a bot token shown right after its name prompt, cleared closing and must stay
    closeDialogs: (state) => {
      if (!state.closing) return;

      state.openDialog = undefined;
      state.props = {};
      state.isOpen = false;
      state.closing = false;
    },
    setClosing: (state, action: PayloadAction<boolean>) => {
      state.closing = action.payload;
    }
  }
});

const dialogSliceActions = dialogSlice.actions;
const dialogSliceReducer = dialogSlice.reducer;

export { dialogSliceActions, dialogSliceReducer };
