import WebSocket from 'ws';

// the bot api is served by the e2e server itself, not through the client's dev server
const SERVER = 'localhost:4991';

type TJson = Record<string, unknown>;

type TInteraction = {
  id: string;
  token: string;
  type: number;
  data: TJson;
};

type TWaiter = {
  matches: (interaction: TInteraction) => boolean;
  resolve: (interaction: TInteraction) => void;
};

// a minimal bot written against the discord api directly, the way a library would talk to
// it: it identifies over the gateway, registers commands over rest, and answers the
// interactions the member's clicks send it
class TestBot {
  private ws: WebSocket;
  private heartbeat: ReturnType<typeof setInterval> | undefined;
  private sequence: number | null = null;
  private interactions: TInteraction[] = [];
  private waiters: TWaiter[] = [];
  applicationId = '';

  private constructor(private token: string) {
    this.ws = new WebSocket(`ws://${SERVER}/api/v10/gateway?v=10&encoding=json`);
  }

  static async connect(token: string) {
    const bot = new TestBot(token);

    await bot.identify();

    return bot;
  }

  private identify() {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('the test bot never became ready')),
        15_000
      );

      this.ws.on('message', (raw) => {
        const payload = JSON.parse(raw.toString()) as {
          op: number;
          d: TJson;
          s: number | null;
          t: string | null;
        };

        if (payload.s !== null) this.sequence = payload.s;

        if (payload.op === 10) {
          const interval = payload.d.heartbeat_interval as number;

          this.heartbeat = setInterval(
            () => this.send({ op: 1, d: this.sequence }),
            interval
          );
          this.send({
            op: 2,
            d: {
              token: this.token,
              intents: 1,
              properties: { os: 'linux', browser: 'e2e', device: 'e2e' }
            }
          });
        }

        if (payload.t === 'READY') {
          this.applicationId = (payload.d.application as TJson).id as string;
          clearTimeout(timer);
          resolve();
        }

        if (payload.t === 'INTERACTION_CREATE') {
          this.receive(payload.d as unknown as TInteraction);
        }
      });
      this.ws.on('error', reject);
    });
  }

  private send(payload: unknown) {
    this.ws.send(JSON.stringify(payload));
  }

  private receive(interaction: TInteraction) {
    const waiter = this.waiters.find(({ matches }) => matches(interaction));

    if (!waiter) {
      this.interactions.push(interaction);
      return;
    }

    this.waiters.splice(this.waiters.indexOf(waiter), 1);
    waiter.resolve(interaction);
  }

  // the next interaction of this type, whether it already arrived or arrives later,
  // optionally the first one that also passes a check of its own
  nextInteraction(
    type: number,
    accept: (interaction: TInteraction) => boolean = () => true,
    timeoutMs = 15_000
  ) {
    const matches = (interaction: TInteraction) =>
      interaction.type === type && accept(interaction);
    const queued = this.interactions.find(matches);

    if (queued) {
      this.interactions.splice(this.interactions.indexOf(queued), 1);

      return Promise.resolve(queued);
    }

    return new Promise<TInteraction>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`no interaction of type ${type} arrived`)),
        timeoutMs
      );

      this.waiters.push({
        matches,
        resolve: (interaction) => {
          clearTimeout(timer);
          resolve(interaction);
        }
      });
    });
  }

  async registerCommands(commands: unknown[]) {
    const response = await fetch(
      `http://${SERVER}/api/v10/applications/${this.applicationId}/commands`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${this.token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commands)
      }
    );

    if (!response.ok) {
      throw new Error(`registering commands failed: ${response.status}`);
    }
  }

  // interaction callbacks carry no bot token, the interaction's own token is the credential
  async respond(interaction: TInteraction, body: unknown) {
    const response = await fetch(
      `http://${SERVER}/api/v10/interactions/${interaction.id}/${interaction.token}/callback`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      throw new Error(
        `answering the interaction failed: ${response.status} ${await response.text()}`
      );
    }
  }

  close() {
    clearInterval(this.heartbeat);
    this.ws.close();
  }
}

export { TestBot, type TInteraction };
