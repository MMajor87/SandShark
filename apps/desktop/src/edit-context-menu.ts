import type { ContextMenuParams, MenuItemConstructorOptions } from 'electron';
import { isSafeExternalUrl } from './external-url.js';

const MAX_SPELLING_SUGGESTIONS = 5;

type TEditMenuParams = Pick<
  ContextMenuParams,
  | 'isEditable'
  | 'selectionText'
  | 'editFlags'
  | 'misspelledWord'
  | 'dictionarySuggestions'
  | 'linkURL'
>;

type TEditMenuActions = {
  replaceMisspelling: (word: string) => void;
  addToDictionary: (word: string) => void;
  copyLink: (url: string) => void;
};

const joinSections = (sections: MenuItemConstructorOptions[][]) =>
  sections
    .filter((section) => section.length > 0)
    .flatMap((section, index) =>
      index === 0 ? section : [{ type: 'separator' as const }, ...section]
    );

// the renderer's own menus call preventDefault, so electron only asks for this one where
// the page offered nothing. without it a right click in an input does nothing at all
const buildEditMenuTemplate = (
  params: TEditMenuParams,
  actions: TEditMenuActions
): MenuItemConstructorOptions[] => {
  const spelling: MenuItemConstructorOptions[] = [];
  const editing: MenuItemConstructorOptions[] = [];
  const link: MenuItemConstructorOptions[] = [];

  if (params.isEditable && params.misspelledWord) {
    const suggestions = params.dictionarySuggestions.slice(
      0,
      MAX_SPELLING_SUGGESTIONS
    );

    for (const suggestion of suggestions) {
      spelling.push({
        label: suggestion,
        click: () => actions.replaceMisspelling(suggestion)
      });
    }

    spelling.push({
      label: 'Add to Dictionary',
      click: () => actions.addToDictionary(params.misspelledWord)
    });
  }

  if (params.isEditable) {
    editing.push(
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll }
    );
  } else if (params.selectionText.trim()) {
    editing.push({ role: 'copy' });
  }

  if (isSafeExternalUrl(params.linkURL)) {
    link.push({
      label: 'Copy Link',
      click: () => actions.copyLink(params.linkURL)
    });
  }

  return joinSections([spelling, editing, link]);
};

export { buildEditMenuTemplate };
export type { TEditMenuActions, TEditMenuParams };
