const prisma = require("../lib/prisma");

const formatBusiness = (business) => {
    return {
        id: business.id,
        name: business.name,
        type: business.type,
        phone: business.phone,
        address: business.address,
        latitude: business.latitude,
        longitude: business.longitude,
        isActive: business.isActive,
        createdAt: business.createdAt
    };
};

const createBusiness = async (req, res) => {
    try {
        const { name, type, phone, address, latitude, longitude } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Business name is required"
            });
        }

        const allowedTypes = [
            "RESTAURANT",
            "SUPERMARKET",
            "PHARMACY",
            "BAKERY",
            "FLOWERS",
            "STORE",
            "OTHER"
        ];

        const businessType = type || "OTHER";

        if (!allowedTypes.includes(businessType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid business type"
            });
        }

        const business = await prisma.business.create({
            data: {
                name: name.trim(),
                type: businessType,
                phone: phone || null,
                address: address || null,
                latitude: latitude !== undefined && latitude !== null ? Number(latitude) : null,
                longitude: longitude !== undefined && longitude !== null ? Number(longitude) : null
            }
        });

        res.status(201).json({
            success: true,
            message: "Business created successfully",
            business: formatBusiness(business)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getBusinesses = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const search = req.query.search?.trim() || "";
        const type = req.query.type?.trim() || "";
        const skip = (page - 1) * limit;

        const where = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { address: { contains: search, mode: "insensitive" } }
            ];
        }

        if (type) {
            where.type = type;
        }

        const [businesses, total] = await Promise.all([
            prisma.business.findMany({
                where,
                orderBy: { createdAt: "desc" },
                skip,
                take: limit
            }),
            prisma.business.count({ where })
        ]);

        res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            businesses: businesses.map(formatBusiness)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getBusinessById = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid business id"
            });
        }

        const business = await prisma.business.findUnique({
            where: { id }
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        res.json({
            success: true,
            business: formatBusiness(business)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateBusiness = async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { name, type, phone, address, latitude, longitude } = req.body;

        const business = await prisma.business.findUnique({
            where: { id }
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        const allowedTypes = [
            "RESTAURANT",
            "SUPERMARKET",
            "PHARMACY",
            "BAKERY",
            "FLOWERS",
            "STORE",
            "OTHER"
        ];

        if (type && !allowedTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid business type"
            });
        }

        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: {
                name: name !== undefined ? name.trim() : undefined,
                type: type !== undefined ? type : undefined,
                phone: phone !== undefined ? phone : undefined,
                address: address !== undefined ? address : undefined,
                latitude: latitude !== undefined ? latitude === null ? null : Number(latitude) : undefined,
                longitude: longitude !== undefined ? longitude === null ? null : Number(longitude) : undefined
            }
        });

        res.json({
            success: true,
            message: "Business updated successfully",
            business: formatBusiness(updatedBusiness)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deactivateBusiness = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const business = await prisma.business.findUnique({
            where: { id }
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: { isActive: false }
        });

        res.json({
            success: true,
            message: "Business deactivated successfully",
            business: formatBusiness(updatedBusiness)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const activateBusiness = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const business = await prisma.business.findUnique({
            where: { id }
        });

        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        const updatedBusiness = await prisma.business.update({
            where: { id },
            data: { isActive: true }
        });

        res.json({
            success: true,
            message: "Business activated successfully",
            business: formatBusiness(updatedBusiness)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const assignBusinessToDriver = async (req, res) => {
    try {
        const businessId = Number(req.params.id);
        const driverId = Number(req.body.driverId);

        if (!Number.isInteger(businessId) || businessId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid businessId or driverId"
            });
        }

        const [business, driver] = await Promise.all([
            prisma.business.findUnique({ where: { id: businessId } }),
            prisma.user.findUnique({ where: { id: driverId } })
        ]);

        if (!business) {
            return res.status(404).json({
                success: false,
                message: "Business not found"
            });
        }

        if (!driver || driver.role !== "DRIVER") {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const assignment = await prisma.driverBusiness.upsert({
            where: {
                driverId_businessId: {
                    driverId,
                    businessId
                }
            },
            update: { isActive: true },
            create: {
                driverId,
                businessId,
                isActive: true
            },
            include: {
                driver: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },
                business: true
            }
        });

        res.json({
            success: true,
            message: "Business assigned to driver successfully",
            assignment
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const removeBusinessFromDriver = async (req, res) => {
    try {
        const businessId = Number(req.params.id);
        const driverId = Number(req.params.driverId);

        if (!Number.isInteger(businessId) || businessId <= 0 || !Number.isInteger(driverId) || driverId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid businessId or driverId"
            });
        }

        const assignment = await prisma.driverBusiness.findUnique({
            where: {
                driverId_businessId: {
                    driverId,
                    businessId
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: "Assignment not found"
            });
        }

        await prisma.driverBusiness.update({
            where: {
                driverId_businessId: {
                    driverId,
                    businessId
                }
            },
            data: { isActive: false }
        });

        res.json({
            success: true,
            message: "Business removed from driver successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getMyBusinesses = async (req, res) => {
    try {
        if (req.user.role !== "DRIVER") {
            return res.status(403).json({
                success: false,
                message: "Drivers only"
            });
        }

        const assignments = await prisma.driverBusiness.findMany({
            where: {
                driverId: req.user.id,
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
        });

        const businesses = assignments.map((assignment) =>
            formatBusiness(assignment.business)
        );

        res.json({
            success: true,
            total: businesses.length,
            businesses
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
const getAvailableBusinesses = async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            where: {
                isActive: true
            },
            orderBy: {
                name: "asc"
            }
        });

        res.json({
            success: true,
            total: businesses.length,
            businesses: businesses.map(formatBusiness)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getAvailableBusinesses,
    createBusiness,
    getBusinesses,
    getBusinessById,
    updateBusiness,
    deactivateBusiness,
    activateBusiness,
    assignBusinessToDriver,
    removeBusinessFromDriver,
    getMyBusinesses
};