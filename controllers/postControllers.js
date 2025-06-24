const Post = require("../models/Post");
const User = require("../models/User");
const cloudinary = require("cloudinary").v2;
const mongoose = require("mongoose");
const axios = require("axios");
const { io } = require("../congfig/websocket");

const sendEmail = require("../services/emailService");
const { checkPostModeration } = require("./aiController");
const { onlineUsers } = require("../congfig/websocket");
const { checkAlertSubscriptions } = require("./alertSubscription");
const SubscriptionService = require('../services/subscriptionService');
const UserSubscription = require("../models/UserSubscription");

function sendSocketNotification(userId, data) {
  const socketId = onlineUsers[userId];

  if (socketId) {
    const userSocket = io().sockets.sockets.get(socketId);
    if (userSocket) {
      userSocket.emit("notification", data);
      console.log(`[Socket] Đã gửi thông báo tới userId=${userId}`);
    } else {
      console.log(`[Socket] Không tìm thấy socket với socketId=${socketId} cho userId=${userId}`);
    }
  } else {
    console.log(`[Socket] Người dùng không trực tuyến: userId=${userId}`);
  }
}

const sendEmailToAdmin = (post) => {
  const subject = "Bài đăng có nghi vấn cần kiểm duyệt";
  const message = `Có một bài đăng mới cần được kiểm duyệt. Chi tiết bài đăng:

  - Tiêu đề: ${post.title}
  - Nội dung: ${post.content}
  - Tình trạng: Chờ duyệt

  Vui lòng xem và duyệt bài đăng này.`;
  sendEmail("tranthituongvy9012003@gmail.com", subject, message);
};

async function getCoordinates(addressString) {
  const encodedAddress = encodeURIComponent(addressString);
  const url = `https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&addressdetails=1&limit=1`;

  console.log("📌 URL gửi đến Nominatim:", url);

  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "PhongTroXinh/1.0 (nguyenanhtuyet03.nbk@gmail.com)",
      },
    });

    const results = res.data;

    if (results.length === 0) {
      console.warn(
        "⚠️ Không tìm thấy kết quả tọa độ cho địa chỉ:",
        addressString
      );
      return null;
    }

    const { lat, lon } = results[0];
    console.log("📍 Tọa độ lấy được từ Nominatim:", {
      latitude: lat,
      longitude: lon,
    });

    return {
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
    };
  } catch (error) {
    console.error("❌ Lỗi khi gọi Nominatim API:", error.message);
    return null;
  }
}

