const prisma = require("../lib/prisma");

const getTrackingStatus = (profile, openIncident) => {
    if (openIncident) {
        return openIncident.type;
    }

    if (
        profile &&
        profile.locationSharingEnabled &&
        profile.lastSeen
    ) {
        return "ONLINE";
    }

    if (
        profile &&
        !profile.locationSharingEnabled
    ) {
        return "LOCATION_DISABLED";
    }

    return "NO_LOCATION";
};

const getDashboardSummary = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 100, 200);

        const [
            totalDrivers,
            activeDrivers,
            totalBusinesses,
            totalReports,
            openTrackingIncidents
        ] = await Promise.all([
            prisma.user.count({ where: { role: "DRIVER" } }),
            prisma.user.count({ where: { role: "DRIVER", isActive: true } }),
            prisma.business.count({ where: { isActive: true } }),
            prisma.report.count(),
            prisma.trackingIncident.count({ where: { endedAt: null } })
        ]);

        const drivers = await prisma.user.findMany({
            where: { role: "DRIVER" },
            take: limit,
            select: {
                id: true,
                name: true,
                phone: true,
                isActive: true,

                driverProfile: {
                    select: {
                        vehicleType: true,
                        vehiclePlate: true,
                        balance: true,
                        lastLatitude: true,
                        lastLongitude: true,
                        lastSeen: true,
                        locationSharingEnabled: true
                    }
                },

                trackingIncidents: {
                    where: { endedAt: null },
                    orderBy: { startedAt: "desc" },
                    take: 1,
                    select: {
                        id: true,
                        type: true,
                        startedAt: true,
                        lastLatitude: true,
                        lastLongitude: true,
                        lastSeen: true
                    }
                }
            },
            orderBy: { name: "asc" }
        });

        const driverSummaries = drivers.map((driver) => {
            const profile = driver.driverProfile;
            const openIncident =
                driver.trackingIncidents.length > 0
                    ? driver.trackingIncidents[0]
                    : null;

            return {
                id: driver.id,
                name: driver.name,
                phone: driver.phone,
                isActive: driver.isActive,

                vehicle: {
                    type: profile?.vehicleType || null,
                    plate: profile?.vehiclePlate || null
                },

                balance: profile?.balance || 0,

                tracking: {
                    status: getTrackingStatus(profile, openIncident),
                    latitude: profile?.lastLatitude || null,
                    longitude: profile?.lastLongitude || null,
                    lastSeen: profile?.lastSeen || null,
                    sharingEnabled: profile?.locationSharingEnabled || false,
                    openIncident
                }
            };
        });

        res.json({
            success: true,
            summary: {
                totalDrivers,
                activeDrivers,
                inactiveDrivers: totalDrivers - activeDrivers,
                totalBusinesses,
                totalReports,
                openTrackingIncidents
            },
            drivers: driverSummaries
        });

    } catch (error) {
        console.error("Dashboard summary error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getDriverDashboardDetails = async (req, res) => {
    try {
        const driverId = Number(req.params.id);

        if (!Number.isInteger(driverId) || driverId <= 0) {
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
                isActive: true,
                createdAt: true,

                driverProfile: true,

                reports: {
                    include: {
                        business: true,
                        returnItems: true
                    },
                    orderBy: {
                        createdAt: "desc"
                    },
                    take: 20
                },

                driverTransactions: {
                    include: {
                        business: true,
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
                    take: 30
                },

                trackingIncidents: {
                    orderBy: {
                        startedAt: "desc"
                    },
                    take: 30
                }
            }
        });

        if (!driver) {
            return res.status(404).json({
                success: false,
                message: "Driver not found"
            });
        }

        const openIncident =
            driver.trackingIncidents.find(
                (incident) => incident.endedAt === null
            ) || null;

        const profile = driver.driverProfile;

        res.json({
            success: true,
            driver: {
                id: driver.id,
                name: driver.name,
                phone: driver.phone,
                isActive: driver.isActive,
                createdAt: driver.createdAt,

                vehicle: {
                    type: profile?.vehicleType || null,
                    plate: profile?.vehiclePlate || null
                },

                balance: profile?.balance || 0,

                tracking: {
                    status: getTrackingStatus(profile, openIncident),
                    latitude: profile?.lastLatitude || null,
                    longitude: profile?.lastLongitude || null,
                    lastSeen: profile?.lastSeen || null,
                    sharingEnabled: profile?.locationSharingEnabled || false,
                    openIncident
                }
            },

            reports: driver.reports.map((report) => ({
                id: report.id,
                title: report.title,
                description: report.description,
                createdAt: report.createdAt,
                business: report.business
                    ? {
                        id: report.business.id,
                        name: report.business.name,
                        type: report.business.type,
                        address: report.business.address
                    }
                    : null,
                returnItems: report.returnItems
            })),

            transactions: driver.driverTransactions.map((transaction) => ({
                id: transaction.id,
                type: transaction.type,
                amount: transaction.amount,
                note: transaction.note,
                createdAt: transaction.createdAt,
                business: transaction.business
                    ? {
                        id: transaction.business.id,
                        name: transaction.business.name,
                        type: transaction.business.type
                    }
                    : null,
                recorder: transaction.recorder
            })),

            trackingIncidents: driver.trackingIncidents
        });

    } catch (error) {
        console.error("Driver dashboard details error:", error.message);

        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getDashboardSummary,
    getDriverDashboardDetails
};