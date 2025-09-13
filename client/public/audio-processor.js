class AudioProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.sampleRate = 48000; // Default sample rate
        this.bitDepth = 24;
        this.bufferSize = 1024; // Process in chunks

        // Listen for messages from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'setSampleRate') {
                this.sampleRate = event.data.sampleRate;
            }
        };
    }

    // Convert float32 samples to 24-bit PCM
    float32ToPCM24(input) {
        const output = new Int32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            // Clamp the float value between -1 and 1
            let sample = Math.max(-1, Math.min(1, input[i]));
            // Convert to 24-bit signed integer (range: -8388608 to 8388607)
            output[i] = Math.round(sample * 8388607);
        }
        return output;
    }

    // Convert 24-bit PCM to bytes (3 bytes per sample, little-endian)
    pcm24ToBytes(pcmData) {
        const bytes = new Uint8Array(pcmData.length * 3);
        for (let i = 0; i < pcmData.length; i++) {
            const sample = pcmData[i];
            const byteIndex = i * 3;

            // Little-endian 24-bit representation
            bytes[byteIndex] = sample & 0xFF;           // LSB
            bytes[byteIndex + 1] = (sample >> 8) & 0xFF;  // Middle byte
            bytes[byteIndex + 2] = (sample >> 16) & 0xFF; // MSB
        }
        return bytes;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];

        // Only process if we have input
        if (input && input.length > 0) {
            const inputChannel = input[0]; // Mono audio (first channel)

            if (inputChannel && inputChannel.length > 0) {
                // Convert float32 audio data to 24-bit PCM
                const pcm24Data = this.float32ToPCM24(inputChannel);

                // Convert to bytes
                const audioBytes = this.pcm24ToBytes(pcm24Data);

                // Send the PCM data to the main thread
                this.port.postMessage({
                    type: 'audioData',
                    data: audioBytes,
                    sampleRate: this.sampleRate,
                    channels: 1,
                    bitDepth: this.bitDepth,
                    samplesCount: inputChannel.length
                });
            }
        }

        // Return true to keep the processor alive
        return true;
    }
}

registerProcessor('audio-processor', AudioProcessor);
