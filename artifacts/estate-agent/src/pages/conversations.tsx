import { useState, useRef, useEffect } from "react";
import { useListConversations, useGetConversation, useSendMessage, useGetContact } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetConversationQueryKey } from "@workspace/api-client-react";
import { Send, Phone, User, Search, MessageCircle, MoreVertical, MessageSquare, Mail, Home, BedDouble, PoundSterling, MapPin, Tag, Calendar, Bot, UserCheck } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";


export default function Conversations() {
  const [search, setSearch] = useState("");
  const [activePhone, setActivePhone] = useState<string | null>(null);
  const [botFilter, setBotFilter] = useState<"all" | "manual" | "bot">("all");

  const { data: conversations = [], isLoading: isLoadingConversations } = useListConversations({
    search: search || undefined,
  });

  const filteredConversations = conversations.filter((conv) => {
    if (botFilter === "manual") return conv.botPaused;
    if (botFilter === "bot") return !conv.botPaused;
    return true;
  });

  const encodedPhone = activePhone ? encodeURIComponent(activePhone) : "";

  const { data: activeConversation, isLoading: isLoadingThread } = useGetConversation(
    encodedPhone,
    { query: { enabled: !!activePhone } }
  );

  const sendMessageMutation = useSendMessage();

  const [profileOpen, setProfileOpen] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);
  const [messageText, setMessageText] = useState("");
  const queryClient = useQueryClient();
  const [sendError, setSendError] = useState<string | null>(null);

  const botPaused = activeConversation?.botPaused ?? false;

  const toggleBotMode = async () => {
    if (!activePhone) return;
    setTogglingBot(true);
    try {
      await fetch(`/api/conversations/${encodeURIComponent(activePhone)}/bot-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paused: !botPaused }),
      });
      queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(encodeURIComponent(activePhone)) });
    } finally {
      setTogglingBot(false);
    }
  };

  const { data: contactProfile } = useGetContact(
    activePhone ? encodeURIComponent(activePhone) : "",
    { query: { enabled: !!activePhone && profileOpen } }
  );
  const [optimisticMessages, setOptimisticMessages] = useState<
    { id: string; direction: string; content: string; sentAt: string; role: string; senderName: string; conversationId: string }[]
  >([]);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Reset optimistic messages when switching conversations
  useEffect(() => {
    setOptimisticMessages([]);
  }, [activePhone]);

  useEffect(() => {
    if (conversations.length > 0 && !activePhone) {
      setActivePhone(conversations[0].id);
    }
  }, [conversations, activePhone]);

  const allMessages = [...(activeConversation?.messages ?? []), ...optimisticMessages];

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activePhone) return;

    const text = messageText.trim();
    setMessageText("");

    // Optimistically show the message immediately
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      conversationId: activePhone,
      direction: "outbound",
      role: "user",
      content: text,
      senderName: "Agent",
      sentAt: new Date().toISOString(),
    };
    setOptimisticMessages((prev) => [...prev, optimistic]);

    setSendError(null);
    sendMessageMutation.mutate(
      { id: encodeURIComponent(activePhone), data: { content: text } },
      {
        onError: (err: unknown) => {
          setOptimisticMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
          setMessageText(text);
          const msg =
            err instanceof Error ? err.message : "Failed to send message. Please try again.";
          setSendError(msg);
          setTimeout(() => setSendError(null), 5000);
        },
      }
    );
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case "whatsapp": return <MessageCircle size={14} className="text-green-500" />;
      case "sms": return <MessageSquare size={14} className="text-blue-500" />;
      case "email": return <Mail width={14} height={14} className="text-orange-500" />;
      default: return <MessageSquare size={14} className="text-gray-500" />;
    }
  };

  return (
    <Layout>
      {/* Contact Profile Sheet */}
      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Contact Profile</SheetTitle>
          </SheetHeader>
          {contactProfile ? (
            <div className="mt-6 space-y-6">
              <div className="flex flex-col items-center gap-3 text-center">
                <Avatar className="w-16 h-16 text-xl border-2 border-border">
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {contactProfile.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-lg">{contactProfile.name}</p>
                  {contactProfile.status && (
                    <Badge variant="secondary" className="mt-1 capitalize">{contactProfile.status}</Badge>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone size={15} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{contactProfile.phone}</p>
                  </div>
                </div>
                {contactProfile.email && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Mail size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{contactProfile.email}</p>
                    </div>
                  </div>
                )}
                {contactProfile.leadIntent && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <User size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Intent</p>
                      <p className="text-sm font-medium capitalize">{contactProfile.leadIntent}</p>
                    </div>
                  </div>
                )}
                {contactProfile.budget && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <PoundSterling size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="text-sm font-medium">{contactProfile.budget}</p>
                    </div>
                  </div>
                )}
                {contactProfile.bedrooms && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <BedDouble size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Bedrooms</p>
                      <p className="text-sm font-medium">{contactProfile.bedrooms}</p>
                    </div>
                  </div>
                )}
                {contactProfile.enquiryPostcode && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <MapPin size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Postcode</p>
                      <p className="text-sm font-medium">{contactProfile.enquiryPostcode}</p>
                    </div>
                  </div>
                )}
                {contactProfile.propertyInMind && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Home size={15} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Property in mind</p>
                      <p className="text-sm font-medium">{contactProfile.propertyInMind}</p>
                    </div>
                  </div>
                )}
                {contactProfile.tags.length > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Tag size={15} className="text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-muted-foreground mb-1.5">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {contactProfile.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {contactProfile.summary && (
                  <div className="p-3 rounded-lg bg-muted/50 space-y-1">
                    <p className="text-xs text-muted-foreground">Summary</p>
                    <p className="text-sm leading-relaxed">{contactProfile.summary}</p>
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Calendar size={15} className="text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{format(new Date(contactProfile.createdAt), "d MMM yyyy")}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-12 flex flex-col items-center text-muted-foreground gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm">Loading profile…</p>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="flex h-[calc(100vh-4rem)]">

        {/* Left Sidebar */}
        <div className="w-80 border-r border-border/50 flex flex-col bg-card/30">
          <div className="p-4 border-b border-border/50 space-y-4 bg-card/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                placeholder="Search conversations..."
                className="pl-10 bg-background/50 border-border/50 rounded-xl"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              <Badge
                variant={botFilter === "all" ? "secondary" : "outline"}
                className={`rounded-full cursor-pointer ${botFilter === "all" ? "bg-primary/10 text-primary hover:bg-primary/20" : "hover:bg-muted"}`}
                onClick={() => setBotFilter("all")}
              >All</Badge>
              <Badge
                variant={botFilter === "manual" ? "secondary" : "outline"}
                className={`rounded-full cursor-pointer ${botFilter === "manual" ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200" : "hover:bg-muted"}`}
                onClick={() => setBotFilter("manual")}
              >Manual Mode</Badge>
              <Badge
                variant={botFilter === "bot" ? "secondary" : "outline"}
                className={`rounded-full cursor-pointer ${botFilter === "bot" ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : "hover:bg-muted"}`}
                onClick={() => setBotFilter("bot")}
              >Bot Active</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-muted rounded-full" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-muted rounded w-2/3" />
                      <div className="h-3 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                <p>No conversations found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {filteredConversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActivePhone(conv.id)}
                    className={`
                      w-full text-left p-4 flex gap-3 transition-all duration-200
                      ${activePhone === conv.id
                        ? "bg-primary/5 border-l-2 border-l-primary"
                        : "hover:bg-muted/50 border-l-2 border-l-transparent"}
                    `}
                  >
                    <div className="relative">
                      <Avatar className="w-12 h-12 border border-border/50">
                        <AvatarFallback className="bg-primary/10 text-primary font-medium">
                          {conv.contactName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border">
                        {getChannelIcon(conv.channel)}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {conv.contactName}
                          </h4>
                          {conv.botPaused && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 text-[9px] font-semibold text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-1.5 py-0.5">
                              <UserCheck size={9} /> Manual
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-1">
                          {conv.lastMessageAt ? format(new Date(conv.lastMessageAt.endsWith("Z") || conv.lastMessageAt.includes("+") ? conv.lastMessageAt : conv.lastMessageAt + "Z"), "HH:mm") : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs truncate text-muted-foreground">
                          {conv.lastMessage
                            ? conv.lastMessage.substring(0, 60) + (conv.lastMessage.length > 60 ? "…" : "")
                            : "No messages yet"}
                        </p>
                        {"messageCount" in conv && (conv.messageCount as number) > 0 && (
                          <span className="bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {conv.messageCount as number}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Pane */}
        <div className="flex-1 flex flex-col bg-background relative">
          {activePhone ? (
            isLoadingThread ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              </div>
            ) : activeConversation ? (
              <>
                {/* Header */}
                <div className="h-16 px-6 border-b border-border/50 bg-card/80 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10 shadow-sm">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-10 h-10 shadow-sm">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {activeConversation.contactName.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground">{activeConversation.contactName}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone size={12} />
                        <span>{activeConversation.contactPhone}</span>
                        <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                        <span className="capitalize">{activeConversation.channel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={togglingBot}
                      onClick={toggleBotMode}
                      className={`hidden md:flex gap-2 rounded-xl transition-colors ${
                        botPaused
                          ? "border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-700"
                          : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-700"
                      }`}
                    >
                      {botPaused ? <><UserCheck size={16} /> Manual Mode</> : <><Bot size={16} /> Bot Active</>}
                    </Button>
                    <Button variant="outline" size="sm" className="hidden md:flex gap-2 rounded-xl" onClick={() => setProfileOpen(true)}>
                      <User size={16} /> View Profile
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <MoreVertical size={18} />
                    </Button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 dark:bg-slate-900/20">
                  {allMessages.map((msg, i) => {
                    const isOutbound = msg.direction === "outbound";
                    const rawAt = msg.sentAt.endsWith("Z") || msg.sentAt.includes("+") ? msg.sentAt : msg.sentAt + "Z";
                    const msgDate = new Date(rawAt);
                    const prevMsg = allMessages[i - 1];
                    const prevDate = prevMsg ? new Date(prevMsg.sentAt) : null;
                    const showDateSeparator =
                      !prevDate ||
                      format(msgDate, "yyyy-MM-dd") !== format(prevDate, "yyyy-MM-dd");

                    const today = new Date();
                    const yesterday = new Date(today);
                    yesterday.setDate(yesterday.getDate() - 1);

                    let dateLabel: string;
                    if (format(msgDate, "yyyy-MM-dd") === format(today, "yyyy-MM-dd")) {
                      dateLabel = "Today";
                    } else if (format(msgDate, "yyyy-MM-dd") === format(yesterday, "yyyy-MM-dd")) {
                      dateLabel = "Yesterday";
                    } else {
                      dateLabel = format(msgDate, "EEEE, MMMM d, yyyy");
                    }

                    return (
                      <div key={msg.id}>
                        {showDateSeparator && (
                          <div className="flex items-center gap-3 my-4">
                            <div className="flex-1 h-px bg-border/50" />
                            <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground font-medium border border-border/50 whitespace-nowrap">
                              {dateLabel}
                            </span>
                            <div className="flex-1 h-px bg-border/50" />
                          </div>
                        )}
                        <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`
                              max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 shadow-sm
                              ${isOutbound
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-card text-card-foreground border border-border/50 rounded-tl-sm"}
                            `}
                          >
                            <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-li:my-0 prose-headings:my-1 prose-a:underline [&_a]:break-all">
                              <ReactMarkdown
                                components={{
                                  a: ({ href, children }) => (
                                    <a href={href} target="_blank" rel="noopener noreferrer" className={isOutbound ? "text-primary-foreground opacity-90" : "text-primary"}>
                                      {children}
                                    </a>
                                  ),
                                }}
                              >
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                            <div className={`text-[10px] mt-1.5 text-right opacity-60 ${isOutbound ? "text-primary-foreground" : "text-muted-foreground"}`}>
                              {format(msgDate, "HH:mm")}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endOfMessagesRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-card border-t border-border/50">
                  {sendError && (
                    <div className="mb-3 px-4 py-2 bg-destructive/10 text-destructive text-sm rounded-xl border border-destructive/20 max-w-4xl mx-auto">
                      {sendError}
                    </div>
                  )}
                  <form onSubmit={handleSendMessage} className="flex items-end gap-3 max-w-4xl mx-auto">
                    <div className="flex-1 relative bg-muted/30 rounded-2xl border border-border/50 focus-within:border-primary/50 focus-within:bg-card focus-within:shadow-md transition-all duration-200">
                      <textarea
                        className="w-full bg-transparent p-4 outline-none resize-none max-h-32 text-sm"
                        placeholder="Type a reply..."
                        rows={1}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage(e);
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={!messageText.trim() || sendMessageMutation.isPending}
                      className="rounded-2xl h-12 w-12 p-0 flex items-center justify-center shrink-0 shadow-lg shadow-primary/25 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      {sendMessageMutation.isPending ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send size={20} className="ml-1" />
                      )}
                    </Button>
                  </form>
                </div>
              </>
            ) : null
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
              <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mb-6">
                <MessageSquare className="w-10 h-10 text-primary/40" />
              </div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">Your Conversations</h2>
              <p className="text-center max-w-sm">Select a conversation from the left to view the full message history with your leads.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
