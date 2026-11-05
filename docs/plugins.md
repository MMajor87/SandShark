# Plugins

A plugin adds to SandShark itself: slash commands, buttons and pages in the app, settings an admin fills in, reactions to what happens on the server, rules that run before a message or file is saved, HTTP routes, and access to voice. It is a folder of JavaScript that the server loads, with a half that runs in the server and a half that runs in everyone's app.

> **Plugins are trusted code.** A plugin runs inside the server process, with the server's rights, and can read the database and every file the server can. There is no sandbox. Only install plugins you trust, and only give **Manage plugins** to people you would trust with the server itself.

## Plugin or bot?

| | Plugin | Bot |
| --- | --- | --- |
| Runs | inside the server | anywhere, or hosted by the server |
| Written with | the SandShark plugin API | discord.js, discord.py or any Discord library |
| Can change the app | yes: buttons, pages, components in messages | no, only messages, embeds and components |
| Can change the server's rules | yes, with hooks | no |
| Moves to or from Discord | no | yes, unchanged |

Write a plugin when you want to extend SandShark itself. If you already have a Discord bot, or want one that runs on both, see [the bots guide](bots.md).

## Install and turn on

1. Copy the plugin's folder into the `plugins` folder in the server's data directory. The folder name has to match the `id` in its `manifest.json`. On the [Windows service install](windows-server-install.md) this is `C:\ProgramData\SandShark Server\data\plugins`, on the [Linux install](linux-server-install.md) `/var/lib/sandshark/plugins`, and in Docker `/home/bun/.config/sandshark/plugins` inside the data volume.
2. Turn on **Plugins** under Server settings, General, if it is off.
3. Open Server settings, Plugins, and enable the plugin. A plugin that fails to load stays in the list with the reason next to it, and its log is under its own entry.
4. Give the **Use plugins** permission to the roles that should use plugins. It is what lets members run plugin commands and see what plugins add to the app, and the default role does not have it.

Each enabled plugin gets an entry under **Plugin settings** in server settings, with up to four tabs: **Settings** (what the plugin registered), **Commands**, **Logs**, and **Permissions**, where an owner can change which roles may use each of its commands and actions.

To update a plugin, replace its folder and disable and enable it again. To remove one, use **Remove** in its entry, which also deletes its data.

## Try the starter plugin

[`examples/plugins/hello-sandshark`](../examples/plugins/hello-sandshark) is a complete plugin with nothing to build. It has:

- a `/hello` command that greets whoever runs it;
- a greeting setting an admin can change;
- a **Wave** button on a page in user settings, which calls a server action that counts waves in the plugin's storage;
- an event handler that writes to the plugin's log.

Install it as above, then type `/hello` in a channel and open user settings. It is the quickest way to see each part working, and the sections below explain them.

## The folder

```text
hello-sandshark/
  manifest.json
  package.json
  server/index.js
  client/index.js
```

Both entry files have to exist, even when a plugin adds nothing to the app: `client/index.js` can export nothing.

### manifest.json

```json
{
  "id": "hello-sandshark",
  "name": "Hello SandShark",
  "author": "SandShark",
  "description": "A starter plugin",
  "sdkVersion": 2,
  "version": "1.0.0"
}
```

| Field | |
| --- | --- |
| `id` | the folder's name, and how everything refers to the plugin. Never change it after release: settings, storage and permissions are kept under it |
| `name`, `author`, `description` | shown in server settings. Required |
| `version` | `major.minor.patch`, optionally with a `-suffix`. A new version runs `onUpgrade` once |
| `sdkVersion` | the plugin API version the plugin was written for. This server speaks `2`, and refuses a plugin that says anything else instead of letting it fail later |
| `logo`, `homepage` | optional `http` or `https` addresses. The logo is shown next to the plugin and its messages |

`package.json` needs `"type": "module"`, since both entry files are ES modules.

## The server half

`server/index.js` exports the lifecycle functions:

```js
const onLoad = async (ctx) => {
  // register commands, actions, settings, hooks and handlers here
};

const onUnload = (ctx) => {
  // stop anything you started yourself, such as timers
};

const onUpgrade = async (ctx, { previousVersion, version }) => {
  // migrate what is in ctx.dataPath before the new version loads
};

export { onLoad, onUnload, onUpgrade };
```

- **`onLoad`** is required. Everything a plugin registers is registered here, and removed for it when the plugin unloads, so most plugins never need to undo anything.
- **`onUnload`** gets a smaller context, without the ways to register things. Leaving it out only logs a warning for now, but a future API version will require it.
- **`onUpgrade`** runs once, before `onLoad`, when the manifest's version differs from the one that last loaded. Its context has only the paths and the logger.

