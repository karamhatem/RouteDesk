const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

const socketAuth = async (socket, next) => {
    try {
        // التوكن يأتي من:
        // socket.handshake.auth.token

        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(
                new Error("Authentication token is missing")
            );
        }

        // دعم الحالتين:
        // token فقط
        // Bearer token
        const cleanToken = token.startsWith("Bearer ")
            ? token.slice(7)
            : token;

        const decoded = jwt.verify(
            cleanToken,
            process.env.JWT_SECRET
        );

        const user = await prisma.user.findUnique({
            where: {
                id: decoded.id
            },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                isActive: true
            }
        });

        if (!user) {
            return next(
                new Error("User not found")
            );
        }

        if (!user.isActive) {
            return next(
                new Error("User account is disabled")
            );
        }

        // نخزن المستخدم الحقيقي داخل اتصال Socket
        socket.user = user;

        next();

    } catch (error) {
        next(
            new Error("Invalid or expired token")
        );
    }
};

module.exports = socketAuth;