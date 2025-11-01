import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDistanceToNow } from 'date-fns';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Feed({ user }) {
  const [posts, setPosts] = useState([]);
  const [newPost, setNewPost] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await axios.get(`${API}/posts/feed`);
      setPosts(response.data);
    } catch (error) {
      toast.error('Failed to load posts');
    }
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload/image`, formData);
      setSelectedImage(response.data.url);
      toast.success('Image uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const createPost = async () => {
    if (!newPost.trim() && !selectedImage) {
      toast.error('Please add some content');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API}/posts`, {
        content: newPost,
        media_url: selectedImage
      });
      setPosts([response.data, ...posts]);
      setNewPost('');
      setSelectedImage(null);
      toast.success('Post created!');
    } catch (error) {
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const response = await axios.post(`${API}/posts/${postId}/like`);
      setPosts(posts.map(post => {
        if (post.id === postId) {
          return {
            ...post,
            is_liked: response.data.liked,
            likes_count: response.data.liked ? post.likes_count + 1 : post.likes_count - 1
          };
        }
        return post;
      }));
    } catch (error) {
      toast.error('Failed to like post');
    }
  };

  const deletePost = async (postId) => {
    try {
      await axios.delete(`${API}/posts/${postId}`);
      setPosts(posts.filter(post => post.id !== postId));
      toast.success('Post deleted');
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const openComments = async (post) => {
    setSelectedPost(post);
    try {
      const response = await axios.get(`${API}/posts/${post.id}/comments`);
      setComments(response.data);
      setCommentDialogOpen(true);
    } catch (error) {
      toast.error('Failed to load comments');
    }
  };

  const addComment = async () => {
    if (!newComment.trim()) return;

    try {
      const response = await axios.post(`${API}/posts/${selectedPost.id}/comments`, {
        content: newComment
      });
      setComments([...comments, response.data]);
      setNewComment('');
      
      setPosts(posts.map(post => {
        if (post.id === selectedPost.id) {
          return { ...post, comments_count: post.comments_count + 1 };
        }
        return post;
      }));
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  return (
    <div className="space-y-6" data-testid="feed-page">
      {/* Create Post */}
      <Card className="p-6 glass-effect">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.profile_pic} />
            <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              data-testid="new-post-input"
              placeholder="What's on your mind?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="resize-none border-gray-200"
              rows={3}
            />
            {selectedImage && (
              <div className="relative inline-block">
                <img src={selectedImage} alt="Selected" className="max-h-40 rounded-lg" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => setSelectedImage(null)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="image-upload"
                  onChange={handleImageSelect}
                />
                <label htmlFor="image-upload">
                  <Button 
                    data-testid="upload-image-button"
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    disabled={uploading}
                    asChild
                  >
                    <span>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    </span>
                  </Button>
                </label>
              </div>
              <Button 
                data-testid="create-post-button"
                onClick={createPost} 
                disabled={loading || (!newPost.trim() && !selectedImage)}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Post
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.map((post) => (
          <Card key={post.id} className="p-6 post-card glass-effect" data-testid={`post-${post.id}`}>
            <div className="flex gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={post.profile_pic} />
                <AvatarFallback>{post.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{post.username}</p>
                    <p className="text-sm text-gray-500">
                      {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {post.user_id === user.id && (
                    <Button
                      data-testid={`delete-post-${post.id}`}
                      variant="ghost"
                      size="icon"
                      onClick={() => deletePost(post.id)}
                      className="hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="mt-3 text-gray-700 whitespace-pre-wrap">{post.content}</p>
                {post.media_url && (
                  <img 
                    src={post.media_url} 
                    alt="Post" 
                    className="mt-3 rounded-lg max-h-96 w-full object-cover" 
                  />
                )}
                <div className="flex gap-4 mt-4 pt-4 border-t border-gray-200">
                  <Button
                    data-testid={`like-post-${post.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleLike(post.id)}
                    className="gap-2"
                  >
                    <Heart className={`h-5 w-5 ${post.is_liked ? 'fill-red-500 text-red-500' : ''}`} />
                    <span>{post.likes_count}</span>
                  </Button>
                  <Button
                    data-testid={`comment-post-${post.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => openComments(post)}
                    className="gap-2"
                  >
                    <MessageCircle className="h-5 w-5" />
                    <span>{post.comments_count}</span>
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Comments Dialog */}
      <Dialog open={commentDialogOpen} onOpenChange={setCommentDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3" data-testid={`comment-${comment.id}`}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profile_pic} />
                  <AvatarFallback>{comment.username?.[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{comment.username}</p>
                  <p className="text-sm text-gray-700">{comment.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            <div className="flex gap-2 pt-4 border-t">
              <Input
                data-testid="add-comment-input"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addComment()}
              />
              <Button 
                data-testid="send-comment-button"
                onClick={addComment}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}