`onLoad` and `onUpgrade` have a time limit, and a plugin whose `onLoad` throws or runs over is left unloaded with the error in its log.

### What `ctx` gives you

| | |
| --- | --- |
| `ctx.commands.register` | slash commands, below |
| `ctx.actions.register` | functions the plugin's own UI calls, below |
| `ctx.settings.register` | server-wide settings an admin edits, below |
| `ctx.storage` | server-wide JSON key value storage: `get`, `set`, `delete`, and `list` by key prefix with paging |
| `ctx.userData` | JSON kept per user, read and saved from the app with `useUserData` |
| `ctx.events.on` | notifications of what already happened, such as `message:created`, `user:joined`, `reaction:added` and `voice:producer_added`. Handlers can't change or stop anything |
| `ctx.hooks` | rules that run before a write and can change or refuse it, below |
| `ctx.messages` | send, edit, delete, pin, react to and list messages. A plugin's messages are its own, shown with its name, logo and a bot badge |
| `ctx.push` | send data to the plugin's code in the app: to one user, several, everyone, or everyone in a voice channel |
| `ctx.http` | HTTP routes under `/plugins/<id>/`, below |
| `ctx.users`, `ctx.roles`, `ctx.channels`, `ctx.categories`, `ctx.invites`, `ctx.emojis`, `ctx.files` | read and manage the server's own objects. A plugin can never touch the owner role or anyone who holds it |
| `ctx.permissions` | ask whether a user may do something, with role inheritance and channel overrides applied. Ask rather than reading roles yourself |
| `ctx.voice` | voice channels at the mediasoup level: read what each user sends, add a stream of your own, move, disconnect and server mute users, and float reactions |
| `ctx.ui.enable` | load the plugin's `client/index.js` in the app. Without it nothing in the client half is shown |
| `ctx.logger` | the plugin's log, readable in server settings |
| `ctx.path`, `ctx.dataPath` | the plugin's folder, which an update replaces, and a folder that survives updates for anything you keep on disk |

