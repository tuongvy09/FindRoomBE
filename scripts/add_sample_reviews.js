const axios = require('axios');

// Cấu hình
const BASE_URL = 'http://localhost:8000'; // Thay đổi theo API server của bạn
const POST_ID = '6828efa2d7df83543af93d04';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MDUxZmY1MWNlZDM1MTZhNjlhODIzZCIsImFkbWluIjpmYWxzZSwiaWF0IjoxNzQ5MzM2NzA3LCJleHAiOjE3NTE5Mjg3MDd9.4aGaW-MYorQ78Y13GwInigNQxEJ24sN3_xtlCjhgNqk'; // Thay bằng token thực của bạn

// Dữ liệu review mẫu
const sampleReviews = [
  {
    rating: {
      quality: 5,
      location: 4,
      price: 5,
      service: 4,
      security: 4,
      averageRating: 4.4
    },
    comments: {
      best_part: "Phòng rất sạch sẽ, thoáng mát và có đầy đủ tiện nghi. Chủ nhà rất thân thiện và hỗ trợ nhiệt tình.",
      worst_part: "Không có gì để phàn nàn, mọi thứ đều ổn.",
      advice: "Nên đặt phòng sớm vì phòng này rất được ưa chuộng. Nhớ hỏi chủ nhà về quy định giờ giấc.",
      additional_comment: "Đây là một trong những phòng trọ tốt nhất mình từng ở. Rất recommend cho các bạn sinh viên."
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: true,
      is_host_responsive: true,
      is_introduce: true
    },
    media: {
      images: [],
      video: ""
    }
  },
  {
    rating: {
      quality: 3,
      location: 5,
      price: 4,
      service: 3,
      security: 4,
      averageRating: 3.8
    },
    comments: {
      best_part: "Vị trí rất thuận tiện, gần trường học và quán ăn. Giá cả hợp lý so với khu vực.",
      worst_part: " ",
      advice: "Phù hợp với người thích sự tiện lợi hơn là không gian rộng rãi.",
      additional_comment: "Nhìn chung okela, phù hợp với túi tiền sinh viên."
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: false,
      is_host_responsive: true,
      is_introduce: true
    },
    media: {
      images: [],
      video: ""
    }
  },
  {
    rating: {
      quality: 4,
      location: 3,
      price: 3,
      service: 5,
      security: 5,
      averageRating: 4.0
    },
    comments: {
      best_part: "Chủ nhà rất nice, luôn hỗ trợ khi có vấn đề. An ninh khu vực tốt, có bảo vệ 24/7.",
      worst_part: "Hơi xa trung tâm một chút, di chuyển bằng xe máy thì ổn nhưng đi bộ thì hơi mệt.",
      advice: "Nên có xe máy để di chuyển thuận tiện hơn. Khu vực này về đêm khá yên tĩnh.",
      additional_comment: "Mình ở đây được 6 tháng rồi, cảm thấy khá hài lòng với dịch vụ."
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: true,
      is_host_responsive: true,
      is_introduce: true
    },
    media: {
      images: [],
      video: ""
    }
  },
  {
    rating: {
      quality: 2,
      location: 4,
      price: 2,
      service: 2,
      security: 3,
      averageRating: 2.6
    },
    comments: {
      best_part: "Vị trí khá ok, gần các tiện ích công cộng.",
      worst_part: "Phòng cũ kỹ, một số thiết bị bị hỏng. Chủ nhà không mặn mà sửa chữa lắm. Giá hơi cao so với chất lượng.",
      advice: "Nên xem kỹ phòng trước khi quyết định thuê. Có thể tìm được phòng tốt hơn với giá tương tự.",
      additional_comment: "Không recommend lắm. Mình đã chuyển đi nơi khác sau 2 tháng ở."
    },
    review_checks: {
      is_info_complete: false,
      is_image_accurate: false,
      is_host_responsive: false,
      is_introduce: false
    },
    media: {
      images: [],
      video: ""
    }
  },
  {
    rating: {
      quality: 4,
      location: 5,
      price: 4,
      service: 4,
      security: 4,
      averageRating: 4.2
    },
    comments: {
      best_part: "Vị trí đắc địa, gần trung tâm thành phố. Phòng khá đẹp và thoáng đãng.",
      worst_part: "Parking hơi thiếu, đôi khi phải để xe xa một chút.",
      advice: "Nếu không có xe thì đây là lựa chọn tuyệt vời. Đi bộ đến đâu cũng gần.",
      additional_comment: "Phòng phù hợp cho người làm việc ở trung tâm thành phố."
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: true,
      is_host_responsive: true,
      is_introduce: true
    },
    media: {
      images: [],
      video: ""
    }
  },
  {
    rating: {
      quality: 5,
      location: 2,
      price: 5,
      service: 3,
      security: 3,
      averageRating: 3.6
    },
    comments: {
      best_part: "Phòng rất đẹp và mới, giá rẻ so với chất lượng. Không gian rộng rãi.",
      worst_part: "Hơi xa trung tâm, xung quanh chưa có nhiều tiện ích. Chủ nhà không có mặt thường xuyên.",
      advice: "Phù hợp với người thích yên tĩnh và không cần ra ngoài nhiều.",
      additional_comment: "Nếu bạn có phương tiện di chuyển thì đây là lựa chọn tốt."
    },
    review_checks: {
      is_info_complete: true,
      is_image_accurate: true,
      is_host_responsive: false,
      is_introduce: true
    },
    media: {
      images: [],
      video: ""
    }
  }
];

