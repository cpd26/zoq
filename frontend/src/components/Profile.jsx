import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Profile({ user, setUser }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    profile_pic: user?.profile_pic || ''
  });

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formDataObj = new FormData();
    formDataObj.append('file', file);

    try {
      const response = await axios.post(`${API}/upload/image`, formDataObj);
      setFormData({ ...formData, profile_pic: response.data.url });
      toast.success('Profile picture uploaded!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.put(`${API}/auth/profile`, formData);
      setUser({ ...user, ...response.data });
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="profile-page">
      <Card className="p-8 glass-effect">
        <div className="profile-header -m-8 mb-8 p-8 rounded-t-2xl">
          <div className="flex flex-col items-center">
            <div className="relative">
              <Avatar className="h-32 w-32 border-4 border-white shadow-xl">
                <AvatarImage src={formData.profile_pic} />
                <AvatarFallback className="text-4xl">{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              {editing && (
                <label htmlFor="profile-pic-upload" className="absolute bottom-0 right-0">
                  <div className="bg-white rounded-full p-2 shadow-lg cursor-pointer hover:bg-gray-100">
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                    ) : (
                      <Camera className="h-5 w-5 text-gray-600" />
                    )}
                  </div>
                  <Input
                    id="profile-pic-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageSelect}
                  />
                </label>
              )}
            </div>
            <h2 className="text-2xl font-bold mt-4 text-gray-800">{user?.username}</h2>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4 mt-8">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                data-testid="fullname-input"
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Your full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                data-testid="bio-input"
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself"
                rows={4}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                data-testid="save-profile-button"
                type="submit"
                disabled={loading}
                style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white'
                }}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                data-testid="cancel-edit-button"
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    full_name: user?.full_name || '',
                    bio: user?.bio || '',
                    profile_pic: user?.profile_pic || ''
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Full Name</h3>
              <p className="text-gray-800">{user?.full_name || 'Not set'}</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bio</h3>
              <p className="text-gray-800 whitespace-pre-wrap">{user?.bio || 'No bio yet'}</p>
            </div>

            <Button
              data-testid="edit-profile-button"
              onClick={() => setEditing(true)}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
              }}
            >
              Edit Profile
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}