The comments on each of these in [the SDK's types](../packages/plugin-sdk/src/index.ts) are the full reference.

### Commands

```js
ctx.commands.register({
  name: 'hello',
  description: 'Says hello',
  args: [{ name: 'name', type: 'string', required: false }],
  async executes(invoker, args) {
    return `Hello, ${args.name ?? 'there'}!`;
  }
});
```

Members find commands in the message box's `/` menu. The invocation and its answer show in the channel for everyone. A string answer is shown as text, and anything else as JSON. `ephemeral: true` answers only the member who ran it.

- `args` are the fields the member fills in. Each is a `string`, `number` or `boolean`, and `sensitive: true` hides the value in the channel and keeps it out of the log.
- `invoker` says who ran it (`userId`), where (`channelId`, and `parentMessageId` in a thread) and how: `source` is `chat` when typed, or `api` when the plugin's own UI called it.
- `requires` names a permission a member needs to run it. Without it any member with **Use plugins** can. Either way an owner can change it per role under the plugin's **Permissions** tab.

### Actions

An action is a function the plugin's UI calls on the server. It isn't typed into chat and posts nothing:

```js
ctx.actions.register({
  name: 'wave',
  async executes(invoker, payload) {
    const waves = ((await ctx.storage.get('waves')) ?? 0) + 1;

    await ctx.storage.set('waves', waves);

    return { waves };
  }
});
```

The app calls it with `store.actions.executePluginAction('<plugin id>', 'wave', payload)` and gets the return value back. `requires` and per-role access work as for commands, and `useCanUse('action', 'wave')` tells the UI whether the member may, so it can disable a button rather than fail. The server checks again either way.

### Settings

```js
const settings = await ctx.settings.register([
  { key: 'greeting', name: 'Greeting', type: 'string', defaultValue: 'Hello' },
  { key: 'channel', name: 'Announce in', type: 'channel', defaultValue: '' }
]);

settings.get('greeting');
```

Register them once in `onLoad`. An admin edits them in the plugin's **Settings** tab, and a key nobody saved reads back its `defaultValue`. Types are `string`, `number`, `boolean`, `secret` (a string shown masked), `enum` (with `options`), `channel` and `role`. These are server-wide; use `ctx.userData` for what belongs to one member.

### Hooks

Hooks run before the server writes, and every hook answers in one of three ways: return nothing to allow, `{ update }` to change what is saved, or `{ reject: 'reason' }` to refuse with a message the member sees. Throwing doesn't refuse: it means the plugin is broken, so the error is logged, the member gets a generic error, and the action fails.

There are hooks for saving a message or file, creating or deleting a channel, joining voice, logging in, reacting and updating a profile (`onBeforeMessageSave`, `onBeforeFileSave` and so on). When several plugins hook the same thing, they run in order and the first refusal wins.

### HTTP routes

```js
ctx.http.get('/status', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
});
```

This answers at `/plugins/<id>/status`. Handlers get Node's own request and response, so reading the body and setting content types is up to you. A route is public unless its options say `auth: true`, which requires a signed-in member and passes their `userId`, or `requires` names a permission. Public is the default because a webhook receiver has to be. All plugin routes share one rate limit.

## The client half

`client/index.js` is loaded in the app as an ES module once the server half calls `ctx.ui.enable()`, for every member with **Use plugins**. It is served exactly as it is, so it can't contain bare imports such as `import React from 'react'`: nothing in the page resolves them. Take React and the host from `window` instead:

```js
const React = window.__SANDSHARK_REACT__;
const store = window.__SANDSHARK_STORE__;
```

Use the host's React rather than bundling your own, or hooks throw against the second copy. `window.__SANDSHARK_REACT_JSX__` and `window.__SANDSHARK_REACT_DOM__` are there for bundled JSX and portals.

It exports up to three things:

**`components`** puts components into places in the app, by slot:

```js
export const components = {
  chat_actions: [({ channelId }) => React.createElement(MyButton, { channelId })],
  user_settings: [MyPreferences]
};
```

| Slot | Where | Props |
| --- | --- | --- |
| `chat_actions` | beside the message box | `channelId` |
| `message_actions` | in a message's hover actions | `messageId`, `channelId` |
| `message_footer` | under every message | `messageId`, `channelId` |
| `channel_header` | in the channel's header | `channelId` |
| `topbar_right` | at the right of the top bar | none |
| `member_list_item` | in every row of the member list | `userId` |
| `user_popover` | in a member's profile card | `userId` |
| `user_settings` | a page under user settings | none |
| `voice_controls` | beside the voice buttons, while connected | `channelId` |
| `voice_user_card` | the corner of every voice card | `channelId`, `userId` |
| `voice_user_row` | every user row under a voice channel | `channelId`, `userId` |
| `home_screen`, `connect_screen`, `full_screen` | the home and connect screens, and a full screen view | none |

Slots that render once per message, member or voice user should stay cheap. `ctx.ui.enable({ chat_actions: 'MANAGE_MESSAGES' })` hides a slot from members without that permission.

**`messageComponents`** are components a plugin message can carry. `ctx.messages.send(channelId, html, { components: [{ name, props }] })` renders them after the message text, and `ctx.messages.setComponents` updates them without marking the message edited, which is how a poll updates its counts. Everyone who can read the message receives the props, so don't put secrets in them.

**`tabs`** are pages in the plugin's entry in server settings, for admins only.

### Talking to the host

`window.__SANDSHARK_STORE__` is the host:

- `store.actions.executePluginAction(pluginId, name, payload)` calls an action, and `store.actions` also sends messages, selects channels and fetches the plugin's own HTTP routes.
- `store.hooks.useUserData()` reads and saves the member's `ctx.userData`.
- `store.hooks.usePush(handler)` receives what the server sends with `ctx.push`.
- `store.hooks.useCanUse('action' | 'command', name)` says whether the member may use one.
- `store.hooks.useHotkey` and `useHotkeyBinding` add actions members can bind keys to.
- `store.getState()` and `store.subscribe` read SandShark's state, such as users and channels.

## Writing it in TypeScript

The plain JavaScript above needs no build. For types, `@sandshark/plugin-sdk` in this repository has the full API: `PluginContext` for the server half, and from `@sandshark/plugin-sdk/client` typed helpers such as `createCallAction`, `usePush`, `useUserData` and `useStoreSelector`. It isn't published to npm yet, so reference it from a checkout of SandShark.

A plugin can describe its commands, actions, pushes and user data once, in a contract type shared by both halves, and both get typed names and payloads from it:

```ts
type TSandShark = {
  actions: { wave: { payload: void; response: { waves: number } } };
};

const onLoad = (ctx: PluginContext<TSandShark>) => { ... };
const callAction = createCallAction<TSandShark>();
```

Bundle each half to a single ES module at `server/index.js` and `client/index.js`. Map `react`, `react/jsx-runtime` and `react-dom` in the client bundle to the `window` globals above instead of bundling them, so nothing is left as a bare import.
