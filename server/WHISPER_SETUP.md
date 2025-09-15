# OpenAI Whisper + GPT-4 + ElevenLabs Integration Setup

## Setup Instructions

1. **Get API Keys**
   - **OpenAI**: Sign up at [OpenAI Platform](https://platform.openai.com) and create an API key
   - **ElevenLabs**: Sign up at [ElevenLabs](https://elevenlabs.io) and create an API key
   - Make sure you have credits in both accounts

2. **Configure Environment Variables**
   ```bash
   # Create .env file in the server directory
   cp .env.example .env
   
   # Edit .env file and add your API keys
   OPENAI_API_KEY=sk-your-actual-openai-api-key-here
   ELEVENLABS_API_KEY=your-actual-elevenlabs-api-key-here
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Run the Server**
   ```bash
   npm run dev
   ```

## How It Works

- When recording starts (RECORD_START), a new conversation session begins with chat history initialized
- When a user starts speaking, audio chunks are accumulated
- **Smart Interruption**: If the user starts speaking while transcription/GPT/TTS processing is happening, the ongoing operation is immediately cancelled
- When the user pauses (USER_PAUSED message), the accumulated audio is sent to OpenAI Whisper-1 model
- The transcription is added to the conversation history as a "user" message
- The transcription is then sent to GPT-4o-mini along with the full conversation history for context-aware responses
- GPT-4's response is added to the conversation history as an "assistant" message
- **Text-to-Speech**: The GPT-4 response is converted to audio using ElevenLabs and streamed back to the client in real-time chunks
- This maintains conversation context throughout the entire recording session
- Server sends status updates to client (processing, interrupted, done)
- Both the transcription and GPT-4 response are printed to the console with emojis for easy identification:
  - 🎤 Indicates transcription is starting
  - 📝 Shows the actual transcription result
  - 💬 Shows current chat history length
  - 🤖 Shows GPT-4 is processing and the response
  - 🔊 Shows text-to-speech conversion and streaming
  - 🚫 Shows when operations are cancelled/interrupted
  - ❌ Shows any errors that occur

## Features

- Real-time transcription on user pause
- **Conversation history tracking** - maintains context throughout the recording session
- **Smart cancellation** - automatically cancels ongoing transcription/GPT/TTS operations when user starts speaking again
- **Text-to-Speech streaming** - converts AI responses to audio using ElevenLabs and streams in real-time chunks
- Context-aware GPT-4 responses that remember previous exchanges
- Automatic conversation session management (resets on RECORD_START)
- Intelligent GPT-4 responses to transcribed speech
- High-quality voice synthesis with customizable voice settings
- Server status communication (processing, interrupted, done)
- Automatic cleanup of temporary audio files and aborted operations
- Error handling and logging
- Uses WAV format optimized for Whisper (16kHz, 24-bit)
- Cost-effective GPT-4o-mini model for responses
- Conversational system prompt for helpful chatbot behavior
- Chat history length tracking and logging

## Console Output Example

```
Recording started for client 1694123456789-abc123def - Chat history initialized
🎤 Transcribing audio for client 1694123456789-abc123def...
📝 Transcription for client 1694123456789-abc123def: "Hi, what's your name?"
💬 Chat history length: 2 messages
🤖 Getting GPT-4 response for client 1694123456789-abc123def...
🤖 GPT-4 Response for client 1694123456789-abc123def: "Hi! I'm Mavis, your AI assistant. How can I help you today?"

🎤 Transcribing audio for client 1694123456789-abc123def...
User started speaking for client 1694123456789-abc123def
� Cancelled ongoing operation for client 1694123456789-abc123def - User started speaking
🚫 Transcription cancelled after Whisper API call for client 1694123456789-abc123def

🎤 Transcribing audio for client 1694123456789-abc123def...
�📝 Transcription for client 1694123456789-abc123def: "What did you just say your name was?"
💬 Chat history length: 4 messages
🤖 Getting GPT-4 response for client 1694123456789-abc123def...
🤖 GPT-4 Response for client 1694123456789-abc123def: "I said my name is Mavis. I'm here to help you with any questions you might have!"

Client disconnected: 1694123456789-abc123def - Conversation ended (4 messages exchanged)
```

## Server Response Control Messages

The server now sends control messages back to the client to indicate processing status:

- **SERVER_PROCESSING (1)**: Transcription/GPT/TTS processing has started
- **SERVER_READY (2)**: Server is ready for input
- **SERVER_INTERRUPTED (3)**: Processing was cancelled due to user speaking
- **SERVER_DONE (4)**: Processing completed successfully

## WebSocket Message Types

The server now sends different types of messages to the client:

- **CONTROL (1)**: Control messages (processing status, interruptions, etc.)
- **AUDIO (2)**: Audio data from client (user speech)
- **TEXT (3)**: Text messages
- **AUDIO_RESPONSE (4)**: Audio response chunks from AI (streamed TTS audio)

## ElevenLabs Voice Configuration

The integration uses the following ElevenLabs settings:
- **Voice ID**: `JBFqnCBsd6RMkjVDRZzb` (default voice)
- **Model**: `eleven_multilingual_v2`
- **Output Format**: `mp3_44100_128`
- **Voice Settings**:
  - Stability: 0
  - Similarity Boost: 1.0
  - Speaker Boost: enabled
  - Speed: 1.0

## System Prompt

The GPT-4 integration uses a helpful chatbot system prompt that makes the AI:
- Friendly and conversational
- Clear and concise in responses
- Professional and informative
- Engaging while remaining helpful
