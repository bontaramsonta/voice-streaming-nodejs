import "./style.css";

async function getMediaPermissions() {
  try {
    const stream = navigator.mediaDevices.getUserMedia({
      video: false,
      audio: true,
    });
    return stream;
  } catch (err) {
    if (err instanceof Error) {
      console.error(`you got an error: ${err}`);
    }
  }
}

async function getAudioDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices;
  } catch (err) {
    if (err instanceof Error) {
      console.error(`${err.name}: ${err.message}`);
    }
    return [];
  }
}

// const s = await getMediaPermissions();
// console.log(s);
// const devices = await getAudioDevices();
// console.log({ devices });

const CONTROL_MESSAGES = {
  RECORD_START: 0x01,
  RECORD_END: 0x02,
} as const;

class AudioRecorder {
  websocket: WebSocket | null;
  mediaRecorder: MediaRecorder | null;
  stream: MediaStream | null;
  recording: boolean;
  devices: MediaDeviceInfo[] | [];

  recordButton: HTMLElement;
  testButton: HTMLElement;
  deviceSelect: HTMLElement;
  statusDiv: HTMLElement;

  constructor() {
    this.websocket = null;
    this.mediaRecorder = null;
    this.stream = null;
    this.recording = false;
    this.devices = [];

    this.recordButton = document.getElementById("recordButton")!;
    this.testButton = document.getElementById("testButton")!;
    this.deviceSelect = document.getElementById("deviceSelect")!;
    this.statusDiv = document.getElementById("status")!;

    this.init();
  }

  async init() {
    try {
      await this.loadDevices();
      this.setupWebSocket();
      this.setupEventListeners();
    } catch (error) {
      this.updateStatus("Error initializing: " + error.message, "error");
    }
  }

  async loadDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.devices = devices.filter((device) => device.kind === "audioinput");

      this.deviceSelect.innerHTML = "";
      if (this.devices.length === 0) {
        this.deviceSelect.innerHTML = "<option>No audio devices found</option>";
        return;
      }

      this.devices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.textContent =
          device.label || `Device ${device.deviceId.substr(0, 8)}`;
        this.deviceSelect.appendChild(option);
      });
    } catch (error) {
      console.error("Error loading devices:", error);
      this.deviceSelect.innerHTML = "<option>Error loading devices</option>";
    }
  }

  setupWebSocket() {
    this.websocket = new WebSocket("ws://localhost:7860");
    this.websocket.binaryType = "arraybuffer";

    this.websocket.onopen = () => {
      this.updateStatus("Connected to server", "connected");
      this.recordButton.disabled = false;
      this.testButton.disabled = false;
    };

    this.websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.event === "recording-started") {
        this.updateStatus("Recording in progress...", "recording");
      } else if (message.event === "recording-saved") {
        this.updateStatus(
          `Recording saved as ${message.filename}`,
          "connected",
        );
      } else if (message.event === "error") {
        this.updateStatus("Server error: " + message.message, "error");
      }
    };

    this.websocket.onclose = () => {
      this.updateStatus("Disconnected from server", "error");
      this.recordButton.disabled = true;
      this.testButton.disabled = true;
    };

    this.websocket.onerror = (error) => {
      this.updateStatus("WebSocket error", "error");
      console.error("WebSocket error:", error);
    };
  }

  async getMediaStream() {
    const deviceId = this.deviceSelect.value;
    const constraints = {
      audio: deviceId ? { deviceId: { exact: deviceId } } : true,
      video: false,
    };

    return await navigator.mediaDevices.getUserMedia(constraints);
  }

  sendControlMessage(command: number) {
    const buffer = new ArrayBuffer(1);
    const view = new Uint8Array(buffer);

    view[0] = command;

    this.websocket!.send(buffer);
  }

  async startRecording() {
    try {
      this.stream = await this.getMediaStream();

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: "audio/webm;codecs=opus",
        // audioBitsPerSecond: 64_000, // high quality
        // audioBitsPerSecond: 32_000, // mid
        // audioBitsPerSecond: 16_000, // lower
        audioBitsPerSecond: 8_000, // even lower (lowest)
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        if (
          event.data.size > 1 &&
          this.websocket!.readyState === WebSocket.OPEN
        ) {
          const buffer = await event.data.arrayBuffer();
          this.websocket!.send(buffer);
        }
      };

      // Send start recording event
      this.sendControlMessage(CONTROL_MESSAGES.RECORD_START);

      // Start recording in 500ms chunks
      this.mediaRecorder.start(500);
      this.recording = true;

      this.recordButton.textContent = "Stop Recording";
      this.recordButton.classList.add("recording");
      this.testButton.disabled = true;
      this.deviceSelect.disabled = true;
    } catch (error) {
      this.updateStatus("Error starting recording: " + error.message, "error");
      console.error("Recording error:", error);
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.recording) {
      this.mediaRecorder.stop();
      this.recording = false;

      // Send stop recording event
      this.sendControlMessage(CONTROL_MESSAGES.RECORD_END);

      this.recordButton.textContent = "Start Recording";
      this.recordButton.classList.remove("recording");
      this.testButton.disabled = false;
      this.deviceSelect.disabled = false;

      // Stop the stream
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
    }
  }

  //------------------

  setupEventListeners() {
    this.recordButton.addEventListener("click", () => {
      if (this.recording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });

    this.testButton.addEventListener("click", () => {
      this.testMicrophone();
    });

    this.deviceSelect.addEventListener("change", () => {
      if (this.recording) {
        alert("Cannot change device while recording");
        return;
      }
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }
    });
  }

  async testMicrophone() {
    try {
      const stream = await this.getMediaStream();
      this.updateStatus("Microphone test - speak now...", "recording");

      setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop());
        this.updateStatus("Microphone test completed", "connected");
      }, 3000);
    } catch (error) {
      this.updateStatus("Microphone test failed: " + error.message, "error");
    }
  }

  updateStatus(message: string, type = "") {
    this.statusDiv.textContent = message;
    this.statusDiv.className = type ? `status-${type}` : "";
  }
}

// Initialize the recorder when page loads
document.addEventListener("DOMContentLoaded", () => {
  new AudioRecorder();
});
