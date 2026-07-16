const prisma = require("../lib/prisma");

// ========================================
// أدوات مساعدة
// ========================================
const parsePositiveNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
};

const emitBalanceUpdate = (req, payload) => {
    const io = req.app.get("io");
    if (!io) return;

    io.to(`user-${payload.driverId}`).emit("balance:updated", payload);
    io.to("admin-tracking").emit("balance:updated", payload);
};

// ========================================
// السائق الحالي يجلب رصيده من السيرفر
// لا نعتمد على driverId قادم من التطبيق
// ========================================
const getMyBalance = async (req, res) => {
    try {
        const driverId = req.user.id;

        const driver = await prisma.user.findUnique({
            where: { id: driverId },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                isActive: true,
                driverProfile: {
                    select: { balance: true }
                }
            }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(403).json({
                success: false,
                message: "Only drivers can access this balance"
            });
        }

        if (!driver.isActive) {
            return res.status(403).json({
                success: false,
                message: "Driver account is disabled"
            });
        }

        if (!driver.driverProfile) {
            return res.status(404).json({
                success: false,
                message: "Driver profile not found"
            });
        }

        return res.json({
            success: true,
            driver: {
                id: driver.id,
                name: driver.name,
                phone: driver.phone
            },
            balance: Number(driver.driverProfile.balance || 0),
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get my balance error:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ========================================
// تسجيل مبلغ استلمه السائق من مكان
// ========================================
const createCollection = async (req, res) => {
    try {
        const driverId = req.user.id;
        const { businessId, amount, note, idempotencyKey } = req.body;

        const numericAmount = parsePositiveNumber(amount);
        const numericBusinessId = Number(businessId);

        // ========================================
        // حماية من التسجيل المكرر (ضغط مزدوج بالغلط)
        // إذا نفس الطلب انرسل قبل، نرجع نفس النتيجة القديمة
        // بدل ما نسجل المبلغ مرتين
        // ========================================
        if (idempotencyKey) {
            const existing = await prisma.transaction.findUnique({
                where: { idempotencyKey },
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,
                    business: {
                        select: { id: true, name: true, type: true }
                    },
                    driver: {
                        select: { id: true, name: true, phone: true }
                    },
                    recorder: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            if (existing) {
                const currentProfile = await prisma.driverProfile.findUnique({
                    where: { userId: driverId },
                    select: { balance: true }
                });

                return res.status(200).json({
                    success: true,
                    message: "Collection already recorded (duplicate request ignored)",
                    transaction: existing,
                    currentBalance: Number(currentProfile?.balance || 0),
                    duplicate: true
                });
            }
        }

        if (!Number.isInteger(numericBusinessId) || numericBusinessId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Business is required"
            });
        }

        if (numericAmount === null) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        const [driver, business] = await Promise.all([
            prisma.user.findUnique({
                where: { id: driverId },
                select: {
                    id: true,
                    role: true,
                    isActive: true,
                    driverProfile: { select: { id: true } }
                }
            }),
            prisma.business.findUnique({
                where: { id: numericBusinessId },
                select: { id: true, isActive: true }
            })
        ]);

        if (!driver || driver.role !== "DRIVER") {
            return res.status(403).json({
                success: false,
                message: "Only drivers can record collections"
            });
        }

        if (!driver.isActive) {
            return res.status(403).json({
                success: false,
                message: "Driver account is disabled"
            });
        }

        if (!driver.driverProfile) {
            return res.status(400).json({
                success: false,
                message: "Driver profile not found"
            });
        }

        if (!business || !business.isActive) {
            return res.status(404).json({
                success: false,
                message: "Business not found or inactive"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.create({
                data: {
                    type: "COLLECTION",
                    amount: numericAmount,
                    note: note?.trim() || null,
                    driverId,
                    businessId: numericBusinessId,
                    recordedBy: driverId,
                    idempotencyKey: idempotencyKey || null
                },
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,
                    business: {
                        select: { id: true, name: true, type: true }
                    },
                    driver: {
                        select: { id: true, name: true, phone: true }
                    },
                    recorder: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            const profile = await tx.driverProfile.update({
                where: { userId: driverId },
                data: {
                    balance: { increment: numericAmount }
                },
                select: { balance: true }
            });

            return {
                transaction,
                balance: Number(profile.balance || 0)
            };
        });

        emitBalanceUpdate(req, {
            driverId,
            balance: result.balance,
            type: "COLLECTION",
            transaction: result.transaction
        });

        return res.status(201).json({
            success: true,
            message: "Collection recorded successfully",
            transaction: result.transaction,
            currentBalance: result.balance
        });
    } catch (error) {
        // إذا وصل نفس الطلب بنفس اللحظة تماماً (نادر جداً)
        // قاعدة البيانات نفسها ترفض التكرار، ونتعامل معه بلطف
        if (error.code === "P2002" && error.meta?.target?.includes("idempotencyKey")) {
            return res.status(200).json({
                success: true,
                message: "Collection already recorded (duplicate request ignored)",
                duplicate: true
            });
        }

        console.error("Create collection error:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ========================================
// تسجيل تسوية من المدير أو المحاسب
// التحقق والخصم داخل Transaction واحدة لمنع الرصيد السالب
// ========================================
const createSettlement = async (req, res) => {
    try {
        const recorderId = req.user.id;
        const { driverId, amount, note, idempotencyKey } = req.body;

        const numericDriverId = Number(driverId);
        const numericAmount = parsePositiveNumber(amount);

        // ========================================
        // حماية من التسجيل المكرر (ضغط مزدوج بالغلط)
        // ========================================
        if (idempotencyKey) {
            const existing = await prisma.transaction.findUnique({
                where: { idempotencyKey },
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,
                    driver: {
                        select: { id: true, name: true, phone: true }
                    },
                    recorder: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            if (existing) {
                const currentProfile = await prisma.driverProfile.findUnique({
                    where: { userId: numericDriverId },
                    select: { balance: true }
                });

                return res.status(200).json({
                    success: true,
                    message: "Settlement already recorded (duplicate request ignored)",
                    transaction: existing,
                    currentBalance: Number(currentProfile?.balance || 0),
                    duplicate: true
                });
            }
        }

        if (!Number.isInteger(numericDriverId) || numericDriverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Driver is required"
            });
        }

        if (numericAmount === null) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        const [recorder, driver] = await Promise.all([
            prisma.user.findUnique({
                where: { id: recorderId },
                select: { id: true, role: true, isActive: true }
            }),
            prisma.user.findUnique({
                where: { id: numericDriverId },
                select: {
                    id: true,
                    role: true,
                    isActive: true,
                    driverProfile: { select: { balance: true } }
                }
            })
        ]);

        if (!recorder || !["ADMIN", "ACCOUNTANT"].includes(recorder.role)) {
            return res.status(403).json({
                success: false,
                message: "Only admin or accountant can create settlements"
            });
        }

        if (!recorder.isActive) {
            return res.status(403).json({
                success: false,
                message: "Recorder account is disabled"
            });
        }

        if (!driver || driver.role !== "DRIVER" || !driver.driverProfile) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        if (!driver.isActive) {
            return res.status(403).json({
                success: false,
                message: "Driver account is disabled"
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            // خصم ذري: لا يتم إذا كان الرصيد أقل من مبلغ التسوية.
            const updated = await tx.driverProfile.updateMany({
                where: {
                    userId: numericDriverId,
                    balance: { gte: numericAmount }
                },
                data: {
                    balance: { decrement: numericAmount }
                }
            });

            if (updated.count !== 1) {
                const insufficientError = new Error(
                    "Settlement amount cannot exceed driver balance"
                );
                insufficientError.code = "INSUFFICIENT_BALANCE";
                throw insufficientError;
            }

            const transaction = await tx.transaction.create({
                data: {
                    type: "SETTLEMENT",
                    amount: numericAmount,
                    note: note?.trim() || null,
                    driverId: numericDriverId,
                    businessId: null,
                    recordedBy: recorderId,
                    idempotencyKey: idempotencyKey || null
                },
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,
                    driver: {
                        select: { id: true, name: true, phone: true }
                    },
                    recorder: {
                        select: { id: true, name: true, role: true }
                    }
                }
            });

            const profile = await tx.driverProfile.findUnique({
                where: { userId: numericDriverId },
                select: { balance: true }
            });

            return {
                transaction,
                balance: Number(profile?.balance || 0)
            };
        });

        emitBalanceUpdate(req, {
            driverId: numericDriverId,
            balance: result.balance,
            type: "SETTLEMENT",
            transaction: result.transaction
        });

        return res.status(201).json({
            success: true,
            message: "Settlement recorded successfully",
            transaction: result.transaction,
            currentBalance: result.balance
        });
    } catch (error) {
        console.error("Create settlement error:", error.message);

        if (error.code === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }

        // إذا وصل نفس الطلب بنفس اللحظة تماماً (نادر جداً)
        if (error.code === "P2002" && error.meta?.target?.includes("idempotencyKey")) {
            return res.status(200).json({
                success: true,
                message: "Settlement already recorded (duplicate request ignored)",
                duplicate: true
            });
        }

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ========================================
// عرض رصيد سائق للإدارة أو المحاسب
// ========================================
const getDriverBalance = async (req, res) => {
    try {
        const driverId = Number(req.params.driverId);

        if (!Number.isInteger(driverId) || driverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver id"
            });
        }

        const driver = await prisma.user.findUnique({
            where: { id: driverId },
            select: {
                id: true,
                name: true,
                phone: true,
                role: true,
                driverProfile: { select: { balance: true } }
            }
        });

        if (!driver || driver.role !== "DRIVER" || !driver.driverProfile) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        return res.json({
            success: true,
            driver: {
                id: driver.id,
                name: driver.name,
                phone: driver.phone
            },
            balance: Number(driver.driverProfile.balance || 0),
            syncedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("Get driver balance error:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ========================================
// عرض سجل الحركات المالية لسائق
// ========================================
const getDriverTransactions = async (req, res) => {
    try {
        const driverId = Number(req.params.driverId);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;

        if (!Number.isInteger(driverId) || driverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver id"
            });
        }

        const driver = await prisma.user.findUnique({
            where: { id: driverId },
            select: { id: true, role: true }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const where = { driverId };
        const [transactions, total] = await Promise.all([
            prisma.transaction.findMany({
                where,
                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,
                    business: {
                        select: { id: true, name: true, type: true }
                    },
                    recorder: {
                        select: { id: true, name: true, role: true }
                    }
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: limit
            }),
            prisma.transaction.count({ where })
        ]);

        return res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            transactions
        });
    } catch (error) {
        console.error("Get driver transactions error:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getMyBalance,
    createCollection,
    createSettlement,
    getDriverBalance,
    getDriverTransactions
};
