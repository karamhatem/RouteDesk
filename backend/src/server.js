require("dotenv").config();

const http = require("http");
const { Server } = require("socket.io");

const app = require("./app");
const socketAuth = require("./middleware/socketAuthMiddleware");
const prisma = require("./lib/prisma");
const {
    startTrackingMonitor
} = require("./services/trackingMonitor");

const server = http.createServer(app);


// ========================================
// مهلة الانقطاع المؤقت
// ========================================

const driverDisconnectTimers = new Map();

const DISCONNECT_GRACE_MS = 15000;


// ========================================
// Socket.IO
// ========================================

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: [
            "GET",
            "POST",
            "PATCH",
            "PUT"
        ]
    }
});

// نجعل Socket.IO متاحًا داخل controllers مثل transactionController
app.set("io", io);

// حفظ حالة المكالمات حتى نتجاهل الإشارات القديمة بعد الإنهاء
const activeCalls = new Map();

io.use(socketAuth);


// ========================================
// اتصال مستخدم جديد
// ========================================

io.on("connection", (socket) => {

    console.log(
        `🟢 Socket connected: ${socket.user.name} | ${socket.user.role}`
    );


    // ========================================
    // غرفة خاصة لكل مستخدم
    // ========================================

    socket.join(
        `user-${socket.user.id}`
    );


    socket.emit("chat:connected", {
        success: true,
        userId: socket.user.id
    });


    // ========================================
    // إلغاء مؤقت الانقطاع إذا عاد السائق
    // ========================================

    if (socket.user.role === "DRIVER") {

        const pendingTimer =
            driverDisconnectTimers.get(
                socket.user.id
            );


        if (pendingTimer) {

            clearTimeout(pendingTimer);

            driverDisconnectTimers.delete(
                socket.user.id
            );


            console.log(
                `🔄 Driver reconnected quickly: ${socket.user.name}`
            );
        }
    }


    // ========================================
    // الإدارة تدخل غرفة التتبع
    // ========================================

    socket.on(
        "admin:join-tracking",
        () => {

            if (
                socket.user.role !== "ADMIN" &&
                socket.user.role !== "ACCOUNTANT"
            ) {

                return socket.emit(
                    "tracking:error",
                    {
                        message:
                            "Access denied"
                    }
                );
            }


            socket.join(
                "admin-tracking"
            );


            socket.emit(
                "tracking:joined",
                {
                    success: true,

                    message:
                        "Joined live tracking room"
                }
            );
        }
    );


    // ========================================
    // استقبال موقع السائق
    // ========================================

    socket.on(
        "driver:location",
        async (data) => {

            try {

                if (
                    socket.user.role !== "DRIVER"
                ) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Only drivers can send location"
                        }
                    );
                }


                const numericLatitude =
                    Number(data.latitude);

                const numericLongitude =
                    Number(data.longitude);


                if (
                    !Number.isFinite(
                        numericLatitude
                    ) ||
                    !Number.isFinite(
                        numericLongitude
                    )
                ) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Invalid coordinates"
                        }
                    );
                }


                if (
                    numericLatitude < -90 ||
                    numericLatitude > 90 ||
                    numericLongitude < -180 ||
                    numericLongitude > 180
                ) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Coordinates are out of range"
                        }
                    );
                }


                const driverId =
                    socket.user.id;


                // ========================================
                // فحص السائق بشكل خفيف
                // ========================================

                const driver =
                    await prisma.user.findUnique({

                        where: {
                            id: driverId
                        },

                        select: {

                            id: true,

                            role: true,

                            isActive: true,

                            driverProfile: {

                                select: {

                                    locationSharingEnabled:
                                        true
                                }
                            }
                        }
                    });


                if (
                    !driver ||
                    driver.role !== "DRIVER"
                ) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Driver not found"
                        }
                    );
                }


                if (!driver.isActive) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Driver account is disabled"
                        }
                    );
                }


                if (!driver.driverProfile) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Driver profile not found"
                        }
                    );
                }


                if (
                    !driver.driverProfile
                        .locationSharingEnabled
                ) {

                    return socket.emit(
                        "tracking:error",
                        {
                            message:
                                "Location sharing is disabled"
                        }
                    );
                }


                const now = new Date();


                // ========================================
                // البحث عن حادثة انقطاع مفتوحة
                // ========================================

                const openIncident =
                    await prisma
                        .trackingIncident
                        .findFirst({

                            where: {

                                driverId,

                                endedAt: null,

                                type: {
                                    in: [
                                        "APP_INACTIVE",
                                        "CONNECTION_LOST"
                                    ]
                                }
                            },

                            orderBy: {
                                startedAt: "desc"
                            },

                            select: {

                                id: true,

                                type: true,

                                startedAt: true
                            }
                        });


                let closedIncident = null;


                // ========================================
                // إغلاق حادثة الانقطاع
                // ========================================

                if (openIncident) {

                    const durationSeconds =
                        Math.max(
                            0,

                            Math.floor(
                                (
                                    now.getTime() -

                                    openIncident
                                        .startedAt
                                        .getTime()

                                ) / 1000
                            )
                        );


                    closedIncident =
                        await prisma
                            .trackingIncident
                            .update({

                                where: {
                                    id:
                                        openIncident.id
                                },

                                data: {

                                    endedAt: now,

                                    durationSeconds
                                }
                            });
                }


                // ========================================
                // تحديث الموقع
                // ========================================

                const profile =
                    await prisma
                        .driverProfile
                        .update({

                            where: {
                                userId: driverId
                            },

                            data: {

                                lastLatitude:
                                    numericLatitude,

                                lastLongitude:
                                    numericLongitude,

                                lastSeen: now
                            },

                            select: {

                                lastLatitude: true,

                                lastLongitude: true,

                                lastSeen: true
                            }
                        });


                const payload = {

                    driverId,

                    driverName:
                        socket.user.name,

                    latitude:
                        profile.lastLatitude,

                    longitude:
                        profile.lastLongitude,

                    lastSeen:
                        profile.lastSeen
                };


                // ========================================
                // إرسال الموقع للإدارة
                // ========================================

                io.to(
                    "admin-tracking"
                ).emit(
                    "driver:location-updated",
                    payload
                );


                // ========================================
                // إبلاغ الإدارة بعودة التتبع
                // ========================================

                if (closedIncident) {

                    io.to(
                        "admin-tracking"
                    ).emit(
                        "driver:tracking-restored",
                        {

                            driverId,

                            driverName:
                                socket.user.name,

                            incidentType:
                                closedIncident.type,

                            durationSeconds:
                                closedIncident
                                    .durationSeconds,

                            restoredAt:
                                closedIncident
                                    .endedAt
                        }
                    );
                }


                socket.emit(
                    "driver:location-accepted",
                    {

                        success: true,

                        message:
                            "Location saved and broadcast successfully",

                        location: payload,

                        trackingRestored:
                            Boolean(
                                closedIncident
                            )
                    }
                );

            } catch (error) {

                console.error(
                    "Driver location error:",
                    error.message
                );


                socket.emit(
                    "tracking:error",
                    {
                        message:
                            error.message
                    }
                );
            }
        }
    );


    // ========================================
    // الدردشة الفورية
    // ========================================

    socket.on(
        "chat:send-message",
        async (data) => {

            try {

                const senderId =
                    socket.user.id;


                const receiverId =
                    Number(
                        data.receiverId
                    );


                const text =
                    data.text?.trim();


                if (
                    !Number.isInteger(
                        receiverId
                    ) ||
                    receiverId <= 0 ||
                    !text
                ) {

                    return socket.emit(
                        "chat:error",
                        {
                            message:
                                "Receiver and text are required"
                        }
                    );
                }


                if (
                    receiverId === senderId
                ) {

                    return socket.emit(
                        "chat:error",
                        {
                            message:
                                "Cannot send message to yourself"
                        }
                    );
                }


                const receiver =
                    await prisma.user.findUnique({

                        where: {
                            id: receiverId
                        },

                        select: {

                            id: true,

                            isActive: true
                        }
                    });


                if (
                    !receiver ||
                    !receiver.isActive
                ) {

                    return socket.emit(
                        "chat:error",
                        {
                            message:
                                "Receiver not found or inactive"
                        }
                    );
                }


                // ========================================
                // حفظ الرسالة
                // ========================================

                const message =
                    await prisma.message.create({

                        data: {

                            senderId,

                            receiverId,

                            text
                        },

                        include: {

                            sender: {

                                select: {

                                    id: true,

                                    name: true,

                                    role: true
                                }
                            },

                            receiver: {

                                select: {

                                    id: true,

                                    name: true,

                                    role: true
                                }
                            }
                        }
                    });


                // ========================================
                // إرسال للطرف المستقبل
                // ========================================

                io.to(
                    `user-${receiverId}`
                ).emit(
                    "chat:new-message",
                    message
                );


                // ========================================
                // إرسال نسخة للمرسل
                // ========================================

                io.to(
                    `user-${senderId}`
                ).emit(
                    "chat:new-message",
                    message
                );


                socket.emit(
                    "chat:message-sent",
                    {

                        success: true,

                        message
                    }
                );

            } catch (error) {

                console.error(
                    "Chat error:",
                    error.message
                );


                socket.emit(
                    "chat:error",
                    {
                        message:
                            error.message
                    }
                );
            }
        }
    );


    // ========================================
    // بدء اتصال صوتي أو فيديو
    // ========================================

    socket.on(
        "call:start",
        async (data) => {

            try {

                const receiverId =
                    Number(
                        data.receiverId
                    );


                const callType =
                    data.callType;


                if (
                    !Number.isInteger(
                        receiverId
                    ) ||
                    receiverId <= 0
                ) {

                    return socket.emit(
                        "call:error",
                        {
                            message:
                                "Invalid receiver"
                        }
                    );
                }


                if (
                    ![
                        "audio",
                        "video"
                    ].includes(
                        callType
                    )
                ) {

                    return socket.emit(
                        "call:error",
                        {
                            message:
                                "Call type must be audio or video"
                        }
                    );
                }


                if (
                    receiverId ===
                    socket.user.id
                ) {

                    return socket.emit(
                        "call:error",
                        {
                            message:
                                "Cannot call yourself"
                        }
                    );
                }


                const receiver =
                    await prisma.user.findUnique({

                        where: {
                            id: receiverId
                        },

                        select: {

                            id: true,

                            name: true,

                            role: true,

                            isActive: true
                        }
                    });


                if (
                    !receiver ||
                    !receiver.isActive
                ) {

                    return socket.emit(
                        "call:error",
                        {
                            message:
                                "Receiver not found or inactive"
                        }
                    );
                }


                const callerRole =
                    socket.user.role;


                const receiverRole =
                    receiver.role;


                const staffRoles = ["ADMIN", "ACCOUNTANT"];

                const allowed =
                    (
                         staffRoles.includes(callerRole) &&
                        receiverRole === "DRIVER"
                    )
                    ||
                    (
                        callerRole === "DRIVER" &&
                        staffRoles.includes(receiverRole)
                    );


                if (!allowed) {

                    return socket.emit(
                        "call:error",
                        {
                            message:
                                "Calls are allowed only between admin and driver"
                        }
                    );
                }


                const callId =
                    `${socket.user.id}-${receiverId}-${Date.now()}`;


                const payload = {

                    callId,

                    callerId:
                        socket.user.id,

                    callerName:
                        socket.user.name,

                    callerRole:
                        socket.user.role,

                    receiverId,

                    receiverName:
                        receiver.name,

                    callType,

                    startedAt:
                        new Date()
                            .toISOString()
                };


                activeCalls.set(callId, {
                    callId,
                    callerId: socket.user.id,
                    receiverId,
                    callType,
                    status: "ringing",
                    createdAt: Date.now()
                });

                // إرسال الاتصال للمستقبل

                io.to(
                    `user-${receiverId}`
                ).emit(
                    "call:incoming",
                    payload
                );


                // إخبار المتصل أن الهاتف يرن

                socket.emit(
                    "call:ringing",
                    {

                        success: true,

                        ...payload
                    }
                );

            } catch (error) {

                console.error(
                    "Call start error:",
                    error.message
                );


                socket.emit(
                    "call:error",
                    {
                        message:
                            error.message
                    }
                );
            }
        }
    );


    // ========================================
    // قبول المكالمة
    // ========================================

    socket.on(
        "call:accept",
        (data) => {

            const callerId =
                Number(
                    data.callerId
                );

            if (
                !Number.isInteger(
                    callerId
                ) ||
                callerId <= 0
            ) {

                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Invalid caller"
                    }
                );
            }

            const call =
                activeCalls.get(
                    data.callId
                );

            if (
                !call ||
                call.status === "ended" ||
                call.status === "cancelled" ||
                call.status === "rejected"
            ) {
                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Call is no longer active"
                    }
                );
            }

            call.status = "accepted";
            call.acceptedById = socket.user.id;
            activeCalls.set(data.callId, call);

            const payload = {

                callId:
                    data.callId,

                acceptedById:
                    socket.user.id,

                acceptedByName:
                    socket.user.name,

                callType:
                    data.callType || call.callType,

                acceptedAt:
                    new Date()
                        .toISOString()
            };

            io.to(
                `user-${callerId}`
            ).emit(
                "call:accepted",
                payload
            );

            socket.emit(
                "call:accepted-local",
                payload
            );
        }
    );


    // ========================================
    // رفض المكالمة
    // ========================================

    socket.on(
        "call:reject",
        (data) => {
            const call =
                activeCalls.get(
                    data.callId
                );

            const callerId =
                Number(
                    data.callerId || call?.callerId
                );

            if (
                !Number.isInteger(
                    callerId
                ) ||
                callerId <= 0
            ) {
                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Invalid caller"
                    }
                );
            }

            if (call) {
                call.status = "rejected";
                activeCalls.set(data.callId, call);
            }

            const payload = {
                callId: data.callId,
                rejectedById: socket.user.id,
                rejectedByName: socket.user.name,
                rejectedAt: new Date().toISOString()
            };

            io.to(`user-${callerId}`).emit("call:rejected", payload);
            socket.emit("call:rejected-local", payload);

            setTimeout(() => activeCalls.delete(data.callId), 5000);
        }
    );


    // ========================================
    // إلغاء اتصال قبل الرد
    // ========================================

    socket.on(
        "call:cancel",
        (data) => {
            const call =
                activeCalls.get(
                    data.callId
                );

            const receiverId =
                Number(
                    data.receiverId || call?.receiverId || call?.callerId
                );

            if (
                !Number.isInteger(
                    receiverId
                ) ||
                receiverId <= 0
            ) {
                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Invalid receiver"
                    }
                );
            }

            if (call) {
                call.status = "cancelled";
                activeCalls.set(data.callId, call);
            }

            const payload = {
                callId: data.callId,
                cancelledById: socket.user.id,
                cancelledByName: socket.user.name,
                cancelledAt: new Date().toISOString()
            };

            io.to(`user-${receiverId}`).emit("call:cancelled", payload);
            socket.emit("call:cancelled-local", payload);

            setTimeout(() => activeCalls.delete(data.callId), 5000);
        }
    );


    // ========================================
    // إنهاء مكالمة جارية
    // ========================================

    socket.on(
        "call:end",
        (data) => {
            const call =
                activeCalls.get(
                    data.callId
                );

            const targets = new Set();

            if (call) {
                call.status = "ended";
                activeCalls.set(data.callId, call);
                targets.add(Number(call.callerId));
                targets.add(Number(call.receiverId));
            }

            const otherUserId = Number(data.otherUserId);
            if (Number.isInteger(otherUserId) && otherUserId > 0) {
                targets.add(otherUserId);
            }

            targets.add(socket.user.id);

            const payload = {
                callId: data.callId,
                endedById: socket.user.id,
                endedByName: socket.user.name,
                endedAt: new Date().toISOString()
            };

            for (const targetId of targets) {
                if (Number.isInteger(targetId) && targetId > 0) {
                    io.to(`user-${targetId}`).emit("call:ended", payload);
                }
            }

            setTimeout(() => activeCalls.delete(data.callId), 5000);
        }
    );


    // ========================================
    // WebRTC OFFER
    // ========================================

    socket.on(
        "webrtc:offer",
        (data) => {

            const receiverId =
                Number(
                    data.receiverId
                );


            if (
                !Number.isInteger(
                    receiverId
                ) ||
                receiverId <= 0 ||
                !data.offer
            ) {

                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Invalid WebRTC offer"
                    }
                );
            }


            const call =
                activeCalls.get(
                    data.callId
                );

            if (!call || ["ended", "cancelled", "rejected"].includes(call.status)) {
                return;
            }

            io.to(
                `user-${receiverId}`
            ).emit(
                "webrtc:offer",
                {

                    callId:
                        data.callId,

                    senderId:
                        socket.user.id,

                    senderName:
                        socket.user.name,

                    callType:
                        data.callType,

                    offer:
                        data.offer
                }
            );
        }
    );


    // ========================================
    // WebRTC ANSWER
    // ========================================

    socket.on(
        "webrtc:answer",
        (data) => {

            const receiverId =
                Number(
                    data.receiverId
                );


            if (
                !Number.isInteger(
                    receiverId
                ) ||
                receiverId <= 0 ||
                !data.answer
            ) {

                return socket.emit(
                    "call:error",
                    {
                        message:
                            "Invalid WebRTC answer"
                    }
                );
            }


            const call =
                activeCalls.get(
                    data.callId
                );

            if (!call || ["ended", "cancelled", "rejected"].includes(call.status)) {
                return;
            }

            call.status = "active";
            activeCalls.set(data.callId, call);

            io.to(
                `user-${receiverId}`
            ).emit(
                "webrtc:answer",
                {

                    callId:
                        data.callId,

                    senderId:
                        socket.user.id,

                    answer:
                        data.answer
                }
            );
        }
    );


    // ========================================
    // WebRTC ICE CANDIDATE
    // ========================================

    socket.on(
        "webrtc:ice-candidate",
        (data) => {

            const receiverId =
                Number(
                    data.receiverId
                );


            if (
                !Number.isInteger(
                    receiverId
                ) ||
                receiverId <= 0 ||
                !data.candidate
            ) {

                return;
            }


            const call =
                activeCalls.get(
                    data.callId
                );

            if (!call || ["ended", "cancelled", "rejected"].includes(call.status)) {
                return;
            }

            io.to(
                `user-${receiverId}`
            ).emit(
                "webrtc:ice-candidate",
                {

                    callId:
                        data.callId,

                    senderId:
                        socket.user.id,

                    candidate:
                        data.candidate
                }
            );
        }
    );


    // ========================================
    // انقطاع Socket
    // ========================================

    socket.on(
        "disconnect",
        async (reason) => {

            console.log(
                `🔴 Socket disconnected: ${socket.user.name} | ${reason}`
            );


            if (
                socket.user.role !==
                "DRIVER"
            ) {

                return;
            }


            const driverId =
                socket.user.id;


            // حذف مؤقت قديم إن وجد

            const oldTimer =
                driverDisconnectTimers.get(
                    driverId
                );


            if (oldTimer) {

                clearTimeout(
                    oldTimer
                );
            }


            // ========================================
            // انتظار 15 ثانية قبل تسجيل الانقطاع
            // ========================================

            const timer =
                setTimeout(
                    async () => {

                        driverDisconnectTimers
                            .delete(
                                driverId
                            );


                        try {

                            // ========================================
                            // هل يوجد Socket آخر للسائق؟
                            // ========================================

                            const room =
                                io.sockets
                                    .adapter
                                    .rooms
                                    .get(
                                        `user-${driverId}`
                                    );


                            if (
                                room &&
                                room.size > 0
                            ) {

                                return;
                            }


                            // ========================================
                            // جلب بيانات التتبع فقط
                            // ========================================

                            const driver =
                                await prisma
                                    .user
                                    .findUnique({

                                        where: {
                                            id:
                                                driverId
                                        },

                                        select: {

                                            id: true,

                                            isActive:
                                                true,

                                            driverProfile:
                                            {

                                                select:
                                                {

                                                    locationSharingEnabled:
                                                        true,

                                                    lastLatitude:
                                                        true,

                                                    lastLongitude:
                                                        true,

                                                    lastSeen:
                                                        true
                                                }
                                            }
                                        }
                                    });


                            if (
                                !driver ||
                                !driver.isActive ||
                                !driver.driverProfile ||
                                !driver
                                    .driverProfile
                                    .locationSharingEnabled
                            ) {

                                return;
                            }


                            // ========================================
                            // منع إنشاء حادثة مكررة
                            // ========================================

                            const openIncident =
                                await prisma
                                    .trackingIncident
                                    .findFirst({

                                        where: {

                                            driverId,

                                            endedAt:
                                                null
                                        },

                                        select: {
                                            id: true
                                        }
                                    });


                            if (openIncident) {

                                return;
                            }


                            // ========================================
                            // إنشاء حادثة انقطاع
                            // ========================================

                            const incident =
                                await prisma
                                    .trackingIncident
                                    .create({

                                        data: {

                                            type:
                                                "CONNECTION_LOST",

                                            startedAt:
                                                new Date(),

                                            driverId,

                                            lastLatitude:
                                                driver
                                                    .driverProfile
                                                    .lastLatitude,

                                            lastLongitude:
                                                driver
                                                    .driverProfile
                                                    .lastLongitude,

                                            lastSeen:
                                                driver
                                                    .driverProfile
                                                    .lastSeen,

                                            note:
                                                "Driver socket connection lost"
                                        },

                                        select: {

                                            id: true,

                                            type: true,

                                            lastLatitude:
                                                true,

                                            lastLongitude:
                                                true,

                                            lastSeen:
                                                true,

                                            startedAt:
                                                true
                                        }
                                    });


                            // ========================================
                            // إبلاغ الإدارة
                            // ========================================

                            io.to(
                                "admin-tracking"
                            ).emit(
                                "driver:tracking-inactive",
                                {

                                    driverId,

                                    driverName:
                                        socket.user.name,

                                    type:
                                        incident.type,

                                    lastLatitude:
                                        incident
                                            .lastLatitude,

                                    lastLongitude:
                                        incident
                                            .lastLongitude,

                                    lastSeen:
                                        incident
                                            .lastSeen,

                                    incidentId:
                                        incident.id,

                                    startedAt:
                                        incident
                                            .startedAt
                                }
                            );

                        } catch (error) {

                            console.error(
                                "Disconnect tracking error:",
                                error.message
                            );
                        }

                    },

                    DISCONNECT_GRACE_MS
                );


            driverDisconnectTimers.set(
                driverId,
                timer
            );
        }
    );
});


// ========================================
// تشغيل مراقبة التتبع
// ========================================

startTrackingMonitor(io);


// ========================================
// تشغيل السيرفر
// ========================================

const PORT =
    process.env.PORT || 5000;


server.listen(
    PORT,
    () => {

        console.log(
            `🚀 RouteDesk Server running on port ${PORT}`
        );

        console.log(
            `🔐 Socket JWT Authentication enabled`
        );

        console.log(
            `📡 Live Tracking + Real-time Chat + Calls Socket.IO is ready`
        );
    }
);