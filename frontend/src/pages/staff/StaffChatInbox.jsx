import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  Search,
  Loader2,
  AlertCircle,
  Send,
  User,
  Clock,
  CheckCircle2
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
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize socket connection
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('connect', () => setSocketConnected(true));
      socket.on('disconnect', () => setSocketConnected(false));
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
      setRooms(response.data.data || []);
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

  // Fetch messages for selected room
  const fetchMessages = async (roomId) => {
    setLoadingMessages(true);
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
    }
  };

  // Handle room selection
  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    if (room) {
      fetchMessages(room.id);
    }
  };

  // Listen for incoming messages
  useEffect(() => {
    if (!selectedRoom) return;
    const cleanup = onSocketEvent('chat:message', (message) => {
      if (message.roomId === selectedRoom.id) {
        setMessages((prev) => [...prev, message]);
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

  const filteredRooms = rooms.filter(room =>
    room.subject?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
      {/* Room List */}
      <div className="w-full lg:w-80 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2 text-primary-600" />
            Support Inbox
          </h2>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingRooms ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">No chat rooms found.</div>
          ) : (
            filteredRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleSelectRoom(room)}
                className={`w-full text-left p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedRoom?.id === room.id ? 'bg-primary-50 border-l-4 border-primary-600' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-800 truncate">{room.subject}</span>
                  {room.status === 'OPEN' ? (
                    <Clock className="h-4 w-4 text-yellow-500" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <User className="h-3 w-3 mr-1" />
                  <span className="truncate">{room.user?.fullName || room.user?.email || 'Unknown'}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {room._count?.messages || 0} messages
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        {error && (
          <div className="p-3 bg-red-50 text-red-600 flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            {error}
          </div>
        )}

        {!selectedRoom ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4">Select a chat room to view conversation</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">{selectedRoom.subject}</h3>
                <p className="text-sm text-gray-500">
                  {selectedRoom.user?.fullName} ({selectedRoom.user?.email})
                </p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                selectedRoom.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
              }`}>
                {selectedRoom.status}
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No messages yet.</div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender?.id === user?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        msg.sender?.id === user?.id
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1">
                        {msg.sender?.fullName || 'Unknown'} ({msg.sender?.role})
                      </p>
                      <p>{msg.content}</p>
                      <p className="text-xs mt-1 opacity-70">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a reply..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-400">
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