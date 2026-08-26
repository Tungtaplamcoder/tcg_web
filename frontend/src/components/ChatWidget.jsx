import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, Headset } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import api from '../services/api';
import { getSocket, onSocketEvent, emitSocketEvent } from '../services/socket';

const ChatWidget = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [roomId, setRoomId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const socketStatusRef = useRef(false);
  const socketHandlersRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Remove socket status handlers on unmount
  useEffect(() => {
    return () => {
      if (socketHandlersRef.current) {
        const socket = getSocket();
        if (socket) {
          socket.off('connect', socketHandlersRef.current.onConnect);
          socket.off('disconnect', socketHandlersRef.current.onDisconnect);
        }
        socketHandlersRef.current = null;
      }
    };
  }, []);

  // Initialize chat when opened and authenticated
  const initializeChat = useCallback(async () => {
    if (!isAuthenticated) return;

    setIsLoading(true);
    setError('');
    try {
      // 1. Track socket connection status (register handlers once, cleaned up on unmount)
      const socket = getSocket();
      if (socket && !socketHandlersRef.current) {
        const onConnect = () => { socketStatusRef.current = true; };
        const onDisconnect = () => { socketStatusRef.current = false; };
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socketHandlersRef.current = { onConnect, onDisconnect };
        if (socket.connected) socketStatusRef.current = true;
      }

      // 2. Fetch or create chat room
      const roomsResponse = await api.get('/chat/rooms');
      const rooms = roomsResponse.data.data;
      let targetRoom = null;
      if (rooms && rooms.length > 0) {
        targetRoom = rooms.find(r => r.status === 'OPEN') || rooms[0];
      }

      if (!targetRoom) {
        const createResponse = await api.post('/chat/rooms', { subject: 'General Support' });
        targetRoom = createResponse.data.data.room;
      }

      setRoomId(targetRoom.id);

      // 3. Join socket room
      if (socket) {
        emitSocketEvent('chat:join', { roomId: targetRoom.id });
      }

      // 4. Load messages
      const messagesResponse = await api.get(`/chat/rooms/${targetRoom.id}/messages?page=1&limit=50`);
      setMessages(messagesResponse.data.data.items || []);
    } catch (err) {
      console.error('Failed to initialize chat:', err.response?.data?.error?.message || err.message);
      setError('Failed to load chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Handle opening chat
  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      initializeChat();
    }
  };

  // Listen for incoming messages
  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;

    const cleanupMessage = onSocketEvent('chat:message', (message) => {
      if (message.roomId === roomId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    const cleanupTyping = onSocketEvent('chat:typing', (data) => {
      // Optional: show typing indicator (not implemented)
    });

    return () => {
      cleanupMessage();
      cleanupTyping();
    };
  }, [isOpen, isAuthenticated, roomId]);

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !roomId) return;

    const content = input.trim();
    setInput('');

    try {
      // Try via socket first
      const socket = getSocket();
      if (socket && socket.connected) {
        emitSocketEvent('chat:message', { roomId, content });
      } else {
        // Fallback to REST
        const response = await api.post(`/chat/rooms/${roomId}/messages`, { content });
        setMessages((prev) => [...prev, response.data.data]);
      }
    } catch (err) {
      console.error('Failed to send message:', err.response?.data?.error?.message || err.message);
      setError('Failed to send message. Please try again.');
    }
  };

  // Close chat and leave room
  const handleClose = () => {
    if (roomId) {
      emitSocketEvent('chat:leave', { roomId });
    }
    setIsOpen(false);
  };

  const launcherButton = (
    <button
      onClick={handleOpen}
      className="relative h-14 w-14 rounded-full bg-brand-gradient text-white flex items-center justify-center shadow-glow-lg transition-all duration-300 hover:scale-110 active:scale-95"
      aria-label="Support chat"
    >
      <span className="absolute inset-0 rounded-full ring-1 ring-inset ring-white/25" />
      {isOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      {!isOpen && (
        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white" />
      )}
    </button>
  );

  if (!isAuthenticated) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
        {isOpen && (
          <div className="w-80 rounded-2xl bg-white/95 backdrop-blur-xl border border-ink-100 shadow-2xl shadow-ink-900/15 p-5 animate-tcg-scale-in origin-bottom-right">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-brand-gradient-soft ring-1 ring-primary-200/60 flex items-center justify-center">
                <Headset className="h-5 w-5 text-primary-700" />
              </div>
              <p className="font-display font-bold text-ink-900">Support Chat</p>
            </div>
            <p className="text-sm text-ink-500 leading-relaxed">
              Please log in to chat with our support team.
            </p>
            <button
              onClick={() => (window.location.href = '/login')}
              className="btn-primary w-full mt-4 !py-2.5 text-sm"
            >
              Go to Login
            </button>
          </div>
        )}
        {launcherButton}
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4">
      {isOpen && (
        <div
          className="w-80 sm:w-96 flex flex-col rounded-2xl overflow-hidden bg-white/90 backdrop-blur-xl border border-ink-100 shadow-2xl shadow-ink-900/15 animate-tcg-scale-in origin-bottom-right"
          style={{ height: '500px', maxHeight: '80vh' }}
        >
          {/* Header */}
          <div className="relative flex items-center justify-between px-5 py-4 bg-ink-950 text-white">
            <div className="absolute inset-0 bg-brand-gradient opacity-90" />
            <div className="relative flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur flex items-center justify-center">
                <Headset className="h-[18px] w-[18px] text-white" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm">Support Chat</h3>
                <p className="text-[11px] text-white/70 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  We typically reply within minutes
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="relative p-1.5 rounded-lg hover:bg-white/15 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-ink-50/80 to-white">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
              </div>
            ) : error ? (
              <div className="text-center text-rose-500 text-sm p-3 rounded-xl bg-rose-50 ring-1 ring-rose-100">{error}</div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="h-12 w-12 rounded-2xl bg-brand-gradient-soft ring-1 ring-primary-200/60 flex items-center justify-center mb-3">
                  <MessageCircle className="h-6 w-6 text-primary-600" />
                </div>
                <p className="text-sm font-medium text-ink-600">No messages yet</p>
                <p className="text-xs text-ink-400 mt-1">Start a conversation!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender?.id === user?.id;
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm animate-tcg-fade-in ${
                        isMine
                          ? 'bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white rounded-br-md'
                          : 'bg-white border border-ink-100 text-ink-800 rounded-bl-md'
                      }`}
                    >
                      {!isMine && (
                        <p className="text-[11px] font-bold mb-1 text-primary-700">
                          {msg.sender?.fullName || 'Support'}
                        </p>
                      )}
                      <p className="leading-relaxed break-words">{msg.content}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? 'text-white/60' : 'text-ink-400'}`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 border-t border-ink-100 bg-white/90 backdrop-blur">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="input-premium !py-2.5 flex-1"
              />
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-11 w-11 flex-shrink-0 rounded-xl bg-gradient-to-r from-primary-600 to-fuchsia-600 text-white flex items-center justify-center shadow-[0_6px_16px_-6px_rgba(124,58,237,0.5)] transition-all duration-300 hover:shadow-glow hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </div>
      )}

      {launcherButton}
    </div>
  );
};

export default ChatWidget;
