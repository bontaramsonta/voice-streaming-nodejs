import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useCallback, useMemo } from "react";

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
}

interface TextChatPanelProps {
  isOpen: boolean;
  sendMessage?: (message: string) => void;
}

export default function TextChatPanel({
  isOpen,
  sendMessage,
}: TextChatPanelProps) {
  const [inputMessage, setInputMessage] = useState("");

  // Demo messages - memoized to prevent recreation
  const messages = useMemo<ChatMessage[]>(
    () => [
      {
        id: "1",
        content: "Hello! How can I help you today?",
        isUser: false,
      },
      {
        id: "2",
        content:
          "Hi! I'm looking for information about your voice chat feature.",
        isUser: true,
      },
    ],
    []
  );

  const handleSendMessage = useCallback(() => {
    if (inputMessage.trim()) {
      sendMessage?.(inputMessage);
      setInputMessage("");
    }
  }, [inputMessage, sendMessage]);

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
