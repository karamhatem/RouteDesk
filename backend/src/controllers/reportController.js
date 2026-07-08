const prisma = require("../lib/prisma");

const formatReport = (report) => {
    return {
        id: report.id,
        title: report.title,
        description: report.description,
        createdAt: report.createdAt,

        driver: report.driver
            ? {
                id: report.driver.id,
                name: report.driver.name,
                phone: report.driver.phone
            }
            : undefined,

        business: report.business
            ? {
                id: report.business.id,
                name: report.business.name,
                type: report.business.type,
                address: report.business.address
            }
            : undefined,

        returnItems: report.returnItems || []
    };
};

// =========================
// إنشاء تقرير من السائق
// =========================
const createReport = async (req, res) => {
    try {
        const driverId = req.user.id;

        const {
            businessId,
            title,
            description,
            returnItems
        } = req.body;

        const numericBusinessId = Number(businessId);

        if (!Number.isInteger(numericBusinessId) || numericBusinessId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Business is required"
            });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({
                success: false,
                message: "Report title is required"
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

        const safeReturnItems = Array.isArray(returnItems)
            ? returnItems
                .filter((item) =>
                    item &&
                    item.itemName &&
                    String(item.itemName).trim() &&
                    Number(item.quantity) > 0
                )
                .map((item) => ({
                    itemName: String(item.itemName).trim(),
                    quantity: Number(item.quantity),
                    reason: item.reason ? String(item.reason).trim() : null,
                    note: item.note ? String(item.note).trim() : null
                }))
            : [];

        const report = await prisma.report.create({
            data: {
                title: title.trim(),
                description: description ? String(description).trim() : null,
                driverId,
                businessId: numericBusinessId,
                returnItems: {
                    create: safeReturnItems
                }
            },
            select: {
                id: true,
                title: true,
                description: true,
                createdAt: true,

                driver: {
                    select: {
                        id: true,
                        name: true,
                        phone: true
                    }
                },

                business: {
                    select: {
                        id: true,
                        name: true,
                        type: true,
                        address: true
                    }
                },

                returnItems: true
            }
        });

        res.status(201).json({
            success: true,
            message: "Report created successfully",
            report: formatReport(report)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =========================
// عرض جميع التقارير للإدارة
// يدعم page و limit
// =========================
const getReports = async (req, res) => {
    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = (page - 1) * limit;

        const [reports, total] = await Promise.all([
            prisma.report.findMany({
                select: {
                    id: true,
                    title: true,
                    description: true,
                    createdAt: true,

                    driver: {
                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }
                    },

                    business: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            address: true
                        }
                    },

                    returnItems: true
                },
                orderBy: {
                    createdAt: "desc"
                },
                skip,
                take: limit
            }),

            prisma.report.count()
        ]);

        res.json({
            success: true,
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            reports: reports.map(formatReport)
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    createReport,
    getReports
};