// suggestions a bot sends back for an option a member is typing into. the member's request
// waits for them, so they are kept here until the bot answers or the time runs out
type TAutocompleteChoice = {
  name: string;
  value: string | number;
};

const pending = new Map<number, (choices: TAutocompleteChoice[]) => void>();

// resolves with the bot's choices, or none when it does not answer in time
const waitForAutocomplete = (interactionId: number, timeoutMs: number) =>
  new Promise<TAutocompleteChoice[]>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(interactionId);
      resolve([]);
    }, timeoutMs);

    pending.set(interactionId, (choices) => {
      clearTimeout(timer);
      pending.delete(interactionId);
      resolve(choices);
    });
  });

// false when nobody is waiting any more, so the bot is told its answer came too late
const resolveAutocomplete = (
  interactionId: number,
  choices: TAutocompleteChoice[]
) => {
  const resolve = pending.get(interactionId);

  if (!resolve) return false;

  resolve(choices);

  return true;
};

export { resolveAutocomplete, waitForAutocomplete, type TAutocompleteChoice };
