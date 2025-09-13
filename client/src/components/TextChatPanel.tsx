import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useCallback, useMemo } from "react";

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
}

interface TextChatPanelProps {
  isOpen: boolean;
}

export default function TextChatPanel({ isOpen }: TextChatPanelProps) {
  const [inputMessage, setInputMessage] = useState("");

  // Demo messages - memoized to prevent recreation
  const messages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "1",
        content: "Hello! How can I help you today?",
        isUser: false,
        timestamp: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      },
      {
        id: "2",
        content:
          "Hi! I'm looking for information about your voice chat feature.",
        isUser: true,
        timestamp: new Date(Date.now() - 4 * 60 * 1000), // 4 minutes ago
      },
      {
        id: "3",
        content:
          "Great! Our voice chat feature allows real-time audio communication with AI. You can click the microphone button to start a voice conversation. Would you like to know more about any specific aspect?",
        isUser: false,
        timestamp: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
      },
      {
        id: "4",
        content: "That sounds amazing! How does the voice detection work?",
        isUser: true,
        timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
      },
    ],
    []
  );

  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim()) {
      // In a real implementation, you would add the message to the messages array
      console.log("Sending message:", inputMessage);
      setInputMessage("");
    }
  }, [inputMessage]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  const formatTime = useCallback((date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, []);

  return (
    <div
      className={cn(
        "absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden transition-all duration-300 ease-in-out",
        isOpen
          ? "opacity-100 translate-y-0 max-h-96"
          : "opacity-0 -translate-y-4 max-h-0 pointer-events-none"
      )}
    >
      {/* Chat Header */}
      {/* <div className="p-3 border-b border-gray-100">
        <h4 className="font-semibold text-gray-900">Chat</h4>
      </div> */}

      {/* Messages */}
      <div className="h-64 overflow-y-auto p-3 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex",
              message.isUser ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-4/6 px-3 py-2 rounded-lg text-sm",
                message.isUser
                  ? "bg-blue-500 text-white rounded-br-sm text-right"
                  : "bg-gray-100 text-gray-900 rounded-bl-sm"
              )}
            >
              <p>{message.content}</p>
              <p
                className={cn(
                  "text-xs mt-1",
                  message.isUser ? "text-blue-100" : "text-gray-500"
                )}
              >
                {formatTime(message.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="How can I help?"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <Button
            onClick={handleSendMessage}
            size="icon"
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 self-center"
            disabled={!inputMessage.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
