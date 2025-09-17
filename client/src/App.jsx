import ChatWidget from "./components/ChatWidget";
import ErrorMessage from "./components/ErrorMessage";
import { ChatProvider } from "./contexts/ChatContext";
import { useEffect, useState } from "react";

function App() {
  const [conversationId, setConversationId] = useState(null);

  useEffect(() => {
    // Parse query string to get conversationId
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("conversationId");
    setConversationId(id);
  }, []);

  return (
    <ChatProvider>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        {conversationId ? (
          <ChatWidget
            wsUrl="ws://localhost:8000/chat/ws"
            conversationId={conversationId}
          />
        ) : (
          <ErrorMessage />
        )}
      </div>
    </ChatProvider>
  );
}

export default App;
