import requests
import sys
import json
from datetime import datetime
import base64
import io
from PIL import Image

class ZoqAPITester:
    def __init__(self, base_url="https://zoqsocial.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, files=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                if files:
                    # Remove Content-Type for file uploads
                    headers.pop('Content-Type', None)
                    response = requests.post(url, files=files, headers=headers)
                else:
                    response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f", Expected: {expected_status}"
                try:
                    error_data = response.json()
                    details += f", Error: {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f", Response: {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime('%H%M%S')
        user_data = {
            "username": f"testuser_{timestamp}",
            "email": f"test_{timestamp}@example.com",
            "password": "TestPass123!",
            "full_name": "Test User"
        }
        
        response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data=user_data
        )
        
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_user_login(self):
        """Test user login with existing credentials"""
        login_data = {
            "email": "test@example.com",
            "password": "TestPass123!"
        }
        
        response = self.run_test(
            "User Login (fallback)",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if response and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            return True
        return False

    def test_get_profile(self):
        """Test getting current user profile"""
        response = self.run_test(
            "Get User Profile",
            "GET",
            "auth/me",
            200
        )
        return response is not None

    def test_update_profile(self):
        """Test updating user profile"""
        profile_data = {
            "full_name": "Updated Test User",
            "bio": "This is my test bio"
        }
        
        response = self.run_test(
            "Update Profile",
            "PUT",
            "auth/profile",
            200,
            data=profile_data
        )
        return response is not None

    def test_image_upload(self):
        """Test image upload functionality"""
        # Create a simple test image
        img = Image.new('RGB', (100, 100), color='red')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)
        
        files = {'file': ('test.png', img_bytes, 'image/png')}
        
        response = self.run_test(
            "Image Upload",
            "POST",
            "upload/image",
            200,
            files=files
        )
        
        if response and 'url' in response:
            return response['url']
        return None

    def test_create_post(self, media_url=None):
        """Test creating a post"""
        post_data = {
            "content": "This is a test post from API testing!",
            "media_url": media_url
        }
        
        response = self.run_test(
            "Create Post",
            "POST",
            "posts",
            201,
            data=post_data
        )
        
        if response and 'id' in response:
            return response['id']
        return None

    def test_get_feed(self):
        """Test getting posts feed"""
        response = self.run_test(
            "Get Posts Feed",
            "GET",
            "posts/feed",
            200
        )
        return response is not None

    def test_like_post(self, post_id):
        """Test liking a post"""
        response = self.run_test(
            "Like Post",
            "POST",
            f"posts/{post_id}/like",
            200
        )
        return response is not None

    def test_add_comment(self, post_id):
        """Test adding a comment to a post"""
        comment_data = {
            "content": "This is a test comment!"
        }
        
        response = self.run_test(
            "Add Comment",
            "POST",
            f"posts/{post_id}/comments",
            201,
            data=comment_data
        )
        
        if response and 'id' in response:
            return response['id']
        return None

    def test_get_comments(self, post_id):
        """Test getting comments for a post"""
        response = self.run_test(
            "Get Comments",
            "GET",
            f"posts/{post_id}/comments",
            200
        )
        return response is not None

    def test_delete_post(self, post_id):
        """Test deleting a post"""
        response = self.run_test(
            "Delete Post",
            "DELETE",
            f"posts/{post_id}",
            200
        )
        return response is not None

    def test_search_users(self):
        """Test searching for users"""
        response = self.run_test(
            "Search Users",
            "GET",
            "users/search?q=test",
            200
        )
        return response is not None

    def test_friend_request_flow(self):
        """Test friend request functionality"""
        # Create a second user for friend request testing
        timestamp = datetime.now().strftime('%H%M%S')
        user2_data = {
            "username": f"testuser2_{timestamp}",
            "email": f"test2_{timestamp}@example.com",
            "password": "TestPass123!",
            "full_name": "Test User 2"
        }
        
        response = self.run_test(
            "Create Second User",
            "POST",
            "auth/register",
            200,
            data=user2_data
        )
        
        if not response or 'user' not in response:
            return False
        
        user2_id = response['user']['id']
        
        # Send friend request
        response = self.run_test(
            "Send Friend Request",
            "POST",
            f"friends/request/{user2_id}",
            200
        )
        
        if not response:
            return False
        
        # Switch to second user to accept request
        original_token = self.token
        login_data = {
            "email": user2_data["email"],
            "password": user2_data["password"]
        }
        
        response = self.run_test(
            "Login as Second User",
            "POST",
            "auth/login",
            200,
            data=login_data
        )
        
        if not response or 'token' not in response:
            return False
        
        self.token = response['token']
        
        # Get friend requests
        response = self.run_test(
            "Get Friend Requests",
            "GET",
            "friends/requests",
            200
        )
        
        if not response or len(response) == 0:
            self.token = original_token
            return False
        
        request_id = response[0]['id']
        
        # Accept friend request
        response = self.run_test(
            "Accept Friend Request",
            "POST",
            f"friends/accept/{request_id}",
            200
        )
        
        # Get friends list
        response = self.run_test(
            "Get Friends List",
            "GET",
            "friends",
            200
        )
        
        # Switch back to original user
        self.token = original_token
        return response is not None

    def test_messaging(self):
        """Test messaging functionality"""
        # Get conversations
        response = self.run_test(
            "Get Conversations",
            "GET",
            "messages/conversations",
            200
        )
        
        if not response:
            return False
        
        # Create a test message (need a friend to message)
        # This will likely fail without a friend, but we test the endpoint
        message_data = {
            "to_user_id": "test-user-id",
            "content": "Test message"
        }
        
        # This might fail with 404 if no friend exists, which is expected
        self.run_test(
            "Send Message (may fail without friends)",
            "POST",
            "messages",
            201,
            data=message_data
        )
        
        return True

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Zoq API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 50)
        
        # Authentication Tests
        if not self.test_user_registration():
            print("⚠️  Registration failed, trying login...")
            if not self.test_user_login():
                print("❌ Authentication failed completely")
                return False
        
        # Profile Tests
        self.test_get_profile()
        self.test_update_profile()
        
        # Image Upload Test
        media_url = self.test_image_upload()
        
        # Post Tests
        post_id = self.test_create_post(media_url)
        self.test_get_feed()
        
        if post_id:
            self.test_like_post(post_id)
            comment_id = self.test_add_comment(post_id)
            self.test_get_comments(post_id)
            # Don't delete post yet, keep it for frontend testing
        
        # User Search Tests
        self.test_search_users()
        
        # Friend Request Tests
        self.test_friend_request_flow()
        
        # Messaging Tests
        self.test_messaging()
        
        # Clean up - delete the test post
        if post_id:
            self.test_delete_post(post_id)
        
        # Print Results
        print("\n" + "=" * 50)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print("⚠️  Some tests failed. Check details above.")
            return False

def main():
    tester = ZoqAPITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())