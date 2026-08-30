import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare, Search, Loader2, AlertCircle, Send, User, Clock,
  CheckCircle2, Wifi, WifiOff, Headset
} from 'lucide-react';
import api from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { getSocket, onSocketEvent, emitSocketEvent } from '../../services/socket';

// CSKH LiveChat portal: left pane lists active customer support rooms,
// right pane shows the real-time message thread over the existing
// WebSocket server (socket.io) with REST fallback.
const AdminChat = () => {
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

  // Track socket connection status
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      const onConnect = () => setSocketConnected(true);
      const onDisconnect = () => setSocketConnected(false);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      if (socket.connected) setSocketConnected(true);
      return () => {
        socket.off('connect', onConnect);
        socket.off('disconnect', onDisconnect);
      };
    }
    return undefined;
  }, []);

  const fetchRooms = useCallback(async () => {
    setLoadingRooms(true);
    setError('');
    try {
      const response = await api.get('/admin/chat/rooms');
      setRooms(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch chat rooms:', err);
      setError(err.response?.data?.error?.message || 'Failed to load chat rooms.');
    } finally {
      setLoadingRooms(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // Real-time: refresh room list when a customer opens a new room
  useEffect(() => {
    const cleanup = onSocketEvent('chat:new_room', () => {
      fetchRooms();
    });
    return cleanup;
  }, [fetchRooms]);

  // Real-time: receive messages for the selected room
  useEffect(() => {
    if (!selectedRoom) return undefined;
    const cleanup = onSocketEvent('chat:message', (message) => {
      if (message.roomId === selectedRoom.id) {
        setMessages((prev) =>
          prev.some((m) => m.id === message.id) ? prev : [...prev, message]
        );
      }
    });
    return cleanup;
  }, [selectedRoom]);

  const fetchMessages = async (roomId) => {
    setLoadingMessages(true);
    setError('');
    try {
      const response = await api.get(`/admin/chat/rooms/${roomId}/messages`);
      setMessages(response.data.data.messages || []);
      emitSocketEvent('chat:join', { roomId });
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError(err.response?.data?.error?.message || 'Failed to load messages.');
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSelectRoom = (room) => {
    setSelectedRoom(room);
    if (room) fetchMessages(room.id);
  };

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
        // REST fallback when the socket is down
        const response = await api.post(`/chat/rooms/${selectedRoom.id}/messages`, { content });
        setMessages((prev) => [...prev, response.data.data]);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  const filteredRooms = rooms.filter((room) =>
    room.subject?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.email?.toLowerCase().includes(search.toLowerCase()) ||
    room.user?.fullName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col lg:flex-row gap-4" style={{ height: 'calc(100vh - 10rem)' }}>
      {/* ===== Left: Active customer rooms ===== */}
      <div className="w-full lg:w-80 bg-white rounded-lg shadow overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <Headset className="h-5 w-5 mr-2 text-primary-600" />
            Chat CSKH
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {rooms.filter((r) => r.status === 'OPEN').length} phòng đang chờ · {rooms.length} tổng
          </p>
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm phòng chat..."
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
            <div className="text-center py-8 text-gray-500 text-sm">Chưa có phòng chat nào.</div>
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
                    <Clock className="h-4 w-4 text-yellow-500 shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  )}
                </div>
                <div className="mt-1 flex items-center text-sm text-gray-500">
                  <User className="h-3 w-3 mr-1" />
                  <span className="truncate">{room.user?.fullName || room.user?.email || 'Unknown'}</span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  {room._count?.messages || 0} tin nhắn
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* ===== Right: Real-time message thread ===== */}
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
              <p className="mt-4">Chọn một phòng chat để bắt đầu hỗ trợ khách hàng</p>
              <p className="mt-1 text-xs text-gray-400">
                Tin nhắn mới từ khách hàng sẽ xuất hiện theo thời gian thực.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{selectedRoom.subject}</h3>
                <p className="text-sm text-gray-500 truncate">
                  {selectedRoom.user?.fullName} ({selectedRoom.user?.email})
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedRoom.status === 'OPEN' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }`}>
                  {selectedRoom.status}
                </span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {loadingMessages ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Chưa có tin nhắn trong phòng này.</div>
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
                            : 'bg-white border border-gray-200 text-gray-800'
                        }`}
                      >
                        <p className={`text-xs font-medium mb-1 ${isMine ? 'text-white/80' : 'text-primary-700'}`}>
                          {msg.sender?.fullName || 'Unknown'} ({msg.sender?.role})
                        </p>
                        <p className="break-words">{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMine ? 'text-white/70' : 'text-gray-400'}`}>
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
            <form onSubmit={handleSend} className="p-3 border-t border-gray-200 bg-white">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Nhập tin nhắn trả lời khách hàng..."
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
              <div className="mt-1 text-xs text-gray-400 flex items-center gap-1.5">
                {socketConnected ? (
                  <><Wifi className="h-3.5 w-3.5 text-green-500" /> Đã kết nối chat thời gian thực</>
                ) : (
                  <><WifiOff className="h-3.5 w-3.5 text-yellow-500" /> Đang kết nối lại... (tin nhắn vẫn gửi được qua REST)</>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminChat;
