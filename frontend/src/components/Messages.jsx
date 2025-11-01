import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import io from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Video, Phone, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import VideoCall from './VideoCall';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Messages({ user }) {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const messagesEndRef = useRef(null);
  const [callActive, setCallActive] = useState(false);
  const [callType, setCallType] = useState(null);

  useEffect(() => {
    loadConversations();
    
    // Initialize socket
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });
    
    newSocket.on('connect', () => {
      const token = localStorage.getItem('zoq_token');
      newSocket.emit('authenticate', { token });
    });

    newSocket.on('new_message', (message) => {
      if (userId && (message.from_user_id === userId || message.to_user_id === userId)) {
        setMessages(prev => [...prev, message]);
      }
      loadConversations();
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (userId) {
      loadMessages(userId);
      loadSelectedUser(userId);
    }
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const response = await axios.get(`${API}/messages/conversations`);
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations');
    }
  };

  const loadMessages = async (partnerId) => {
    try {
      const response = await axios.get(`${API}/messages/${partnerId}`);
      setMessages(response.data);
    } catch (error) {
      toast.error('Failed to load messages');
    }
  };

  const loadSelectedUser = async (partnerId) => {
    try {
      const response = await axios.get(`${API}/users/search?q=${partnerId}`);
      if (response.data.length > 0) {
        const friends = await axios.get(`${API}/friends`);
        const friend = friends.data.find(f => f.id === partnerId);
        setSelectedUser(friend || response.data[0]);
      }
    } catch (error) {
      console.error('Failed to load user');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !userId) return;

    const messageData = {
      to_user_id: userId,
      content: newMessage
    };

    try {
      if (socket && socket.connected) {
        socket.emit('send_message', messageData);
      } else {
        await axios.post(`${API}/messages`, messageData);
      }
      
      setMessages([...messages, {
        id: Date.now().toString(),
        from_user_id: user.id,
        to_user_id: userId,
        content: newMessage,
        created_at: new Date().toISOString()
      }]);
      
      setNewMessage('');
      loadConversations();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const startCall = (type) => {
    setCallType(type);
    setCallActive(true);
  };

  if (callActive && userId) {
    return (
      <VideoCall
        user={user}
        recipientId={userId}
        recipientName={selectedUser?.username}
        socket={socket}
        onEnd={() => setCallActive(false)}
        callType={callType}
      />
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-140px)]" data-testid="messages-page">
      {/* Conversations List */}
      <Card className="w-80 glass-effect overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="font-semibold text-lg">Messages</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {conversations.map((conv) => (
            <div
              key={conv.user_id}
              data-testid={`conversation-${conv.user_id}`}
              onClick={() => navigate(`/messages/${conv.user_id}`)}
              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                userId === conv.user_id ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={conv.profile_pic} />
                  <AvatarFallback>{conv.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold truncate">{conv.username}</p>
                    {conv.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{conv.last_message}</p>
                  {conv.last_message_time && (
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(conv.last_message_time), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Chat Area */}
      {userId ? (
        <Card className="flex-1 flex flex-col glass-effect">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/messages')}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser?.profile_pic} />
                <AvatarFallback>{selectedUser?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold">{selectedUser?.username}</p>
                <p className="text-xs text-gray-500">Online</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                data-testid="voice-call-button"
                variant="outline"
                size="icon"
                onClick={() => startCall('audio')}
                className="hover:bg-green-50"
              >
                <Phone className="h-5 w-5 text-green-600" />
              </Button>
              <Button
                data-testid="video-call-button"
                variant="outline"
                size="icon"
                onClick={() => startCall('video')}
                className="hover:bg-blue-50"
              >
                <Video className="h-5 w-5 text-blue-600" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={`message-${message.id}`}
                className={`flex ${message.from_user_id === user.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`message-bubble ${
                    message.from_user_id === user.id ? 'message-sent' : 'message-received'
                  }`}
                >
                  <p>{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2">
              <Input
                data-testid="message-input"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                className="flex-1"
              />
              <Button
                data-testid="send-message-button"
                onClick={sendMessage}
                disabled={!newMessage.trim()}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="flex-1 flex items-center justify-center glass-effect">
          <div className="text-center text-gray-500">
            <p className="text-lg">Select a conversation to start messaging</p>
          </div>
        </Card>
      )}
    </div>
  );
}