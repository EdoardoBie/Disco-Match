import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Profile, Message } from '@/types';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send } from 'lucide-react';

type ChatViewProps = {
  partner: Profile;
  onClose: () => void;
};

export default function ChatView({ partner, onClose }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user) return;

    // Fetch existing messages
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partner.id}),and(sender_id.eq.${partner.id},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
      } else {
        setMessages(data || []);
      }
    };

    fetchMessages();

    // Subscribe to new messages in real time
    const channel = supabase
      .channel(`chat-${user.id}-${partner.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as Message;
          // Only add messages relevant to this conversation
          if (
            (msg.sender_id === user.id && msg.receiver_id === partner.id) ||
            (msg.sender_id === partner.id && msg.receiver_id === user.id)
          ) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, partner.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const { error } = await supabase.from('messages').insert({
      sender_id: user.id,
      receiver_id: partner.id,
      content,
    });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(content); // Restore on error
    }

    setSending(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-[200] flex flex-col bg-black"
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-4 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </motion.button>
        <div className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white font-black text-sm uppercase overflow-hidden">
          {partner.avatar_url ? (
            <img
              src={partner.avatar_url}
              alt={partner.nickname || ''}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            partner.nickname?.[0] || '?'
          )}
        </div>
        <div>
          <h3 className="font-black text-lg uppercase tracking-tight text-white leading-tight">
            {partner.nickname}
          </h3>
          <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">Match</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center h-full text-center space-y-3"
          >
            <div className="text-5xl">👋</div>
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest">
              Inizia la conversazione!
            </p>
            <p className="text-zinc-700 text-xs">
              Scrivi il primo messaggio a {partner.nickname}
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                    isMine
                      ? 'bg-white text-black rounded-br-md'
                      : 'bg-white/10 text-white rounded-bl-md border border-white/5'
                  }`}
                >
                  <p className="text-sm font-medium leading-relaxed break-words">{msg.content}</p>
                  <p
                    className={`text-[10px] mt-1 font-bold tracking-wider ${
                      isMine ? 'text-zinc-400' : 'text-zinc-600'
                    }`}
                  >
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio..."
            className="flex-1 bg-white/5 border border-white/10 rounded-full px-5 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/30 transition-colors font-medium"
            autoFocus
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-opacity"
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
