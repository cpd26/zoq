import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, UserPlus, Check, X, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Friends({ user }) {
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  const loadFriends = async () => {
    try {
      const response = await axios.get(`${API}/friends`);
      setFriends(response.data);
    } catch (error) {
      toast.error('Failed to load friends');
    }
  };

  const loadRequests = async () => {
    try {
      const response = await axios.get(`${API}/friends/requests`);
      setRequests(response.data);
    } catch (error) {
      toast.error('Failed to load requests');
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API}/users/search?q=${searchQuery}`);
      setSearchResults(response.data);
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (userId) => {
    try {
      await axios.post(`${API}/friends/request/${userId}`);
      toast.success('Friend request sent!');
      setSearchResults(searchResults.filter(u => u.id !== userId));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send request');
    }
  };

  const acceptRequest = async (requestId) => {
    try {
      await axios.post(`${API}/friends/accept/${requestId}`);
      toast.success('Friend request accepted!');
      loadRequests();
      loadFriends();
    } catch (error) {
      toast.error('Failed to accept request');
    }
  };

  const rejectRequest = async (requestId) => {
    try {
      await axios.delete(`${API}/friends/reject/${requestId}`);
      toast.success('Friend request rejected');
      loadRequests();
    } catch (error) {
      toast.error('Failed to reject request');
    }
  };

  return (
    <div className="space-y-6" data-testid="friends-page">
      <Card className="p-6 glass-effect">
        <Tabs defaultValue="friends">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="friends" data-testid="friends-tab">Friends ({friends.length})</TabsTrigger>
            <TabsTrigger value="requests" data-testid="requests-tab">
              Requests {requests.length > 0 && `(${requests.length})`}
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="search-tab">Find Friends</TabsTrigger>
          </TabsList>

          {/* Friends List */}
          <TabsContent value="friends" className="space-y-4">
            {friends.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No friends yet. Start by sending friend requests!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {friends.map((friend) => (
                  <Card key={friend.id} className="p-4 friend-card" data-testid={`friend-${friend.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={friend.profile_pic} />
                          <AvatarFallback>{friend.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{friend.username}</p>
                          {friend.full_name && (
                            <p className="text-sm text-gray-600">{friend.full_name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        data-testid={`message-friend-${friend.id}`}
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/messages/${friend.id}`)}
                      >
                        <MessageCircle className="h-5 w-5" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Friend Requests */}
          <TabsContent value="requests" className="space-y-4">
            {requests.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No pending friend requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <Card key={request.id} className="p-4" data-testid={`request-${request.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.from_profile_pic} />
                          <AvatarFallback>{request.from_username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{request.from_username}</p>
                          <p className="text-sm text-gray-600">Sent you a friend request</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          data-testid={`accept-request-${request.id}`}
                          size="sm"
                          onClick={() => acceptRequest(request.id)}
                          style={{
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white'
                          }}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                        <Button
                          data-testid={`reject-request-${request.id}`}
                          variant="outline"
                          size="sm"
                          onClick={() => rejectRequest(request.id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Search Users */}
          <TabsContent value="search" className="space-y-4">
            <div className="flex gap-2">
              <Input
                data-testid="search-users-input"
                placeholder="Search for users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && searchUsers()}
              />
              <Button 
                data-testid="search-button"
                onClick={searchUsers}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-3">
                {searchResults.map((foundUser) => (
                  <Card key={foundUser.id} className="p-4" data-testid={`user-result-${foundUser.id}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={foundUser.profile_pic} />
                          <AvatarFallback>{foundUser.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{foundUser.username}</p>
                          {foundUser.full_name && (
                            <p className="text-sm text-gray-600">{foundUser.full_name}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        data-testid={`add-friend-${foundUser.id}`}
                        onClick={() => sendFriendRequest(foundUser.id)}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white'
                        }}
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add Friend
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : searchQuery && !loading ? (
              <div className="text-center py-12 text-gray-500">
                <p>No users found</p>
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}