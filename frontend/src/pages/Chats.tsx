import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, MessageCircle, Send } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, PageLoader } from "@/components/common/States";
import { InitialsAvatar } from "@/components/marketplace/InitialsAvatar";
import { apiGet, apiPost } from "@/lib/api";
import { errMsg } from "@/lib/constants";
import { useMe } from "@/lib/hooks";
import type { ChatMessage, ChatThread } from "@/lib/types";

export function StartExpertChat() {
  const { expertId = "" } = useParams();
  const nav = useNavigate();
  const open = useMutation({
    mutationFn: () => apiPost<ChatThread>(`/chats/experts/${expertId}`),
    onSuccess: (thread) => nav(`/chat/${thread.id}`, { replace: true }),
  });
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      open.mutate();
    }
  }, []);

  return (
    <div className="mx-auto grid min-h-[50vh] max-w-xl place-items-center px-4 py-12">
      {open.isError ? (
        <div className="w-full space-y-4">
          <ErrorState message={errMsg(open.error, "Couldn't open a chat with this expert.")} testId="start-chat-error" />
          <Link to="/explore" className={`${buttonVariants({ variant: "outline" })} mx-auto`}>Back to Explore</Link>
        </div>
      ) : (
        <div className="text-center" role="status" data-testid="start-chat-loading">
          <Loader2 className="mx-auto size-7 animate-spin text-emerald-600" />
          <p className="mt-3 font-semibold text-slate-800">Opening chat…</p>
        </div>
      )}
    </div>
  );
}

export default function Messages() {
  const me = useMe();
  const chats = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiGet<ChatThread[]>("/chats"),
    refetchInterval: 5000,
  });

  if (me.isLoading || chats.isLoading) return <PageLoader label="Loading messages…" />;
  if (chats.isError) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState onRetry={() => void chats.refetch()} testId="messages-error" /></div>;

  const isExpert = me.data?.role === "expert";
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MessageCircle className="size-5" /></span>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900" data-testid="messages-title">Messages</h1>
          <p className="text-sm text-slate-500">Chat directly with {isExpert ? "people interested in your expertise" : "available experts"}.</p>
        </div>
      </div>

      {!chats.data?.length ? (
        <EmptyState title="No conversations yet" description={isExpert ? "New chats from clients will appear here." : "Start a chat from an available expert's card."} action={<Link to="/explore" className={buttonVariants({ variant: "outline" })}>Explore experts</Link>} testId="messages-empty" />
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white" data-testid="messages-list">
          {chats.data.map((chat) => {
            const name = isExpert ? chat.user_name : chat.expert_name;
            const subtitle = isExpert ? chat.expert_profession : chat.expert_profession;
            return (
              <Link key={chat.id} to={`/chat/${chat.id}`} className="flex min-h-20 items-center gap-3 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500" data-testid={`message-thread-${chat.id}`}>
                <InitialsAvatar name={name} photoUrl={isExpert ? null : chat.expert_photo_url} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="truncate font-semibold text-slate-900">{name}</span>
                    <span className="text-xs text-slate-400">{new Date(chat.updated_at).toLocaleDateString()}</span>
                  </span>
                  <span className="block text-xs text-slate-500">{subtitle}</span>
                  <span className="mt-1 block truncate text-sm text-slate-600">{chat.latest_message || "Start the conversation"}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ChatRoom() {
  const { threadId = "" } = useParams();
  const me = useMe();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const thread = useQuery({ queryKey: ["chat", threadId], queryFn: () => apiGet<ChatThread>(`/chats/${threadId}`), enabled: !!threadId });
  const messages = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: () => apiGet<ChatMessage[]>(`/chats/${threadId}/messages`),
    enabled: !!threadId && thread.isSuccess,
    refetchInterval: 3000,
  });
  const send = useMutation({
    mutationFn: (body: string) => apiPost<ChatMessage>(`/chats/${threadId}/messages`, { body }),
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["chat-messages", threadId] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
  const isExpert = me.data?.role === "expert";
  const title = thread.data ? (isExpert ? thread.data.user_name : thread.data.expert_name) : "Conversation";
  const photoUrl = !isExpert ? thread.data?.expert_photo_url : null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.data?.length]);

  if (thread.isLoading || messages.isLoading) return <PageLoader label="Opening conversation…" />;
  if (thread.isError || messages.isError || !thread.data) return <div className="mx-auto max-w-3xl px-4 py-12"><ErrorState message={errMsg(thread.error ?? messages.error)} onRetry={() => { void thread.refetch(); void messages.refetch(); }} testId="chat-error" /></div>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
  };

  return (
    <div className="mx-auto flex min-h-[65vh] max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Link to="/messages" aria-label="Back to messages" className="grid size-10 shrink-0 place-items-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"><ArrowLeft className="size-5" /></Link>
        <InitialsAvatar name={title} photoUrl={photoUrl} size="sm" />
        <div className="min-w-0">
          <h1 className="truncate font-bold text-slate-900" data-testid="chat-title">{title}</h1>
          <p className="truncate text-xs text-slate-500">{thread.data.expert_profession}</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto py-5" aria-live="polite" data-testid="chat-messages">
        {!messages.data?.length ? (
          <p className="py-10 text-center text-sm text-slate-500">Say hello to start the conversation.</p>
        ) : messages.data.map((message) => {
          const mine = message.sender_id === me.data?.id;
          return (
            <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[75%] ${mine ? "rounded-br-md bg-slate-900 text-white" : "rounded-bl-md bg-slate-100 text-slate-900"}`} data-testid={`chat-message-${message.id}`}>
                {!mine && <p className="mb-1 text-[11px] font-semibold text-slate-500">{message.sender_name}</p>}
                <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                <time className={`mt-1 block text-right text-[10px] ${mine ? "text-slate-300" : "text-slate-400"}`} dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 pt-4" data-testid="chat-compose-form">
        {send.isError && <p className="mb-2 text-sm text-rose-600" role="alert">{errMsg(send.error)}</p>}
        <div className="flex items-end gap-2">
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} rows={2} placeholder="Write a message…" aria-label="Write a message" data-testid="chat-message-input" className="min-h-11 resize-y bg-white" />
          <Button type="submit" disabled={!draft.trim() || send.isPending} className="min-h-11 shrink-0" data-testid="chat-send-button">
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} <span className="hidden sm:inline">Send</span>
          </Button>
        </div>
        <p className="mt-1 text-right text-[11px] text-slate-400">Messages are visible only to you and this expert.</p>
      </form>
    </div>
  );
}
