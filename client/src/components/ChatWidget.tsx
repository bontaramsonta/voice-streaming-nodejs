import {
  Mic,
  Settings,
  PhoneOff,
  MessageCircle,
  MessageCircleOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChatContext } from "@/contexts/ChatContext";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import TextChatPanel from "./TextChatPanel";

interface ChatWidgetProps {
  wsUrl: string;
  conversationId: string;
}

export default function ChatWidget({ wsUrl, conversationId }: ChatWidgetProps) {
  const { state } = useChatContext();
  const { startChat, endChat } = useVoiceChat(wsUrl, conversationId);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const handleMicClick = useCallback(async () => {
    if (state.isRecording) {
      await endChat();
    } else {
      await startChat();
    }
  }, [state.isRecording, endChat, startChat]);

  const handleSettingsClick = useCallback(() => {
    console.log("Settings clicked - no functionality yet");
  }, []);

  const handleChatClick = useCallback(() => {
    setIsChatOpen(!isChatOpen);
  }, [isChatOpen]);

  return (
    <div className="relative">
      <div
        className={
          "bg-white rounded-xl shadow-lg border border-gray-200 p-3 min-w-3xs w-sm"
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleMicClick}
              disabled={state.isConnected === false && state.isRecording}
              size="lg"
              className={cn(
                "w-12 h-12 rounded-full p-0",
                state.isRecording
                  ? "bg-red-500 hover:bg-red-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              )}
            >
              {state.isRecording ? (
                <PhoneOff className="w-6 h-6" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </Button>
            <Button
              onClick={handleChatClick}
              size="lg"
              className={cn(
                "w-12 h-12 rounded-full p-0 text-white transition-colors",
                isChatOpen
                  ? "bg-gray-300 hover:bg-gray-400"
                  : "bg-blue-500 hover:bg-blue-600"
              )}
            >
              {isChatOpen ? (
                <MessageCircleOff className="w-6 h-6" />
              ) : (
                <MessageCircle className="w-6 h-6" />
              )}
            </Button>
            <div>
              <h3 className="font-semibold text-gray-900">Voice Chat (WS)</h3>
              <div className="text-xs font-medium text-gray-500">
                {state.isRecording ? (
                  <div>
                    <div
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-full",
                        state.isSpeaking
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          state.isSpeaking
                            ? "bg-green-500 animate-pulse"
                            : "bg-gray-400"
                        )}
                      />
                      {state.isSpeaking ? "Speaking..." : "Listening..."}
                    </div>
                  </div>
                ) : (
                  <div className="py-1">lets chat or talk</div>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleSettingsClick}
            className="text-gray-400 hover:text-gray-600"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Text Chat Panel */}
      <TextChatPanel isOpen={isChatOpen} />
    </div>
  );
}
