const prisma = require("../lib/prisma");
const bcrypt = require("bcrypt");

const formatDriver = (driver) => {
    return {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        role: driver.role,
        isActive: driver.isActive,
        createdAt: driver.createdAt,
        driverProfile: driver.driverProfile,

        assignedBusinesses: driver.assignedBusinesses
            ? driver.assignedBusinesses
                .filter((assignment) => assignment.isActive)
                .map((assignment) => ({
                    id: assignment.business.id,
                    name: assignment.business.name,
                    type: assignment.business.type,
                    phone: assignment.business.phone,
                    address: assignment.business.address,
                    isActive: assignment.business.isActive
                }))
            : []
    };
};

const createDriver = async (req, res) => {
    try {
        const { name, phone, password, vehicleType, vehiclePlate } = req.body;

        if (!name || !phone || !password) {
            return res.status(400).json({
                success: false,
                message: "Name, phone and password are required"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const exists = await prisma.user.findUnique({
            where: { phone }
        });

        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Phone already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const driver = await prisma.user.create({
            data: {
                name,
                phone,
                password: hashedPassword,
                role: "DRIVER",
                driverProfile: {
                    create: {
                        vehicleType,
                        vehiclePlate
                    }
                }
            },
            include: {
                driverProfile: true,
                assignedBusinesses: {
                    where: { isActive: true },
                    include: {
                        business: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            message: "Driver created successfully",
            driver: formatDriver(driver)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getDrivers = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const search = req.query.search || "";

        const skip = (page - 1) * limit;

        const where = {
            role: "DRIVER",
            OR: search
                ? [
                    { name: { contains: search, mode: "insensitive" } },
                    { phone: { contains: search } }
                ]
                : undefined
        };

        const [drivers, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    driverProfile: true,
                    assignedBusinesses: {
                        where: {
                            isActive: true,
                            business: {
                                isActive: true
                            }
                        },
                        include: {
                            business: true
                        },
                        orderBy: {
                            assignedAt: "desc"
                        }
                    }
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip,
                take: limit
            }),

            prisma.user.count({ where })
        ]);

        res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            drivers: drivers.map(formatDriver)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateDriver = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, phone, vehicleType, vehiclePlate } = req.body;

        const driver = await prisma.user.findUnique({
            where: { id },
            include: {
                driverProfile: true
            }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const updatedDriver = await prisma.user.update({
            where: { id },
            data: {
                name,
                phone,
                driverProfile: {
                    update: {
                        vehicleType,
                        vehiclePlate
                    }
                }
            },
            include: {
                driverProfile: true,
                assignedBusinesses: {
                    where: { isActive: true },
                    include: {
                        business: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: "Driver updated successfully",
            driver: formatDriver(updatedDriver)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deactivateDriver = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const driver = await prisma.user.findUnique({
            where: { id }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const updatedDriver = await prisma.user.update({
            where: { id },
            data: {
                isActive: false
            },
            include: {
                driverProfile: true,
                assignedBusinesses: {
                    where: { isActive: true },
                    include: {
                        business: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: "Driver deactivated successfully",
            driver: formatDriver(updatedDriver)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const activateDriver = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const driver = await prisma.user.findUnique({
            where: { id }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const updatedDriver = await prisma.user.update({
            where: { id },
            data: {
                isActive: true
            },
            include: {
                driverProfile: true,
                assignedBusinesses: {
                    where: { isActive: true },
                    include: {
                        business: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: "Driver activated successfully",
            driver: formatDriver(updatedDriver)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const changeDriverPassword = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        const driver = await prisma.user.findUnique({
            where: { id }
        });

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword
            }
        });

        res.json({
            success: true,
            message: "Driver password changed successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createDriver,
    getDrivers,
    updateDriver,
    deactivateDriver,
    activateDriver,
    changeDriverPassword
};