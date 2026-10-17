import { useNavigate } from "react-router-dom";
import { MessageSquarePlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/Button";
import { ChatPanel } from "@/features/chats/ChatPanel";
import { useI18n } from "@/i18n";

export default function ChatsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();

  // "New chat" navigates to /chats?new=1. ChatPanel owns the create-session
  // effect, so it must stay mounted here — replacing it with a placeholder
  // would unmount the only component that reacts to ?new=1.
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[88rem] flex-col">
      <div className="shrink-0">
      <PageHeader
        title={t("chats.title")}
        description={t("chats.subtitle")}
        actions={
          <Button
            leadingIcon={<MessageSquarePlus className="h-4 w-4" />}
            onClick={() => navigate("/chats?new=1")}
          >
            {t("chats.newChat")}
          </Button>
        }
      />
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        <ChatPanel />
      </div>
    </div>
  );
}
