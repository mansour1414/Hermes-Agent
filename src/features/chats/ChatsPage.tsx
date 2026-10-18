import { ChatPanel } from "@/features/chats/ChatPanel";

export default function ChatsPage() {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[88rem] flex-col">
      <ChatPanel />
    </div>
  );
}
