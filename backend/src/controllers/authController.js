const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

// إنشاء أول مدير
const createAdmin = async (req, res) => {
    try {
        const exists = await prisma.user.findFirst({
            where: {
                role: "ADMIN"
            }
        });

        if (exists) {
            return res.json({
                success: false,
                message: "Admin already exists"
            });
        }

        const password = await bcrypt.hash("admin123", 10);

        const admin = await prisma.user.create({
            data: {
                name: "Admin",
                phone: "07700000000",
                password,
                role: "ADMIN"
            }
        });

        res.json({
            success: true,
            admin: {
                id: admin.id,
                name: admin.name,
                phone: admin.phone,
                role: admin.role,
                isActive: admin.isActive,
                createdAt: admin.createdAt
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

// تسجيل الدخول
const login = async (req, res) => {
    try {
        const { phone, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { phone }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: "Account is disabled"
            });
        }

        const check = await bcrypt.compare(password, user.password);

        if (!check) {
            return res.status(401).json({
                success: false,
                message: "Wrong password"
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "30d"
            }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                role: user.role,
                isActive: user.isActive,
                createdAt: user.createdAt
            }
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
};

module.exports = {
    createAdmin,
    login
};