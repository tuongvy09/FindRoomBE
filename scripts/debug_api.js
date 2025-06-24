const axios = require('axios');

const BASE_URL = 'http://localhost:8000';
const POST_ID = '6828efa2d7df83543af93d04';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MDUxZmY1MWNlZDM1MTZhNjlhODIzZCIsImFkbWluIjpmYWxzZSwiaWF0IjoxNzQ5MzM2NzA3LCJleHAiOjE3NTE5Mjg3MDd9.4aGaW-MYorQ78Y13GwInigNQxEJ24sN3_xtlCjhgNqk';

async function debugAPI() {
  console.log('🔍 Debug API...');
  
  // 1. Kiểm tra xem post có tồn tại không
  try {
    console.log('\n1️⃣ Kiểm tra post tồn tại...');
    const postResponse = await axios.get(`${BASE_URL}/v1/posts/${POST_ID}`);
    console.log('✅ Post tồn tại:', postResponse.data?.title || 'OK');
  } catch (error) {
    console.log('❌ Post không tồn tại hoặc API sai:', error.response?.status);
    return;
  }

  // 2. Kiểm tra token hợp lệ
  try {
    console.log('\n2️⃣ Kiểm tra token...');
    const userResponse = await axios.get(`${BASE_URL}/v1/auth/me`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    console.log('✅ Token hợp lệ, User ID:', userResponse.data?._id || userResponse.data?.id);
  } catch (error) {
    console.log('❌ Token không hợp lệ:', error.response?.status);
    return;
  }

  // 3. Test với dữ liệu tối thiểu
  console.log('\n3️⃣ Test với dữ liệu tối thiểu...');
  
  const minimalData = {
    rating: {
      quality: 5,
      location: 4,
      price: 5,
      service: 4,
      security: 4,
      averageRating: 4.4
    },
    comments: {
      best_part: "Test",
      worst_part: "Test",
      advice: "Test",
      additional_comment: "Test"
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: true,
      is_host_responsive: true,
      is_introduce: true
    }
  };

  try {
    const response = await axios.post(
      `${BASE_URL}/v1/reviews/${POST_ID}`,
      minimalData,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    console.log('✅ API hoạt động OK!');
    console.log('Response:', response.data);
  } catch (error) {
    console.log('❌ Lỗi API:');
    console.log('Status:', error.response?.status);
    console.log('Data:', error.response?.data);
    console.log('Headers:', error.response?.headers);
  }
}

debugAPI().catch(console.error);
