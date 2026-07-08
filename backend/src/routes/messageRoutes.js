const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
    sendMessage,
    getConversation,
    getChatAdmin,
    getUnreadCount
} = require("../controllers/messageController");


// إرسال رسالة
router.post(
    "/",
    auth,
    sendMessage
);


// عدد الرسائل غير المقروءة
// مهم: قبل /conversation/:userId
router.get(
    "/unread-count",
    auth,
    getUnreadCount
);


// جلب المحادثة
router.get(
    "/conversation/:userId",
    auth,
    getConversation
);

router.get(
    "/admin",
    auth,
    getChatAdmin
);


module.exports = router;