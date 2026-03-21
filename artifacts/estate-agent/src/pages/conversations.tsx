import { useState, useRef, useEffect } from "react";
import { useListConversations, useGetConversation, useSendMessage } from "@workspace/api-client-react";
import { Send, Phone, User, Search, MessageCircle, MoreVertical, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Conversations() {
  const [search, setSearch] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  
  const { data: conversations = [], isLoading: isLoadingConversations } = useListConversations({
    search: search || undefined
  });

  const { data: activeConversation, isLoading: isLoadingThread } = useGetConversation(
    activeConversationId as number,
    { query: { enabled: !!activeConversationId } }
  );

  const sendMessageMutation = useSendMessage();

  const [messageText, setMessageText] = useState("");
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  // Auto select first conversation
  useEffect(() => {
    if (conversations.length > 0 && !activeConversationId) {
      setActiveConversationId(conversations[0].id);
    }
  }, [conversations, activeConversationId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversationId) return;

    sendMessageMutation.mutate({
      id: activeConversationId,
      data: { content: messageText }
    }, {
      onSuccess: () => {
        setMessageText("");
      }
    });
  };

  const getChannelIcon = (channel: string) => {
    switch (channel.toLowerCase()) {
      case 'whatsapp': return <MessageCircle size={14} className="text-green-500" />;
      case 'sms': return <MessageSquare size={14} className="text-blue-500" />;
      case 'email': return <Mail size={14} className="text-orange-500" />;
      default: return <MessageSquare size={14} className="text-gray-500" />;
    }
  };

  return (
    <Layout>
      <div className="flex h-[calc(100vh-4rem)]">
        
        {/* Left Sidebar - Conversations List */}
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
              <Badge variant="secondary" className="rounded-full bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer">All</Badge>
              <Badge variant="outline" className="rounded-full cursor-pointer hover:bg-muted">WhatsApp</Badge>
              <Badge variant="outline" className="rounded-full cursor-pointer hover:bg-muted">Active</Badge>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-12 h-12 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-4 bg-muted rounded w-2/3"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
                <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
                <p>No conversations found</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`
                      w-full text-left p-4 flex gap-3 transition-all duration-200
                      ${activeConversationId === conv.id 
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
                        <h4 className="font-semibold text-sm text-foreground truncate pr-2">
                          {conv.contactName}
                        </h4>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {conv.lastMessageAt ? format(new Date(conv.lastMessageAt), "HH:mm") : ""}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${conv.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                          {conv.lastMessage || "Started conversation..."}
                        </p>
                        {conv.unreadCount > 0 && (
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                            {conv.unreadCount}
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

        {/* Right Pane - Chat Thread */}
        <div className="flex-1 flex flex-col bg-background relative">
          {activeConversationId ? (
            isLoadingThread ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              </div>
            ) : activeConversation ? (
              <>
                {/* Chat Header */}
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
                        <span className="w-1 h-1 rounded-full bg-muted-foreground"></span>
                        <span className="capitalize">{activeConversation.channel}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="hidden md:flex gap-2 rounded-xl">
                      <User size={16} /> View Profile
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <MoreVertical size={18} />
                    </Button>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 dark:bg-slate-900/20">
                  <div className="text-center">
                    <span className="text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground font-medium border border-border/50">
                      {activeConversation.createdAt ? format(new Date(activeConversation.createdAt), "MMMM d, yyyy") : "Conversation started"}
                    </span>
                  </div>

                  {activeConversation.messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"} group`}>
                        <div className={`
                          max-w-[75%] md:max-w-[60%] rounded-2xl p-4 shadow-sm relative
                          ${isOutbound 
                            ? "bg-primary text-primary-foreground rounded-tr-sm" 
                            : "bg-card text-card-foreground border border-border/50 rounded-tl-sm"}
                        `}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <div className={`
                            text-[10px] mt-2 text-right opacity-70 flex justify-end items-center gap-1
                            ${isOutbound ? "text-primary-foreground" : "text-muted-foreground"}
                          `}>
                            {format(new Date(msg.sentAt), "HH:mm")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={endOfMessagesRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-card border-t border-border/50">
                  <form 
                    onSubmit={handleSendMessage}
                    className="flex items-end gap-3 max-w-4xl mx-auto"
                  >
                    <div className="flex-1 relative bg-muted/30 rounded-2xl border border-border/50 focus-within:border-primary/50 focus-within:bg-card focus-within:shadow-md transition-all duration-200">
                      <textarea 
                        className="w-full bg-transparent p-4 outline-none resize-none max-h-32 text-sm"
                        placeholder="Type your message..."
                        rows={1}
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
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
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
              <p className="text-center max-w-sm">Select a conversation from the left to start responding to leads, book viewings, and close deals.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Mail icon placeholder since it wasn't imported
function Mail(props: any) {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>;
}
