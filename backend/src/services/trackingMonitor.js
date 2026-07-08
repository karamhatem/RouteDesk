const prisma = require("../lib/prisma");

// نعتبر السائق غير نشط إذا لم يصل موقع لمدة دقيقتين
const INACTIVE_AFTER_SECONDS = 120;

// نفحص كل 30 ثانية
const CHECK_INTERVAL_MS = 30000;

let monitorRunning = false;

const checkInactiveDrivers = async (io) => {
    if (monitorRunning) return;

    monitorRunning = true;

    try {
        const threshold = new Date(
            Date.now() - INACTIVE_AFTER_SECONDS * 1000
        );

        const inactiveProfiles = await prisma.driverProfile.findMany({
            where: {
                locationSharingEnabled: true,
                lastSeen: {
                    lt: threshold
                }
            },
            select: {
                userId: true,
                lastLatitude: true,
                lastLongitude: true,
                lastSeen: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        isActive: true,
                        role: true
                    }
                }
            }
        });

        for (const profile of inactiveProfiles) {
            if (
                !profile.user ||
                !profile.user.isActive ||
                profile.user.role !== "DRIVER"
            ) {
                continue;
            }

            const driverId = profile.userId;

            const openIncident = await prisma.trackingIncident.findFirst({
                where: {
                    driverId,
                    endedAt: null
                },
                select: {
                    id: true
                },
                orderBy: {
                    startedAt: "desc"
                }
            });

            if (openIncident) continue;

            const incident = await prisma.trackingIncident.create({
                data: {
                    type: "APP_INACTIVE",
                    startedAt: profile.lastSeen || new Date(),
                    driverId,
                    lastLatitude: profile.lastLatitude,
                    lastLongitude: profile.lastLongitude,
                    lastSeen: profile.lastSeen,
                    note: "Driver stopped sending location updates"
                },
                select: {
                    id: true,
                    type: true,
                    startedAt: true,
                    lastLatitude: true,
                    lastLongitude: true,
                    lastSeen: true
                }
            });

            console.log(
                `⚠️ Tracking inactivity detected: ${profile.user.name}`
            );

            io.to("admin-tracking").emit(
                "driver:tracking-inactive",
                {
                    driverId: profile.user.id,
                    driverName: profile.user.name,
                    type: incident.type,
                    lastLatitude: incident.lastLatitude,
                    lastLongitude: incident.lastLongitude,
                    lastSeen: incident.lastSeen,
                    incidentId: incident.id,
                    startedAt: incident.startedAt
                }
            );
        }

    } catch (error) {
        console.error(
            "Tracking monitor error:",
            error.message
        );
    } finally {
        monitorRunning = false;
    }
};

const startTrackingMonitor = (io) => {
    console.log("🛰️ Tracking inactivity monitor started");

    checkInactiveDrivers(io);

    setInterval(() => {
        checkInactiveDrivers(io);
    }, CHECK_INTERVAL_MS);
};

module.exports = {
    startTrackingMonitor
};