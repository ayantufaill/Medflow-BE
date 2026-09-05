import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

async function testLoginAPI() {
  try {
    console.log('Testing login API...\n');

    const response = await axios.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@example.com',
      password: 'Admin123!',
    });

    console.log('✅ Login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.log('❌ Login failed');
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data);
    } else {
      console.error('❌ Error:', error);
    }
  }
}

testLoginAPI();
