import { HostedBotTemplate } from '@sandshark/shared';

// plain discord.js, the way a guide for discord writes it, so the admin can keep building on
// it with any discord.js guide. it is kept as source here because the server ships as one
// compiled binary
const PING_BOT_INDEX = `import { Client, Events, GatewayIntentBits } from 'discord.js';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async (ready) => {
  await ready.application.commands.set([
    { name: 'ping', description: 'Check that the bot answers' }
  ]);

  console.log('ready as ' + ready.user.username);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ping') {
    await interaction.reply('Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);
`;

const PING_BOT_PACKAGE = `${JSON.stringify(
  {
    name: 'ping-bot',
    private: true,
    type: 'module',
    main: 'index.js',
    dependencies: { 'discord.js': '^14.27.0' }
  },
  null,
  2
)}\n`;

const HOSTED_BOT_TEMPLATES: Record<
  HostedBotTemplate,
  Record<string, string>
> = {
  [HostedBotTemplate.PING]: {
    'package.json': PING_BOT_PACKAGE,
    'index.js': PING_BOT_INDEX
  }
};

export { HOSTED_BOT_TEMPLATES };
