import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Loader2,
  AlertCircle,
  Send,
  User,
  Clock,
  CheckCircle2,
  ChevronDown,
  Lock,
  Unlock
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { getSocket, onSocketEvent, emitSocketEvent } from '../../services/socket';

const StaffChatInbox = () => {
  const { user } = useAuthStore();
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [messagesLoaded, setMessagesLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const statusMenuRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll when new messages arrive, and after a room's history loads
  useEffect(() => {
    if (messagesLoaded) scrollToBottom();
  }, [messages, messagesLoaded]);

  // Close status dropdown when clicking outside
  useEffect(() => {
    if (!statusMenuOpen) return undefined;
    const handleClickOutside = (e) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [statusMenuOpen]);

  // Initialize socket connection
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const onConnect = () => setSocketConnected(true);
      const onDisconnect = () => setSocketConnected(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (socket.connected) setSocketConnected(true);
    }
    // Join admin chat room for new room notifications
    emitSocketEvent('chat:join', { roomId: 'admin' });
    return () => {
      const s = getSocket();
      if (s) {
        s.off('connect');
        s.off('disconnect');
      }
    };
  }, []);

  // Fetch chat rooms
  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError('');
    try {
      const response = await api.get('/admin/chat/rooms');
      // Defensive: filter out rooms without any message (empty sessions
      // must never appear in the CSKH queue).
      const data = response.data.data || [];
      setRooms(data.filter((room) => (room._count?.messages || 0) > 0));
    } catch (err) {
      console.error('Failed to fetch chat rooms:', err);
      setError('Failed to load chat rooms.');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Listen for new room creation
  useEffect(() => {
    const cleanup = onSocketEvent('chat:new_room', () => {
      fetchRooms();
    });
    return cleanup;
  }, [fetchRooms]);

  // Real-time: keep status badges in sync across admin/staff clients
  useEffect(() => {
    const cleanup = onSocketEvent('chat:status_updated', ({ roomId, status }) => {
      setRooms((prev) => prev.map((r) => (r.id === roomId ? { ...r, status } : r)));
      setSelectedRoom((prev) => (prev && prev.id === roomId ? { ...prev, status } : prev));
    });
    return cleanup;
  }, []);

  // Fetch messages for selected room
  const fetchMessages = async (roomId) => {
    setLoadingMessages(true);
    setMessagesLoaded(false);
    setError('');
    try {
      const response = await api.get(`/admin/chat/rooms/${roomId}/messages`);
      setMessages(response.data.data.messages || []);
      // Join the specific chat room socket
      emitSocketEvent('chat:join', { roomId });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Failed to load messages.');
    } finally {
      setLoadingMessages(false);
      setMessagesLoaded(true);
    }
  };

  // Handle room selection
  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    setMessagesLoaded(false);
    if (room) {
      fetchMessages(room.id);
    }
  };

  // Listen for incoming messages
  useEffect(() => {
    if (!selectedRoom) return;
    const cleanup = onSocketEvent('chat:message', (message) => {
      if (message.roomId === selectedRoom.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message]
        );
      }
    });
    return cleanup;
  }, [selectedRoom]);

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !selectedRoom) return;

    const content = input.trim();
    setInput('');

    try {
      const socket = getSocket();
      if (socket && socket.connected) {
        emitSocketEvent('chat:message', { roomId: selectedRoom.id, content });
      } else {
        // REST fallback
        const response = await api.post(`/chat/rooms/${selectedRoom.id}/messages`, { content });
        setMessages((prev) => [...prev, response.data.data]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message.');
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedRoom || updatingStatus) return;
    setStatusMenuOpen(false);
    if (selectedRoom.status === status) return;

    setUpdatingStatus(true);
    setError('');
    const previousStatus = selectedRoom.status;
    // Optimistic update; revert on failure
    setSelectedRoom((prev) => ({ ...prev, status }));
    setRooms((prev) => prev.map((r) => (r.id === selectedRoom.id ? { ...r, status } : r)));

    try {
      const response = await api.patch(`/admin/chat/rooms/${selectedRoom.id}/status`, { status });
      const updated = response.data.data;
      setSelectedRoom((prev) => (prev && prev.id === updated.id ? { ...prev, status: updated.status } : prev));
      setRooms((prev) => prev.map((r) => (r.id === updated.id ? { ...r, status: updated.status } : r)));
    } catch (err) {
      console.error('Failed to update room status:', err);
      setSelectedRoom((prev) => (prev && prev.id === selectedRoom.id ? { ...prev, status: previousStatus } : prev));
      setRooms((prev) => prev.map((r) => (r.id === selectedRoom.id ? { ...r, status: previousStatus } : r)));
      setError('Failed to update status. Please try again.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Primary room title: the target user's display name (fallback to email)
  const getRoomTitle = (room) => room?.user?.fullName?.trim() || room?.user?.email || 'Unknown customer';

  const filteredRooms = rooms.filter(room =>
    room.subject?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Room List */}
      <div className="w-full lg:w-80 bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-primary-600" />
            Chat CSKH
          </h2>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-slate-400 text-sm">No chat rooms found.</div>
          ) : (
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className={`w-full text-left p-3 border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${
                  selectedRoom?.id === room.id ? 'bg-primary-50 dark:bg-primary-900/30 border-l-4 border-primary-600' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  {/* Primary title: user display name / email — no fixed "General Support" text */}
                  <span className="font-medium text-gray-800 dark:text-white truncate">{getRoomTitle(room)}</span>
                  {room.status === 'OPEN' ? (
                    <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                </div>
                <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-slate-400">
                  <User className="h-3 w-3 mr-1" />
                  <span className="truncate">{room.user?.email || room.user?.fullName || 'Unknown'}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                  {room._count?.messages || 0} messages
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-lg shadow overflow-hidden flex flex-col">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-slate-400">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300 dark:text-slate-600" />
              <p className="mt-4">Select a chat room to view conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <div className="min-w-0">
                {/* Primary title: target user's display name / email */}
                <h3 className="font-semibold text-gray-800 dark:text-white truncate">{getRoomTitle(selectedRoom)}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 truncate">
                  {selectedRoom.user?.fullName ? `${selectedRoom.user.fullName} · ` : ''}
                  {selectedRoom.user?.email}
                </p>
              </div>

              {/* Interactive status toggle (top-right) */}
              <div className="relative shrink-0" ref={statusMenuRef}>
                <button
                  type="button"
                  onClick={() => setStatusMenuOpen((open) => !open)}
                  disabled={updatingStatus}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-60 ${
                    selectedRoom.status === 'OPEN'
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:hover:bg-yellow-500/30'
                      : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-500/20 dark:text-green-300 dark:hover:bg-green-500/30'
                  }`}
                >
                  {selectedRoom.status === 'OPEN'
                    ? <Clock className="h-3.5 w-3.5" />
                    : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {updatingStatus ? '...' : selectedRoom.status}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {statusMenuOpen && (
                  <div className="absolute right-0 mt-1 w-40 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden z-10">
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('OPEN')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Unlock className="h-4 w-4 text-yellow-500" />
                      Re-open (OPEN)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus('CLOSED')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Lock className="h-4 w-4 text-green-500" />
                      Close (CLOSED)
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-slate-900">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-slate-400 py-8">No messages yet.</div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender?.id === user?.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                          isMine
                            ? 'bg-primary-600 text-white'
                            : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-800 dark:text-white'
                        }`}
                      >
                        <p className={`text-xs font-medium mb-1 ${isMine ? 'text-white/80' : 'text-primary-700 dark:text-primary-300'}`}>
                          {msg.sender?.fullName || 'Unknown'} ({msg.sender?.role})
                        </p>
                        <p className="break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-white/70' : 'text-gray-400 dark:text-slate-500'}`}>
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
            <form onSubmit={handleSend} className="p-3 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
                {socketConnected ? 'Connected to real-time chat' : 'Reconnecting...'}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default StaffChatInbox;
