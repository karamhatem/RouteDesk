const prisma = require("../lib/prisma");

// ========================================
// تسجيل مبلغ استلمه السائق من مكان
// ========================================
const createCollection = async (req, res) => {
    try {
        const driverId = req.user.id;

        const {
            businessId,
            amount,
            note
        } = req.body;

        const numericAmount = Number(amount);
        const numericBusinessId = Number(businessId);

        if (
            !Number.isInteger(numericBusinessId) ||
            numericBusinessId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Business is required"
            });
        }

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        const driver = await prisma.user.findUnique({
            where: {
                id: driverId
            },
            select: {
                id: true,
                role: true,
                isActive: true,

                driverProfile: {
                    select: {
                        id: true
                    }
                }
            }
        });

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

        const business = await prisma.business.findUnique({
            where: {
                id: numericBusinessId
            },
            select: {
                id: true,
                isActive: true
            }
        });

        if (!business || !business.isActive) {
            return res.status(404).json({
                success: false,
                message: "Business not found or inactive"
            });
        }

        const result = await prisma.$transaction(
            async (tx) => {

                const transaction =
                    await tx.transaction.create({
                        data: {
                            type: "COLLECTION",
                            amount: numericAmount,
                            note: note || null,

                            driverId: driverId,
                            businessId: numericBusinessId,

                            // السائق نفسه سجل عملية القبض
                            recordedBy: driverId
                        },

                        select: {
                            id: true,
                            type: true,
                            amount: true,
                            note: true,
                            createdAt: true,

                            business: {
                                select: {
                                    id: true,
                                    name: true,
                                    type: true
                                }
                            },

                            driver: {
                                select: {
                                    id: true,
                                    name: true,
                                    phone: true
                                }
                            },

                            recorder: {
                                select: {
                                    id: true,
                                    name: true,
                                    role: true
                                }
                            }
                        }
                    });

                const profile =
                    await tx.driverProfile.update({
                        where: {
                            userId: driverId
                        },

                        data: {
                            balance: {
                                increment: numericAmount
                            }
                        }
                    });

                return {
                    transaction,
                    balance: profile.balance
                };
            }
        );

        const io = req.app.get("io");

        if (io) {
            io.to(`user-${driverId}`).emit("balance:updated", {
                driverId,
                balance: result.balance,
                type: "COLLECTION",
                transaction: result.transaction
            });

            io.to("admin-tracking").emit("balance:updated", {
                driverId,
                balance: result.balance,
                type: "COLLECTION",
                transaction: result.transaction
            });
        }

        res.status(201).json({
            success: true,
            message: "Collection recorded successfully",
            transaction: result.transaction,
            currentBalance: result.balance
        });

    } catch (error) {
        console.error(
            "Create collection error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// تسجيل تسوية من المدير أو المحاسب
// ========================================
const createSettlement = async (req, res) => {
    try {
        const recorderId = req.user.id;

        const {
            driverId,
            amount,
            note
        } = req.body;

        const numericDriverId = Number(driverId);
        const numericAmount = Number(amount);

        if (
            !Number.isInteger(numericDriverId) ||
            numericDriverId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Driver is required"
            });
        }

        if (
            !Number.isFinite(numericAmount) ||
            numericAmount <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Amount must be greater than zero"
            });
        }

        const recorder = await prisma.user.findUnique({
            where: {
                id: recorderId
            },

            select: {
                id: true,
                role: true,
                isActive: true
            }
        });

        if (
            !recorder ||
            !["ADMIN", "ACCOUNTANT"].includes(
                recorder.role
            )
        ) {
            return res.status(403).json({
                success: false,
                message:
                    "Only admin or accountant can create settlements"
            });
        }

        if (!recorder.isActive) {
            return res.status(403).json({
                success: false,
                message: "Recorder account is disabled"
            });
        }

        const driver = await prisma.user.findUnique({
            where: {
                id: numericDriverId
            },

            select: {
                id: true,
                role: true,
                isActive: true,

                driverProfile: {
                    select: {
                        balance: true
                    }
                }
            }
        });

        if (
            !driver ||
            driver.role !== "DRIVER" ||
            !driver.driverProfile
        ) {
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

        if (
            numericAmount >
            driver.driverProfile.balance
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Settlement amount cannot exceed driver balance"
            });
        }

        const result = await prisma.$transaction(
            async (tx) => {

                const transaction =
                    await tx.transaction.create({
                        data: {
                            type: "SETTLEMENT",
                            amount: numericAmount,
                            note: note || null,

                            driverId: numericDriverId,
                            businessId: null,
                            recordedBy: recorderId
                        },

                        select: {
                            id: true,
                            type: true,
                            amount: true,
                            note: true,
                            createdAt: true,

                            driver: {
                                select: {
                                    id: true,
                                    name: true,
                                    phone: true
                                }
                            },

                            recorder: {
                                select: {
                                    id: true,
                                    name: true,
                                    role: true
                                }
                            }
                        }
                    });

                const profile =
                    await tx.driverProfile.update({
                        where: {
                            userId: numericDriverId
                        },

                        data: {
                            balance: {
                                decrement: numericAmount
                            }
                        }
                    });

                return {
                    transaction,
                    balance: profile.balance
                };
            }
        );

        const io = req.app.get("io");

        if (io) {
            io.to(`user-${numericDriverId}`).emit("balance:updated", {
                driverId: numericDriverId,
                balance: result.balance,
                type: "SETTLEMENT",
                transaction: result.transaction
            });

            io.to("admin-tracking").emit("balance:updated", {
                driverId: numericDriverId,
                balance: result.balance,
                type: "SETTLEMENT",
                transaction: result.transaction
            });
        }

        res.status(201).json({
            success: true,
            message: "Settlement recorded successfully",
            transaction: result.transaction,
            currentBalance: result.balance
        });

    } catch (error) {
        console.error(
            "Create settlement error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// عرض رصيد سائق
// ========================================
const getDriverBalance = async (req, res) => {
    try {
        const driverId = Number(
            req.params.driverId
        );

        if (
            !Number.isInteger(driverId) ||
            driverId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver id"
            });
        }

        const driver = await prisma.user.findUnique({
            where: {
                id: driverId
            },

            select: {
                id: true,
                name: true,
                phone: true,
                role: true,

                driverProfile: {
                    select: {
                        balance: true
                    }
                }
            }
        });

        if (
            !driver ||
            driver.role !== "DRIVER" ||
            !driver.driverProfile
        ) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        res.json({
            success: true,

            driver: {
                id: driver.id,
                name: driver.name,
                phone: driver.phone
            },

            balance:
                driver.driverProfile.balance
        });

    } catch (error) {
        console.error(
            "Get driver balance error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ========================================
// عرض سجل الحركات المالية لسائق
// Pagination
// ========================================
const getDriverTransactions = async (
    req,
    res
) => {
    try {
        const driverId = Number(
            req.params.driverId
        );

        const page = Math.max(
            Number(req.query.page) || 1,
            1
        );

        const limit = Math.min(
            Math.max(
                Number(req.query.limit) || 20,
                1
            ),
            100
        );

        const skip = (page - 1) * limit;

        if (
            !Number.isInteger(driverId) ||
            driverId <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid driver id"
            });
        }

        const driver = await prisma.user.findUnique({
            where: {
                id: driverId
            },

            select: {
                id: true,
                role: true
            }
        });

        if (
            !driver ||
            driver.role !== "DRIVER"
        ) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const where = {
            driverId: driverId
        };

        const [
            transactions,
            total
        ] = await Promise.all([

            prisma.transaction.findMany({
                where,

                select: {
                    id: true,
                    type: true,
                    amount: true,
                    note: true,
                    createdAt: true,

                    business: {
                        select: {
                            id: true,
                            name: true,
                            type: true
                        }
                    },

                    recorder: {
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

            prisma.transaction.count({
                where
            })
        ]);

        res.json({
            success: true,
            page,
            limit,
            total,

            totalPages:
                Math.ceil(total / limit),

            transactions
        });

    } catch (error) {
        console.error(
            "Get driver transactions error:",
            error.message
        );

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    createCollection,
    createSettlement,
    getDriverBalance,
    getDriverTransactions
};