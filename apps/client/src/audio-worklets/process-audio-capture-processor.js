class ProcessAudioCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.channels = options.outputChannelCount?.[0] ?? 2;
    this.samples = new Float32Array(0);
    this.offset = 0;

    this.port.onmessage = ({ data }) => {
      if (data?.type !== 'audio' || !(data.samples instanceof Float32Array)) {
        return;
      }

      const pending = this.samples.subarray(this.offset);
      const combined = new Float32Array(pending.length + data.samples.length);
      combined.set(pending);
      combined.set(data.samples, pending.length);
      this.samples = combined;
      this.offset = 0;

      // Keep enough jitter headroom without allowing a stalled renderer to add
      // seconds of latency to a live stream.
      const maximumSamples = sampleRate * this.channels * 2;
      if (this.samples.length > maximumSamples) {
        this.samples = this.samples.subarray(this.samples.length - maximumSamples);
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0]?.length ?? 0;

    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < output.length; channel += 1) {
        const sample = this.samples[this.offset + frame * this.channels + channel];
        output[channel][frame] = Number.isFinite(sample) ? sample : 0;
      }
    }

    this.offset += frames * this.channels;
    if (this.offset >= this.samples.length) {
      this.samples = new Float32Array(0);
      this.offset = 0;
    }

    return true;
  }
}

registerProcessor('sandshark-process-audio-capture', ProcessAudioCaptureProcessor);
