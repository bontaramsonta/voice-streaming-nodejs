# Voice Streaming WebSocket Application

A real-time voice streaming application that captures audio from a web client and streams it to a Node.js server via WebSocket. Features Voice Activity Detection (VAD) for intelligent audio processing and saves recordings in both PCM and WAV formats.

## What it does

- **Real-time Audio Capture**: Records high-quality audio (48kHz, 24-bit PCM) from browser microphone
- **Voice Activity Detection**: Uses AI-powered VAD to detect when user is speaking vs. silent
- **WebSocket Streaming**: Streams audio data in real-time to server with control messages
- **Smart Recording**: Only transmits audio when speech is detected (reduces bandwidth)
- **Audio Processing**: Converts browser audio to PCM format using AudioWorklet
- **File Storage**: Server saves recordings as both raw PCM and playable WAV files

## Project Structure

```
├── client-vanilla/          # Frontend web client (Vite + TypeScript)
│   ├── src/
│   │   ├── main.ts         # Main client application with VAD integration
│   │   └── audio-processor.js  # AudioWorklet for PCM conversion
│   ├── index.html          # Web interface with recording controls
│   └── package.json        # Client dependencies (@ricky0123/vad-web, vite)
│
└── server/                  # Backend WebSocket server (Node.js + TypeScript)
    ├── index.js            # WebSocket server with audio handling
    └── package.json        # Server dependencies (ws, express)
```

### Key Technologies

- **Client**: Vite, TypeScript, Web Audio API, AudioWorklet, VAD-Web
- **Server**: Node.js, WebSocket (ws), Express, Javascript
- **Audio**: 48kHz 24-bit PCM, WAV file generation
- **AI**: Voice Activity Detection for smart audio processing

The client runs on Vite dev server while the server handles WebSocket connections on port 4000, creating an efficient real-time audio streaming pipeline.