// Hàm delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Hàm gửi review
async function createReview(reviewData) {
  try {
    const response = await axios.post(
      `${BASE_URL}/v1/reviews/${POST_ID}`,
      reviewData,
      {
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
}

// Hàm chính
async function addSampleReviews() {
  console.log('🚀 Bắt đầu thêm review mẫu...');
  console.log(`📍 Post ID: ${POST_ID}`);
  console.log(`🔗 API URL: ${BASE_URL}/v1/reviews/${POST_ID}`);
  console.log(`📊 Số lượng review: ${sampleReviews.length}`);
  console.log('─'.repeat(50));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < sampleReviews.length; i++) {
    try {
      console.log(`⏳ Đang thêm review ${i + 1}/${sampleReviews.length}...`);
      
      const result = await createReview(sampleReviews[i]);
      successCount++;
      
      console.log(`✅ Review ${i + 1} đã được thêm thành công!`);
      console.log(`   Rating trung bình: ${sampleReviews[i].rating.averageRating}`);
      
      // Delay giữa các request để tránh spam
      if (i < sampleReviews.length - 1) {
        console.log('⏱️  Đang chờ 2 giây...');
        await delay(2000);
      }
      
    } catch (error) {
      errorCount++;
      console.log(`❌ Lỗi khi thêm review ${i + 1}:`);
      
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Message: ${error.response.data?.message || 'Unknown error'}`);
      } else {
        console.log(`   Error: ${error.message}`);
      }
    }
    
    console.log('─'.repeat(30));
  }

  console.log('\n🎉 Hoàn thành!');
  console.log(`✅ Thành công: ${successCount} review`);
  console.log(`❌ Thất bại: ${errorCount} review`);
  console.log(`📊 Tổng cộng: ${sampleReviews.length} review`);
}

// Kiểm tra token
if (ACCESS_TOKEN === 'YOUR_ACCESS_TOKEN_HERE') {
  console.log('❌ Vui lòng thay đổi ACCESS_TOKEN trong script!');
  console.log('💡 Hướng dẫn lấy token:');
  console.log('   1. Đăng nhập vào website');
  console.log('   2. Mở Developer Tools (F12)');
  console.log('   3. Vào tab Application/Storage > Local Storage');
  console.log('   4. Tìm key chứa token và copy giá trị');
  process.exit(1);
}

// Chạy script
addSampleReviews().catch(console.error);