exports.createPost = async (req, res) => {
  try {
    const {
      title,
      content,
      category,
      transactionType,
      address,
      projectName,
      locationDetails,
      propertyDetails,
      features,
      legalContract,
      furnitureStatus,
      areaUse,
      area,
      typeArea,
      dimensions,
      price,
      deposit,
      userType,
      contactInfo,
      defaultDaysToShow = 7,
      latitude,
      longitude,
      isVip = false,
    } = req.body;

    const isVipPost = isVip === 'true' || isVip === true;

    console.log("🔍 CreatePost Debug:", {
      isVip,
      isVipPost,
      userId: req.user.id
    });

    if (
      !title ||
      !content ||
      !address ||
      !category ||
      !transactionType ||
      !price ||
      !contactInfo ||
      !userType
    ) {
      return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
    }

    // Parse các trường
    const safeParse = (value, fallback = {}) => {
      try {
        return typeof value === "string" ? JSON.parse(value) : value;
      } catch (e) {
        return fallback;
      }
    };

    const parsedAddress = safeParse(address);
    const fullAddress = `${parsedAddress.exactaddress}, ${parsedAddress.ward}, ${parsedAddress.district}, ${parsedAddress.province}`;

    const coordinates = await getCoordinates(fullAddress);
    const parsedLocationDetails = safeParse(locationDetails);
    const parsedPropertyDetails = safeParse(propertyDetails);
    const parsedDimensions = safeParse(dimensions);
    const parsedFeatures = Array.isArray(features) ? features : safeParse(features, []);
    const parsedContactInfo = safeParse(contactInfo);

    // Lấy user từ token
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    // ===== PHẦN KIỂM TRA QUOTA =====
    const userSubscription = await UserSubscription.findOne({
      userId: userId,
      isActive: true,
      endDate: { $gt: new Date() }
    });

    if (userSubscription) {
    } else {
      if (isVipPost) {
        return res.status(403).json({
          message: "Gói Free không hỗ trợ đăng tin VIP. Vui lòng nâng cấp gói.",
        });
      }

      if (!user.postQuota || user.postQuota <= 0) {
        return res.status(403).json({
          message: "Bạn đã hết quota đăng tin miễn phí. Vui lòng nâng cấp gói để đăng thêm.",
        });
      }

      console.log(`✅ Free plan user có thể đăng tin. Quota còn lại: ${user.postQuota}`);
    }

    if (!req.files?.images || req.files.images.length === 0) {
      return res.status(400).json({ message: "Thiếu ảnh, vui lòng tải lên ít nhất một ảnh." });
    }

    // Xử lý images
    let bodyImages = req.body.images;
    if (!Array.isArray(bodyImages)) {
      bodyImages = bodyImages ? [bodyImages] : [];
    }

    const imageFiles = req.files?.images || [];
    const imageUrls = [...bodyImages];
    imageFiles.forEach((file) => {
      imageUrls.push(file.path);
    });

    // Xử lý videoUrl
    let videoUrl = null;
    if (req.files?.videoUrl?.[0]) {
      videoUrl = req.files.videoUrl[0].path;
    } else if (typeof req.body.videoUrl === 'string' && req.body.videoUrl.startsWith('http')) {
      videoUrl = req.body.videoUrl;
    }

    const newPost = new Post({
      title,
      content,
      category,
      transactionType,
      address: parsedAddress,
      projectName,
      locationDetails: parsedLocationDetails,
      propertyDetails: parsedPropertyDetails,
      features: parsedFeatures,
      legalContract,
      furnitureStatus,
      areaUse,
      area,
      typeArea,
      dimensions: parsedDimensions,
      price,
      deposit,
      userType,
      videoUrl: videoUrl,
      images: imageUrls,
      contactInfo: {
        user: parsedContactInfo.user,
        username: parsedContactInfo.username,
        phoneNumber: parsedContactInfo.phoneNumber || "",
      },
      defaultDaysToShow,
      daysRemaining: defaultDaysToShow,
      hoursRemaining: 0,
      expiryDate: null,
      latitude: coordinates?.latitude || null,
      longitude: coordinates?.longitude || null,
      isVip: isVipPost,
      userId: userId,
    });

    const savedPost = await newPost.save();
    console.log(`📝 Post saved successfully with ID: ${savedPost._id}`);

    try {
      if (userSubscription) {
      } else {
        const updatedUser = await User.findByIdAndUpdate(
          userId,
          { $inc: { postQuota: -1 } },
          { new: true }
        );

        const verifyUser = await User.findById(userId);
      }
    } catch (usageError) {
      console.error("Error updating usage tracking:", usageError);

      await Post.findByIdAndDelete(savedPost._id);

      return res.status(500).json({
        message: "Lỗi khi cập nhật quota. Bài đăng đã được hủy.",
        error: usageError.message
      });
    }

    res.status(201).json({
      message: "Tạo bài đăng thành công",
      post: savedPost,
    });

    (async () => {
      try {
        const moderationResult = await checkPostModeration(savedPost);

        savedPost.status = moderationResult.status;
        savedPost.rejectionReason = moderationResult.reason;

        if (moderationResult.status === "approved") {
          savedPost.visibility = "visible";
          await checkAlertSubscriptions(savedPost);
        }

        await savedPost.save();
        const postTypeText = isVipPost ? 'VIP ' : '';

        const owner = await User.findById(savedPost.contactInfo.user);
        if (owner) {
          let message = "";

          if (moderationResult.status === "approved") {
            message = `Bài đăng ${postTypeText}của bạn với tiêu đề "${savedPost.title}" đã được duyệt và sẽ hiển thị công khai.`;
          } else if (moderationResult.status === "rejected") {
            message = `Bài đăng ${postTypeText}của bạn với tiêu đề "${savedPost.title}" bị từ chối. Lý do: ${moderationResult.reason}`;
          } else if (moderationResult.status === "pending") {
            message = `Bài đăng ${postTypeText}của bạn với tiêu đề "${savedPost.title}" đang đợi admin duyệt.`;
          }

          const notification = {
            message,
            type: "post",
            post_id: savedPost._id,
            status: "unread",
            createdAt: new Date(),
          };

          owner.notifications.push(notification);
          await owner.save();

          const socket = io();
          socket.to(owner._id.toString()).emit("notification", notification);
        }
      } catch (err) {
        console.error("Lỗi xử lý hậu kiểm duyệt:", err);
      }
    })();
  } catch (error) {
    console.error("Lỗi khi tạo bài đăng:", error);
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: "Lỗi xác thực dữ liệu", error: error.message });
    }
    res.status(500).json({
      message: "Lỗi máy chủ",
      error: error.message,
    });
  }
};

