// the server half of the starter plugin, see docs/plugins.md. it runs inside the server
// process, with the context the host passes to onLoad

let unsubscribe;

const onLoad = async (ctx) => {
  // an admin edits these under server settings, in this plugin's settings tab. a key that was
  // never saved reads back its defaultValue
  const settings = await ctx.settings.register([
    {
      key: 'greeting',
      name: 'Greeting',
      description: 'What /hello says before the name.',
      type: 'string',
      defaultValue: 'Hello'
    }
  ]);

  // typed into chat as /hello. the answer renders in the channel, so everyone sees it
  ctx.commands.register({
    name: 'hello',
    description: 'Says hello',
    args: [
      {
        name: 'name',
        description: 'Who to greet',
        type: 'string',
        required: false
      }
    ],
    async executes(invoker, args) {
      const user = await ctx.users.get(invoker.userId);
      const name = args.name || user?.name || 'there';

      return `${settings.get('greeting')}, ${name}!`;
    }
  });

  // called by this plugin's own ui, not typed into chat. the count lives in the plugin's
  // storage, which survives restarts and updates and is removed with the plugin
  ctx.actions.register({
    name: 'wave',
    description: 'Counts a wave',
    async executes() {
      const waves = ((await ctx.storage.get('waves')) ?? 0) + 1;

      await ctx.storage.set('waves', waves);

      return { waves };
    }
  });

  unsubscribe = ctx.events.on('user:joined', ({ username }) => {
    ctx.logger.log(`${username} joined`);
  });

  // loads client/index.js in the browser, which is where the settings page below comes from
  ctx.ui.enable();

  ctx.logger.log('Hello SandShark loaded');
};

// handlers and registrations are removed for you when the plugin unloads. this is for
// anything the plugin started itself, such as timers or connections
const onUnload = (ctx) => {
  unsubscribe?.();
  ctx.logger.log('Hello SandShark unloaded');
};

export { onLoad, onUnload };
