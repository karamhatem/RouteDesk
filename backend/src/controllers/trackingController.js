const prisma = require("../lib/prisma");


// =====================================================
// تشغيل مشاركة الموقع
// =====================================================
const enableLocationSharing = async (req, res) => {

    try {

        const driverId = req.user.id;

        const driver = await prisma.user.findUnique({
            where: {
                id: driverId
            },
            include: {
                driverProfile: true
            }
        });


        // التأكد أن الحساب سائق
        if (!driver || driver.role !== "DRIVER") {

            return res.status(403).json({
                success: false,
                message: "Only drivers can enable location sharing"
            });

        }


        // التأكد أن الحساب فعال
        if (!driver.isActive) {

            return res.status(403).json({
                success: false,
                message: "Driver account is disabled"
            });

        }


        // التأكد من وجود DriverProfile
        if (!driver.driverProfile) {

            return res.status(404).json({
                success: false,
                message: "Driver profile not found"
            });

        }


        // إذا الموقع شغال أصلًا
        if (driver.driverProfile.locationSharingEnabled) {

            return res.json({
                success: true,
                message: "Location sharing is already enabled"
            });

        }


        const now = new Date();


        // البحث عن حادثة مفتوحة
        const openIncident = await prisma.trackingIncident.findFirst({

            where: {
                driverId: driverId,
                endedAt: null
            },

            orderBy: {
                startedAt: "desc"
            }

        });


        let closedIncident = null;


        // إذا توجد حادثة توقف مفتوحة
        // نغلقها ونحسب مدة التوقف
        if (openIncident) {

            const durationSeconds = Math.max(
                0,
                Math.floor(
                    (now.getTime() - openIncident.startedAt.getTime()) / 1000
                )
            );


            closedIncident = await prisma.trackingIncident.update({

                where: {
                    id: openIncident.id
                },

                data: {
                    endedAt: now,
                    durationSeconds: durationSeconds
                }

            });

        }


        // تشغيل مشاركة الموقع
        const profile = await prisma.driverProfile.update({

            where: {
                userId: driverId
            },

            data: {
                locationSharingEnabled: true,
                locationSharingStartedAt: now,
                locationSharingStoppedAt: null
            }

        });


        res.json({

            success: true,

            message: "Location sharing enabled successfully",

            locationSharingEnabled:
                profile.locationSharingEnabled,

            locationSharingStartedAt:
                profile.locationSharingStartedAt,

            closedIncident: closedIncident

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



// =====================================================
// إيقاف مشاركة الموقع
// =====================================================
const disableLocationSharing = async (req, res) => {

    try {

        const driverId = req.user.id;

        const driver = await prisma.user.findUnique({

            where: {
                id: driverId
            },

            include: {
                driverProfile: true
            }

        });


        if (!driver || driver.role !== "DRIVER") {

            return res.status(403).json({
                success: false,
                message: "Only drivers can disable location sharing"
            });

        }


        if (!driver.driverProfile) {

            return res.status(404).json({
                success: false,
                message: "Driver profile not found"
            });

        }


        // إذا هو متوقف أصلًا
        if (!driver.driverProfile.locationSharingEnabled) {

            return res.json({
                success: true,
                message: "Location sharing is already disabled"
            });

        }


        const now = new Date();


        // عملية واحدة:
        // 1- نوقف المشاركة
        // 2- ننشئ حادثة تتبع
        const result = await prisma.$transaction(async (tx) => {


            const profile = await tx.driverProfile.update({

                where: {
                    userId: driverId
                },

                data: {
                    locationSharingEnabled: false,
                    locationSharingStoppedAt: now
                }

            });


            const incident = await tx.trackingIncident.create({

                data: {

                    type: "LOCATION_DISABLED",

                    startedAt: now,

                    driverId: driverId,

                    lastLatitude:
                        driver.driverProfile.lastLatitude,

                    lastLongitude:
                        driver.driverProfile.lastLongitude,

                    lastSeen:
                        driver.driverProfile.lastSeen,

                    note:
                        "Driver disabled location sharing"

                }

            });


            return {
                profile,
                incident
            };

        });


        res.json({

            success: true,

            message: "Location sharing disabled",

            locationSharingEnabled:
                result.profile.locationSharingEnabled,

            stoppedAt:
                result.profile.locationSharingStoppedAt,

            incident:
                result.incident

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



// =====================================================
// تحديث موقع السائق
// =====================================================
const updateLocation = async (req, res) => {

    try {

        const driverId = req.user.id;

        const {
            latitude,
            longitude
        } = req.body;


        const numericLatitude = Number(latitude);
        const numericLongitude = Number(longitude);


        // فحص الإحداثيات
        if (
            !Number.isFinite(numericLatitude) ||
            !Number.isFinite(numericLongitude)
        ) {

            return res.status(400).json({
                success: false,
                message: "Valid latitude and longitude are required"
            });

        }


        // حدود Latitude
        if (
            numericLatitude < -90 ||
            numericLatitude > 90
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid latitude"
            });

        }


        // حدود Longitude
        if (
            numericLongitude < -180 ||
            numericLongitude > 180
        ) {

            return res.status(400).json({
                success: false,
                message: "Invalid longitude"
            });

        }


        const driver = await prisma.user.findUnique({

            where: {
                id: driverId
            },

            include: {
                driverProfile: true
            }

        });


        if (!driver || driver.role !== "DRIVER") {

            return res.status(403).json({
                success: false,
                message: "Only drivers can update location"
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


        // لا نستقبل موقع إذا السائق موقف المشاركة
        if (
            !driver.driverProfile.locationSharingEnabled
        ) {

            return res.status(403).json({

                success: false,

                message:
                    "Location sharing is disabled. Enable it first."

            });

        }


        const now = new Date();


        const profile = await prisma.driverProfile.update({

            where: {
                userId: driverId
            },

            data: {
                lastLatitude: numericLatitude,
                lastLongitude: numericLongitude,
                lastSeen: now
            }

        });


        res.json({

            success: true,

            message: "Location updated successfully",

            location: {

                latitude:
                    profile.lastLatitude,

                longitude:
                    profile.lastLongitude,

                lastSeen:
                    profile.lastSeen

            }

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



// =====================================================
// المدير يشوف مواقع جميع السواق
// =====================================================
const getDriversLocations = async (req, res) => {

    try {

        const drivers = await prisma.user.findMany({

            where: {
                role: "DRIVER"
            },

            select: {

                id: true,
                name: true,
                phone: true,
                isActive: true,

                driverProfile: {

                    select: {

                        vehicleType: true,
                        vehiclePlate: true,

                        lastLatitude: true,
                        lastLongitude: true,
                        lastSeen: true,

                        locationSharingEnabled: true,
                        locationSharingStartedAt: true,
                        locationSharingStoppedAt: true

                    }

                }

            },

            orderBy: {
                name: "asc"
            }

        });


        res.json({

            success: true,

            total: drivers.length,

            drivers: drivers

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



// =====================================================
// المدير يشوف حوادث التتبع
// =====================================================
const getTrackingIncidents = async (req, res) => {

    try {

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


        const [
            incidents,
            total
        ] = await Promise.all([


            prisma.trackingIncident.findMany({

                include: {

                    driver: {

                        select: {
                            id: true,
                            name: true,
                            phone: true
                        }

                    }

                },

                orderBy: {
                    startedAt: "desc"
                },

                skip: skip,

                take: limit

            }),


            prisma.trackingIncident.count()

        ]);


        res.json({

            success: true,

            page: page,

            limit: limit,

            total: total,

            totalPages:
                Math.ceil(total / limit),

            incidents: incidents

        });


    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};



module.exports = {

    enableLocationSharing,

    disableLocationSharing,

    updateLocation,

    getDriversLocations,

    getTrackingIncidents

};