const processDistrictData = async () => {
  const currentYear = 2025;
  const currentMonth = 4;

  const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1);
  const firstDayPreviousMonth = new Date(currentYear, currentMonth - 1, 1);

  const posts = await Post.find(
    {
      status: "approved",
      visibility: "visible",
      latitude: { $ne: null },
      longitude: { $ne: null },
      price: { $gt: 0 },
      area: { $gt: 0 },
    },
    {
      "address.province": 1,
      "address.district": 1,
      latitude: 1,
      longitude: 1,
      price: 1,
      area: 1,
      createdAt: 1,
      category: 1,
      transactionType: 1,
    }
  );
  const districtData = {};
  const categories = [
    "Căn hộ/chung cư",
    "Nhà ở",
    "Đất",
    "Văn phòng, mặt bằng kinh doanh",
    "phòng trọ",
  ];
  const transactionTypes = ["Cho thuê", "Cần bán"];
  posts.forEach((post) => {
    const province = post.address.province;
    const district = post.address.district;
    const category = post.category;
    const transactionType = post.transactionType;
    const postDate = new Date(post.createdAt);
    const pricePerSqM = post.price / post.area;

    if (!districtData[province]) {
      districtData[province] = {};
    }

    if (!districtData[province][district]) {
      districtData[province][district] = {
        lat: post.latitude,
        lng: post.longitude,
        latestTimestamp: 0,
        byCategoryAndTransaction: {},
      };

      categories.forEach((cat) => {
        districtData[province][district].byCategoryAndTransaction[cat] = {};
        transactionTypes.forEach((trans) => {
          districtData[province][district].byCategoryAndTransaction[cat][
            trans
          ] = {
            currentMonth: { total: 0, count: 0 },
            previousMonth: { total: 0, count: 0 },
          };
        });
      });
    }

    const postTimestamp = postDate.getTime();
    if (postTimestamp > districtData[province][district].latestTimestamp) {
      districtData[province][district].lat = post.latitude;
      districtData[province][district].lng = post.longitude;
      districtData[province][district].latestTimestamp = postTimestamp;
    }

    const isCurrentMonth = postDate >= firstDayCurrentMonth;
    const isPreviousMonth =
      postDate >= firstDayPreviousMonth && postDate < firstDayCurrentMonth;

    if (isCurrentMonth) {
      districtData[province][district].byCategoryAndTransaction[category][
        transactionType
      ].currentMonth.total += pricePerSqM;
      districtData[province][district].byCategoryAndTransaction[category][
        transactionType
      ].currentMonth.count += 1;
    } else if (isPreviousMonth) {
      districtData[province][district].byCategoryAndTransaction[category][
        transactionType
      ].previousMonth.total += pricePerSqM;
      districtData[province][district].byCategoryAndTransaction[category][
        transactionType
      ].previousMonth.count += 1;
    }
  });

  const result = {};

  for (const province in districtData) {
    result[province] = {};

    for (const district in districtData[province]) {
      const data = districtData[province][district];

      result[province][district] = {
        lat: data.lat,
        lng: data.lng,
        byCategoryAndTransaction: {},
      };

      for (const cat of categories) {
        result[province][district].byCategoryAndTransaction[cat] = {};

        for (const trans of transactionTypes) {
          const combinedData = data.byCategoryAndTransaction[cat][trans];
          const combinedCurrentAvg =
            combinedData.currentMonth.count > 0
              ? combinedData.currentMonth.total /
              combinedData.currentMonth.count
              : 0;

          const combinedPrevAvg =
            combinedData.previousMonth.count > 0
              ? combinedData.previousMonth.total /
              combinedData.previousMonth.count
              : 0;

          let combinedPriceFluctuation = 0;
          if (combinedCurrentAvg > 0 && combinedPrevAvg > 0) {
            combinedPriceFluctuation =
              ((combinedCurrentAvg - combinedPrevAvg) / combinedPrevAvg) *
              100;
          }

          if (combinedCurrentAvg > 0 || combinedData.currentMonth.count > 0) {
            result[province][district].byCategoryAndTransaction[cat][trans] =
            {
              commonPrice: parseFloat(combinedCurrentAvg.toFixed(2)),
              priceFluctuation: parseFloat(
                combinedPriceFluctuation.toFixed(2)
              ),
              count: combinedData.currentMonth.count,
            };
          }
        }

        if (
          Object.keys(
            result[province][district].byCategoryAndTransaction[cat]
          ).length === 0
        ) {
          delete result[province][district].byCategoryAndTransaction[cat];
        }
      }
    }
  }

  return result;
};

