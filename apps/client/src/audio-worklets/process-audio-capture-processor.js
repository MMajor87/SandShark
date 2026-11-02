// the native helper and the audio context run on different clocks, so the buffer
// slowly fills or drains. trimming back to a fixed target keeps screen audio in
// sync with the video instead of drifting up to the buffer capacity.
const TARGET_LATENCY_SECONDS = 0.08;
const MAXIMUM_LATENCY_SECONDS = 0.25;
const CAPACITY_SECONDS = 1;

class ProcessAudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.channels = options.outputChannelCount?.[0] ?? 2;
    this.capacity = Math.ceil(sampleRate * CAPACITY_SECONDS) * this.channels;
    this.buffer = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.available = 0;
    this.targetSamples =
      Math.ceil(sampleRate * TARGET_LATENCY_SECONDS) * this.channels;
    this.maximumSamples =
      Math.ceil(sampleRate * MAXIMUM_LATENCY_SECONDS) * this.channels;
    // wait for the target before playing so an underrun does not stutter block by block.
    this.buffering = true;

    this.port.onmessage = ({ data }) => {
      if (data?.type !== 'audio' || !(data.samples instanceof Float32Array)) {
        return;
      }

      this.write(data.samples);
    };
  }

  write(samples) {
    let input = samples;

    if (input.length > this.capacity) {
      input = input.subarray(input.length - this.capacity);
    }

    const overflow = this.available + input.length - this.capacity;

    if (overflow > 0) this.skip(overflow);

    const writeIndex = (this.readIndex + this.available) % this.capacity;
    const firstLength = Math.min(input.length, this.capacity - writeIndex);

    this.buffer.set(input.subarray(0, firstLength), writeIndex);
    this.buffer.set(input.subarray(firstLength), 0);
    this.available += input.length;

    if (this.available > this.maximumSamples) {
      this.skip(this.available - this.targetSamples);
    }

    if (this.buffering && this.available >= this.targetSamples) {
      this.buffering = false;
    }
  }

  skip(count) {
    // keep whole frames so the left and right channels never swap.
    const frameAligned =
      count + ((this.channels - (count % this.channels)) % this.channels);
    const skipped = Math.min(frameAligned, this.available);

    this.readIndex = (this.readIndex + skipped) % this.capacity;
    this.available -= skipped;
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;
    const needed = frames * this.channels;

    if (this.buffering || this.available < needed) {
      for (const channel of output) channel.fill(0);
      this.buffering = true;

      return true;
    }

    for (let frame = 0; frame < frames; frame += 1) {
      const base = (this.readIndex + frame * this.channels) % this.capacity;

      for (let channel = 0; channel < output.length; channel += 1) {
        const sample = this.buffer[(base + channel) % this.capacity];

        output[channel][frame] = Number.isFinite(sample) ? sample : 0;
      }
    }

    this.readIndex = (this.readIndex + needed) % this.capacity;
    this.available -= needed;

    return true;
  }
}

registerProcessor(
  'sandshark-process-audio-capture',
  ProcessAudioCaptureProcessor
);
