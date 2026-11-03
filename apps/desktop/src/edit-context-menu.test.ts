import { expect, mock, test } from 'bun:test';
import {
  buildEditMenuTemplate,
  type TEditMenuParams
} from './edit-context-menu.js';

const ALL_EDIT_FLAGS = {
  canUndo: true,
  canRedo: true,
  canCut: true,
  canCopy: true,
  canPaste: true,
  canDelete: true,
  canSelectAll: true,
  canEditRichly: true
};

const NO_EDIT_FLAGS = {
  canUndo: false,
  canRedo: false,
  canCut: false,
  canCopy: false,
  canPaste: false,
  canDelete: false,
  canSelectAll: false,
  canEditRichly: false
};

const params = (overrides: Partial<TEditMenuParams>): TEditMenuParams => ({
  isEditable: false,
  selectionText: '',
  editFlags: NO_EDIT_FLAGS,
  misspelledWord: '',
  dictionarySuggestions: [],
  linkURL: '',
  ...overrides
});

const createActions = () => ({
  replaceMisspelling: mock((_word: string) => {}),
  addToDictionary: mock((_word: string) => {}),
  copyLink: mock((_url: string) => {})
});

test('offers nothing where there is nothing to edit, copy or follow', () => {
  expect(buildEditMenuTemplate(params({}), createActions())).toEqual([]);
});

test('an input gets cut, copy, paste and select all following its edit flags', () => {
  const template = buildEditMenuTemplate(
    params({
      isEditable: true,
      editFlags: { ...ALL_EDIT_FLAGS, canCut: false, canCopy: false }
    }),
    createActions()
  );

  expect(template).toEqual([
    { role: 'cut', enabled: false },
    { role: 'copy', enabled: false },
    { role: 'paste', enabled: true },
    { type: 'separator' },
    { role: 'selectAll', enabled: true }
  ]);
});

test('selected page text outside an input only offers copy', () => {
  const template = buildEditMenuTemplate(
    params({ selectionText: 'hello' }),
    createActions()
  );

  expect(template).toEqual([{ role: 'copy' }]);
});

test('a whitespace only selection is not worth a menu', () => {
  expect(
    buildEditMenuTemplate(params({ selectionText: '  \n' }), createActions())
  ).toEqual([]);
});

test('a misspelled word lists the first suggestions and adds to the dictionary', () => {
  const actions = createActions();
  const template = buildEditMenuTemplate(
    params({
      isEditable: true,
      editFlags: ALL_EDIT_FLAGS,
      misspelledWord: 'helo',
      dictionarySuggestions: ['hello', 'help', 'hero', 'halo', 'held', 'hell']
    }),
    actions
  );

  const labels = template.map((item) => item.label ?? item.role ?? item.type);

  expect(labels).toEqual([
    'hello',
    'help',
    'hero',
    'halo',
    'held',
    'Add to Dictionary',
    'separator',
    'cut',
    'copy',
    'paste',
    'separator',
    'selectAll'
  ]);

  template[1]!.click!(
    {} as Electron.MenuItem,
    undefined,
    {} as Electron.KeyboardEvent
  );
  template[5]!.click!(
    {} as Electron.MenuItem,
    undefined,
    {} as Electron.KeyboardEvent
  );

  expect(actions.replaceMisspelling).toHaveBeenCalledWith('help');
  expect(actions.addToDictionary).toHaveBeenCalledWith('helo');
});

test('a safe link can be copied, an unsafe one is left out', () => {
  const actions = createActions();
  const template = buildEditMenuTemplate(
    params({ linkURL: 'https://example.com/page' }),
    actions
  );

  expect(template).toHaveLength(1);
  expect(template[0]!.label).toBe('Copy Link');

  template[0]!.click!(
    {} as Electron.MenuItem,
    undefined,
    {} as Electron.KeyboardEvent
  );

  expect(actions.copyLink).toHaveBeenCalledWith('https://example.com/page');
  expect(
    buildEditMenuTemplate(params({ linkURL: 'javascript:alert(1)' }), actions)
  ).toEqual([]);
});