exports.getDistrictCoordinatesByCity = async (req, res) => {
  try {
    const result = await processDistrictData();
    res.status(200).json(result);
  } catch (error) {
    console.error("Lỗi trong getDistrictCoordinatesByCity:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.getCompareChartData = async (req, res) => {
  try {
    const { province, district, category, transactionType } = req.query;

    if (!province || !district || !category || !transactionType) {
      return res.status(400).json({
        message: "Vui lòng cung cấp đầy đủ thông tin tỉnh, quận, loại BĐS và loại giao dịch"
      });
    }

    const currentYear = 2025;
    const currentMonth = 4;

    console.log(`Đang lấy dữ liệu cho tháng 5/2025`);
    const last12Months = [];
    for (let i = 0; i < 12; i++) {
      let month = currentMonth - i;
      let year = currentYear;
      if (month < 0) {
        month += 12;
        year -= 1;
      }
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);

      last12Months.push({
        month: month + 1,
        year,
        startDate,
        endDate,
        label: `${month + 1}/${year}`,
        data: {
          count: 0,
          totalPrice: 0,
          minPrice: Infinity,
          maxPrice: 0
        }
      });
    }

    const startDate = new Date(last12Months[11].startDate);
    const endDate = new Date(currentYear, currentMonth + 1, 0);

    const posts = await Post.find({
      status: "approved",
      visibility: "visible",
      'address.province': province,
      'address.district': district,
      category: category,
      transactionType: transactionType,
      createdAt: {
        $gte: startDate,
        $lte: endDate
      },
      price: { $gt: 0 },
      area: { $gt: 0 }
    }, {
      price: 1,
      area: 1,
      createdAt: 1,
      'address.ward': 1
    });

    let totalPosts = 0;
    let totalPricePerSqm = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    let wardData = {};

    posts.forEach(post => {
      const pricePerSqm = post.price / post.area;
      const postDate = new Date(post.createdAt);

      totalPosts++;
      totalPricePerSqm += pricePerSqm;
      minPrice = Math.min(minPrice, pricePerSqm);
      maxPrice = Math.max(maxPrice, pricePerSqm);

      const ward = post.address.ward;
      if (!wardData[ward]) {
        wardData[ward] = {
          count: 0,
          totalPrice: 0,
          minPrice: Infinity,
          maxPrice: 0
        };
      }
      wardData[ward].count++;
      wardData[ward].totalPrice += pricePerSqm;
      wardData[ward].minPrice = Math.min(wardData[ward].minPrice, pricePerSqm);
      wardData[ward].maxPrice = Math.max(wardData[ward].maxPrice, pricePerSqm);

      for (const monthData of last12Months) {
        if (postDate >= monthData.startDate && postDate <= monthData.endDate) {
          monthData.data.count++;
          monthData.data.totalPrice += pricePerSqm;
          monthData.data.minPrice = Math.min(monthData.data.minPrice, pricePerSqm);
          monthData.data.maxPrice = Math.max(monthData.data.maxPrice, pricePerSqm);
          break;
        }
      }
    });

    const timelineData = last12Months.reverse().map(monthData => {
      const avgPrice = monthData.data.count > 0
        ? monthData.data.totalPrice / monthData.data.count
        : null;

      return {
        label: monthData.label,
        avgPrice: avgPrice ? parseFloat(avgPrice.toFixed(2)) : null,
        minPrice: monthData.data.minPrice !== Infinity ? parseFloat(monthData.data.minPrice.toFixed(2)) : null,
        maxPrice: monthData.data.maxPrice > 0 ? parseFloat(monthData.data.maxPrice.toFixed(2)) : null,
        count: monthData.data.count
      };
    });

    const formattedWardData = {};
    for (const ward in wardData) {
      const data = wardData[ward];
      formattedWardData[ward] = {
        avgPrice: data.count > 0 ? parseFloat((data.totalPrice / data.count).toFixed(2)) : 0,
        minPrice: data.minPrice !== Infinity ? parseFloat(data.minPrice.toFixed(2)) : 0,
        maxPrice: data.maxPrice > 0 ? parseFloat(data.maxPrice.toFixed(2)) : 0,
        count: data.count
      };
    }

    const districtData = await processDistrictData();
    const neighboringDistricts = {};

    if (districtData[province]) {
      for (const [neighborDistrict, data] of Object.entries(districtData[province])) {
        if (neighborDistrict !== district && data.byCategoryAndTransaction &&
          data.byCategoryAndTransaction[category] &&
          data.byCategoryAndTransaction[category][transactionType]) {

          neighboringDistricts[neighborDistrict] = {
            commonPrice: data.byCategoryAndTransaction[category][transactionType].commonPrice,
            priceFluctuation: data.byCategoryAndTransaction[category][transactionType].priceFluctuation,
            count: data.byCategoryAndTransaction[category][transactionType].count
          };
        }
      }
    }

    const categoryAnalysis = {};
    if (districtData[province] && districtData[province][district]) {
      const districtInfo = districtData[province][district];
      for (const [cat, transactions] of Object.entries(districtInfo.byCategoryAndTransaction)) {
        for (const [trans, data] of Object.entries(transactions)) {
          if (!categoryAnalysis[cat]) {
            categoryAnalysis[cat] = {};
          }
          categoryAnalysis[cat][trans] = {
            commonPrice: data.commonPrice,
            priceFluctuation: data.priceFluctuation,
            count: data.count
          };
        }
      }
    }

    const avgPrice = totalPosts > 0 ? parseFloat((totalPricePerSqm / totalPosts).toFixed(2)) : 0;
    const currentPriceData = districtData[province]?.[district]?.byCategoryAndTransaction?.[category]?.[transactionType];
    const trend = currentPriceData?.priceFluctuation > 0 ? "up" :
      currentPriceData?.priceFluctuation < 0 ? "down" : "stable";

    const result = {
      overview: {
        province,
        district,
        category,
        transactionType,
        currentPrice: currentPriceData?.commonPrice || avgPrice,
        priceFluctuation: currentPriceData?.priceFluctuation || 0,
        trend,
        totalPosts,
        minPrice: minPrice !== Infinity ? parseFloat(minPrice.toFixed(2)) : 0,
        maxPrice: parseFloat(maxPrice.toFixed(2)),
        wardCount: Object.keys(wardData).length,
        analysisMonth: "5/2025",
        analysisRange: `${last12Months[0]?.label} - 5/2025`
      },
      timelineData,
      neighboringDistricts,
      wardAnalysis: formattedWardData,
      categoryAnalysis
    };

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const status = req.query.status || "";
    const visibility = req.query.visibility || "";
    const search = req.query.search || "";
    const startIndex = (page - 1) * limit;

    const query = {};

    if (status) query.status = status;
    if (visibility) query.visibility = visibility;

    if (search) {
      const searchRegex = new RegExp(search, "i");

      query.$or = [
        { title: { $regex: searchRegex } },
        { content: { $regex: searchRegex } },
        { "contactInfo.username": { $regex: searchRegex } },
        { "contactInfo.phoneNumber": { $regex: searchRegex } },
        { "address.province": { $regex: searchRegex } },
        { "address.district": { $regex: searchRegex } },
      ];
    }

    const total = await Post.countDocuments(query);

    const posts = await Post.find(query)
      .populate('contactInfo.user', 'username phoneNumber email')
      .sort({
        isVip: -1,
        priorityLevel: -1,
        createdAt: -1
      })
      .skip(startIndex)
      .limit(limit);

    res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPostById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    let post = await Post.findById(req.params.id)
      .populate('contactInfo.user', 'username phoneNumber email');

    if (!post) {
      return res.status(404).json({ message: "Bài đăng không tồn tại." });
    }

    let viewIncrement = 1;
    if (post.isVip) {
      viewIncrement = Math.floor(Math.random() * 3) + 3;
    }

    await Post.findByIdAndUpdate(req.params.id, {
      $inc: { views: viewIncrement }
    });

    post.views += viewIncrement;

    res.status(200).json(post);
  } catch (error) {
    console.error("Lỗi khi lấy chi tiết bài đăng:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Bài đăng không tồn tại." });
    }

    Object.assign(post, req.body);
    const updatedPost = await post.save();
    res.status(200).json(updatedPost);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: "Bài đăng không tồn tại." });
    }
    await Post.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Delete post successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPostsByStatus = async (req, res) => {
  try {
    const { status, visibility } = req.query;

    if (!status || !visibility) {
      return res
        .status(400)
        .json({ message: "Status and visibility are required" });
    }

    const posts = await Post.find({
      status,
      visibility,
    })
      .populate('contactInfo.user', 'username phoneNumber email')
      .sort({
        isVip: -1,
        priorityLevel: -1,
        createdAt: -1
      });

    res.status(200).json(posts);
  } catch (error) {
    console.error("Error in getPostsByStatus:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserPostsByStateAndVisibility = async (req, res) => {
  try {
    const { status, visibility } = req.query;

    if (!status || !visibility) {
      return res
        .status(400)
        .json({ message: "Status and visibility are required" });
    }

    const posts = await Post.find({
      "contactInfo.user": req.user.id,
      status,
      visibility,
    })
      .populate('contactInfo.user', 'username phoneNumber email')
      .sort({
        isVip: -1,
        createdAt: -1
      });

    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching user posts by state and visibility:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Cập nhật bài đăng
exports.updatePost = async (req, res) => {
  const { postId } = req.params;
  let updateData = req.body;

  updateData.status = "update";
  updateData.visibility = "hidden";

  try {
    const updatedPost = await Post.findByIdAndUpdate(postId, updateData, {
      new: true,
    });
    if (!updatedPost) {
      return res.status(404).json({ message: "Bài đăng không tồn tại" });
    }
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.toggleVisibility = async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Bài đăng không tồn tại" });
    }
    post.visibility = post.visibility === "visible" ? "hidden" : "visible";
    await post.save();

    res.json({
      message: "Trạng thái hiển thị đã được cập nhật",
      visibility: post.visibility,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.searchPosts = async (req, res) => {
  try {
    const {
      keyword,
      province,
      district,
      ward,
      category,
      transactionType,
      minPrice,
      maxPrice,
      minArea,
      maxArea,
    } = req.query;

    console.log("🔍 Search params:", req.query);

    const convertToNumber = (value) => {
      if (!value) return null;
      const numericValue = parseFloat(value.replace(/[^\d.-]/g, ""));
      return isNaN(numericValue) ? null : numericValue;
    };

    const filter = {
      visibility: "visible",
      status: "approved",
    };

    if (province) filter["address.province"] = province;
    if (district) filter["address.district"] = district;
    if (ward) filter["address.ward"] = ward;
    if (category) filter.category = category;
    if (transactionType) filter.transactionType = transactionType;
    if (keyword) {
      filter.$or = [
        { category: { $regex: keyword, $options: "i" } },
        { title: { $regex: keyword, $options: "i" } },
        { content: { $regex: keyword, $options: "i" } },
        { transactionType: { $regex: keyword, $options: "i" } },
        { "address.exactaddress": { $regex: keyword, $options: "i" } },
        { "address.province": { $regex: keyword, $options: "i" } },
        { "address.district": { $regex: keyword, $options: "i" } },
        { "address.ward": { $regex: keyword, $options: "i" } },
        { projectName: { $regex: keyword, $options: "i" } },
        { "propertyDetails.propertyCategory": { $regex: keyword, $options: "i" } },
        { "propertyDetails.apartmentType": { $regex: keyword, $options: "i" } },
      ];
    }

    if (minPrice || maxPrice) {
      const numericMinPrice = convertToNumber(minPrice);
      const numericMaxPrice = convertToNumber(maxPrice);

      if (numericMinPrice !== null || numericMaxPrice !== null) {
        const priceFilter = {};
        if (numericMinPrice !== null) priceFilter.$gte = numericMinPrice;
        if (numericMaxPrice !== null) priceFilter.$lte = numericMaxPrice;
        filter.price = priceFilter;
      }
    }

    if (minArea || maxArea) {
      const numericMinArea = convertToNumber(minArea);
      const numericMaxArea = convertToNumber(maxArea);

      if (numericMinArea !== null || numericMaxArea !== null) {
        const areaFilter = {};
        if (numericMinArea !== null) areaFilter.$gte = numericMinArea;
        if (numericMaxArea !== null) areaFilter.$lte = numericMaxArea;
        filter.area = areaFilter;
      }
    }
    const posts = await Post.find(filter)
      .populate('contactInfo.user', 'username phoneNumber email')
      .sort({
        isVip: -1,
        priorityLevel: -1,
        views: -1,
        createdAt: -1
      });

    const vipCount = posts.filter(post => post.isVip).length;

    res.status(200).json(posts);
  } catch (error) {
    console.error("❌ Search error:", error);
    res.status(500).json({ error: error.message });
  }
};

//Lấy post của admin theo trạng thái có phân trang
exports.getUserPostAd = async (req, res) => {
  try {
    const { status, visibility, page = 1, limit = 10 } = req.query;

    if (!status || !visibility) {
      return res
        .status(400)
        .json({ message: "Status and visibility are required" });
    }

    const startIndex = (page - 1) * limit;
    const total = await Post.countDocuments({
      "contactInfo.user": req.user.id,
      status,
      visibility,
    });

    const posts = await Post.find({
      "contactInfo.user": req.user.id,
      status,
      visibility,
    })
      .populate('contactInfo.user', 'username phoneNumber email')
      .sort({
        isVip: -1,
        createdAt: -1
      })
      .skip(startIndex)
      .limit(parseInt(limit))
      .exec();

    res.status(200).json({
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      posts,
    });
  } catch (error) {
    console.error("Error fetching user posts by state and visibility:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//Duyệt bài viết của admin
exports.approvePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ message: "Bài đăng không tồn tại" });
    }
    const daysToShow = post.defaultDaysToShow;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysToShow);

    post.status = "approved";
    post.visibility = "visible";
    post.expiryDate = expiryDate;
    post.daysRemaining = daysToShow;
    post.hoursRemaining = 0;

    await post.save();
    await checkAlertSubscriptions(post);

    const owner = await User.findById(post.contactInfo.user);
    if (owner) {
      const notification = {
        message: `Bài viết "${post.title}" của bạn đã được phê duyệt.`,
        type: "post",
        post_id: postId,
        status: "unread",
      };
      owner.notifications.push(notification);
      await owner.save();

      const socket = io();
      socket.to(owner._id.toString()).emit('notification', notification);
    }

    res
      .status(200)
      .json({ message: "Bài viết đã được phê duyệt thành công.", post });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi khi phê duyệt bài đăng", error: error.message });
  }
};

//Từ chối bài viết
exports.rejectPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findByIdAndUpdate(
      postId,
      { status: "rejected", visibility: "hidden" },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    const userId = post?.contactInfo?.user;
    if (!userId) {
      return res.status(400).json({ message: "Không tìm thấy thông tin người đăng." });
    }

    const owner = await User.findById(userId);
    if (!owner) {
      return res.status(404).json({ message: "User not found" });
    }

    const notification = {
      message: `Bài viết "${post.title}" của bạn đã bị từ chối.`,
      type: "post",
      post_id: postId,
      status: "unread",
      createdAt: new Date(),
    };

    owner.notifications.push(notification);
    await owner.save();

    const socket = io();

    if (socket) {
      socket.to(owner._id.toString()).emit("notification", notification);
    }
    res.status(200).json({
      message: "Post rejected successfully",
      post,
    });

  } catch (error) {
    console.error("Reject Post Error:", error);
    res.status(500).json({
      message: "Error rejecting post",
      error: error.message,
    });
  }
};

exports.hiddenPost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findByIdAndUpdate(
      postId,
      { status: "approved", visibility: "hidden" },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Post hidden successfully", post });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    res
      .status(500)
      .json({ message: "Error hiding post", error: error.message });
  }
};

//Hiện bài đăng của admin
exports.visiblePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const post = await Post.findByIdAndUpdate(
      postId,
      { status: "approved", visibility: "visible" },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json({ message: "Post visible successfully", post });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    res
      .status(500)
      .json({ message: "Error visible post", error: error.message });
  }
};

exports.getUserPostsByUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    const posts = await Post.find({
      "contactInfo.user": userId,
    });

    res.status(200).json(posts);
  } catch (error) {
    console.error("Error fetching user posts by user ID:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Thống kê số lượng bài đăng theo ngày
exports.getPostCountByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res
        .status(400)
        .json({ error: "startDate and endDate are required" });
    }

    const postsByDate = await Post.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
          visibility: "visible",
          status: "approved",
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json(postsByDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Thống kê 7 loại hình cho thuê có nhiều bài đăng nhất
exports.getTopCategories = async (req, res) => {
  try {
    const topCategories = await Post.aggregate([
      {
        $match: {
          visibility: "visible",
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 7 },
    ]);

    res.status(200).json(topCategories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Thống kê 7 tỉnh/thành phố có nhiều bài đăng nhất
exports.getTopProvinces = async (req, res) => {
  try {
    const topProvinces = await Post.aggregate([
      {
        $match: {
          visibility: "visible",
          status: "approved",
        },
      },
      {
        $group: {
          _id: "$address.province",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 7 },
    ]);

    res.status(200).json(topProvinces);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addToFavorites = async (req, res) => {
  const postId = req.params.id;
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      console.log(postId);
      return res.status(400).json({ message: "ID bài đăng không hợp lệ" });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    }

    if (user.favorites.includes(postId)) {
      return res
        .status(400)
        .json({ message: "Bài đăng đã có trong danh sách yêu thích" });
    }

    user.favorites.push(postId);
    await user.save();

    res.status(200).json({
      message: "Đã thêm bài đăng vào danh sách yêu thích",
      favorites: user.favorites,
    });
    console.log(postId);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

//xóa yêu thích
exports.removeFromFavorites = async (req, res) => {
  const postId = req.params.id;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    user.favorites = user.favorites.filter((fav) => fav.toString() !== postId);
    await user.save();
    console.log("User after save:", user);

    res.status(200).json({
      message: "Đã xóa bài đăng khỏi danh sách yêu thích",
      favorites: user.favorites,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.getFavorites = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("favorites");
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    res.status(200).json({ favorites: user.favorites });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.updateDefaultDaysToShow = async (req, res) => {
  const { days } = req.body;

  try {
    const now = new Date();
    const posts = await Post.find({});

    const operations = posts.map((post) => {
      const oldDaysToShow = post.defaultDaysToShow;

      const expiryDate =
        post.expiryDate && !isNaN(new Date(post.expiryDate).getTime())
          ? new Date(post.expiryDate)
          : now;

      const remainingTime = expiryDate - now;
      const remainingDays = Math.max(
        0,
        Math.floor(remainingTime / (1000 * 60 * 60 * 24))
      );
      const remainingHours = Math.max(
        0,
        Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
      );

      let newDaysRemaining, newHoursRemaining;

      if (days > oldDaysToShow) {
        newDaysRemaining = remainingDays + (days - oldDaysToShow);
        newHoursRemaining = remainingHours;
      } else {
        newDaysRemaining = Math.max(0, remainingDays - (oldDaysToShow - days));
        newHoursRemaining = remainingHours;
      }

      const newExpiryDate = new Date(
        now.getTime() +
        newDaysRemaining * (1000 * 60 * 60 * 24) +
        newHoursRemaining * (1000 * 60 * 60)
      );

      return {
        updateOne: {
          filter: { _id: post._id },
          update: {
            $set: {
              defaultDaysToShow: days,
              daysRemaining: newDaysRemaining,
              hoursRemaining: newHoursRemaining,
              expiryDate: newExpiryDate,
              visibility:
                newDaysRemaining === 0 && newHoursRemaining === 0
                  ? "hidden"
                  : "visible",
            },
          },
        },
      };
    });
    if (operations.length > 0) {
      await Post.bulkWrite(operations);
    }

    res
      .status(200)
      .json({ message: "Updated default days to show for all posts" });
  } catch (error) {
    console.error("Error updating posts:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

function calculateSimilarityScore(postA, postB) {
  let score = 0;

  if (postA.category === postB.category) score += 3;
  if (postA.transactionType === postB.transactionType) score += 2;
  if (postA.address.district === postB.address.district) score += 3;

  const wordsA = (postA.title + " " + postA.content).toLowerCase().split(/\s+/);
  const wordsB = (postB.title + " " + postB.content).toLowerCase().split(/\s+/);
  const commonWords = wordsA.filter(word => wordsB.includes(word));
  const uniqueCommon = [...new Set(commonWords)];
  score += Math.min(uniqueCommon.length, 5);

  if (postA.features && postB.features) {
    const commonFeatures = postA.features.filter(f => postB.features.includes(f));
    score += commonFeatures.length;
  }

  return score;
}

exports.getSuggestedPosts = async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = 5;

  try {
    const currentPost = await Post.findById(postId);
    if (!currentPost) {
      return res.status(404).json({ message: "Không tìm thấy bài đăng." });
    }
    const previousPosts = await Post.find({
      _id: { $lt: new mongoose.Types.ObjectId(postId) },
      status: "approved",
      visibility: "visible",
    })
      .sort({ _id: -1 })
      .limit(15);

    const nextPosts = await Post.find({
      _id: { $gt: new mongoose.Types.ObjectId(postId) },
      status: "approved",
      visibility: "visible",
    })
      .sort({ _id: 1 })
      .limit(15);

    const nearbyPosts = [...previousPosts.reverse(), ...nextPosts];
    const scoredPosts = nearbyPosts.map(post => {
      let score = calculateSimilarityScore(currentPost, post);

      if (post.isVip) {
        score += 1000;
      }

      return { post, score };
    });
    const sortedPosts = scoredPosts.sort((a, b) => b.score - a.score);
    const totalItems = sortedPosts.length;
    const totalPages = Math.ceil(totalItems / limit);
    const paginatedPosts = sortedPosts
      .slice((page - 1) * limit, page * limit)
      .map(item => item.post);

    res.status(200).json({
      currentPage: page,
      totalPages,
      totalItems,
      posts: paginatedPosts,
    });
  } catch (err) {
    console.error("Lỗi gợi ý bài đăng:", err);
    res.status(500).json({ message: "Đã xảy ra lỗi khi truy xuất bài đăng gợi ý." });
  }
};

//Đếm số bài đăng 5 tỉnh
exports.countPostsByCity = async (req, res) => {
  try {
    const { transactionType, category } = req.query;

    if (!transactionType || !category) {
      return res.status(400).json({ message: "Thiếu transactionType hoặc category" });
    }

    const cities = [
      "Thành phố Hồ Chí Minh",
      "Thành phố Đà Nẵng",
      "Thành phố Cần Thơ",
      "Tỉnh Bình Dương",
      "Thành phố Hà Nội",
    ];

    const results = {};

    for (const city of cities) {
      const count = await Post.countDocuments({
        "address.province": city,
        transactionType,
        category,
        status: "approved",
        visibility: "visible",
      });

      results[city] = count;
    }

    res.status(200).json(results);
  } catch (error) {
    console.error("Lỗi khi đếm bài viết theo thành phố:", error);
    res.status(500).json({ message: "Lỗi máy chủ" });
  }
};
