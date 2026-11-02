import { afterAll, beforeAll, expect, test } from 'bun:test';

type TProcessor = {
  port: { onmessage: (event: { data: unknown }) => void };
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean;
  available: number;
};
type TProcessorClass = new (options: {
  outputChannelCount: number[];
}) => TProcessor;

const globals = globalThis as unknown as Record<string, unknown>;
const originalGlobals = {
  AudioWorkletProcessor: globals.AudioWorkletProcessor,
  registerProcessor: globals.registerProcessor,
  sampleRate: globals.sampleRate
};
let Processor: TProcessorClass;

beforeAll(async () => {
  globals.AudioWorkletProcessor = class {
    port = { onmessage: () => {} };
  };
  globals.registerProcessor = (_name: string, processor: TProcessorClass) => {
    Processor = processor;
  };
  // 1000 Hz keeps the numbers readable: 80 frames target, 250 frames maximum.
  globals.sampleRate = 1000;
  // @ts-expect-error - worklets are plain scripts loaded by url and ship no types
  await import('../process-audio-capture-processor.js');
});

afterAll(() => {
  Object.assign(globals, originalGlobals);
});

const createProcessor = () => new Processor({ outputChannelCount: [2] });

const send = (processor: TProcessor, frames: number, start = 0) => {
  const samples = new Float32Array(frames * 2);

  for (let frame = 0; frame < frames; frame += 1) {
    samples[frame * 2] = start + frame;
    samples[frame * 2 + 1] = -(start + frame);
  }

  processor.port.onmessage({ data: { type: 'audio', samples } });
};

const render = (processor: TProcessor, frames = 4) => {
  const output = [new Float32Array(frames), new Float32Array(frames)];

  processor.process([], [output]);

  return output;
};

test('waits for the target latency, then plays interleaved frames in order', () => {
  const processor = createProcessor();

  send(processor, 40, 1);
  expect(Array.from(render(processor)[0])).toEqual([0, 0, 0, 0]);

  send(processor, 40, 41);
  const [left, right] = render(processor);

  expect(Array.from(left)).toEqual([1, 2, 3, 4]);
  expect(Array.from(right)).toEqual([-1, -2, -3, -4]);
});

test('trims a backlog above the maximum back to the target latency', () => {
  const processor = createProcessor();

  send(processor, 300, 1);

  expect(processor.available).toBe(160);
  expect(Array.from(render(processor)[0])).toEqual([221, 222, 223, 224]);
});

test('an underrun outputs silence and rebuffers instead of playing fragments', () => {
  const processor = createProcessor();

  send(processor, 82, 1);
  render(processor, 80);
  expect(Array.from(render(processor)[0])).toEqual([0, 0, 0, 0]);

  send(processor, 10, 100);
  expect(Array.from(render(processor)[0])).toEqual([0, 0, 0, 0]);
});
