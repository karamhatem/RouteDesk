const prisma = require("../lib/prisma");

// ========================================
// إرسال رسالة
// ========================================
const sendMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const { receiverId, text } = req.body;

        const numericReceiverId = Number(receiverId);

        if (!Number.isInteger(numericReceiverId) || numericReceiverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Receiver is required"
            });
        }

        if (!text || !text.trim()) {
            return res.status(400).json({
                success: false,
                message: "Message text is required"
            });
        }

        if (numericReceiverId === senderId) {
            return res.status(400).json({
                success: false,
                message: "Cannot send message to yourself"
            });
        }

        const receiver = await prisma.user.findUnique({
            where: {
                id: numericReceiverId
            },
            select: {
                id: true,
                isActive: true
            }
        });

        if (!receiver || !receiver.isActive) {
            return res.status(404).json({
                success: false,
                message: "Receiver not found or inactive"
            });
        }

        const message = await prisma.message.create({
            data: {
                senderId,
                receiverId: numericReceiverId,
                text: text.trim()
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                },
                receiver: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: "Message sent successfully",
            data: message
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// جلب المحادثة بين المستخدم الحالي وشخص آخر
// يدعم page و limit حتى لا نحمل كل الرسائل مرة واحدة
// ========================================
const getConversation = async (req, res) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = Number(req.params.userId);

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid user id"
            });
        }

        if (otherUserId === currentUserId) {
            return res.status(400).json({
                success: false,
                message: "Cannot open conversation with yourself"
            });
        }

        const otherUser = await prisma.user.findUnique({
            where: {
                id: otherUserId
            },
            select: {
                id: true,
                isActive: true
            }
        });

        if (!otherUser || !otherUser.isActive) {
            return res.status(404).json({
                success: false,
                message: "User not found or inactive"
            });
        }

        const where = {
            OR: [
                {
                    senderId: currentUserId,
                    receiverId: otherUserId
                },
                {
                    senderId: otherUserId,
                    receiverId: currentUserId
                }
            ]
        };

        const [messagesDesc, total] = await Promise.all([
            prisma.message.findMany({
                where,
                select: {
                    id: true,
                    senderId: true,
                    receiverId: true,
                    text: true,
                    isRead: true,
                    createdAt: true,
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    },
                    receiver: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip,
                take: limit
            }),

            prisma.message.count({
                where
            })
        ]);

        await prisma.message.updateMany({
            where: {
                senderId: otherUserId,
                receiverId: currentUserId,
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            messages: messagesDesc.reverse()
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// عدد الرسائل غير المقروءة
// ========================================
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await prisma.message.count({
            where: {
                receiverId: userId,
                isRead: false
            }
        });

        res.json({
            success: true,
            unreadCount: count
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// جلب أول حساب مدير نشط حتى يتواصل السائق معه
// ========================================
const getChatAdmin = async (req, res) => {
    try {
        const admin = await prisma.user.findFirst({
            where: {
                role: "ADMIN",
                isActive: true
            },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true
            },
            orderBy: {
                id: "asc"
            }
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: "Admin not found"
            });
        }

        res.json({
            success: true,
            admin
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    getChatAdmin,
    sendMessage,
    getConversation,
    getUnreadCount
};