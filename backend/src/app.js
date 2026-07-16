console.log("🔥 APP LOADED");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const messageRoutes = require("./routes/messageRoutes");
const driverRoutes = require("./routes/driverRoutes");
const protectedRoutes = require("./routes/protectedRoutes");
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const businessRoutes = require("./routes/businessRoutes");
const reportRoutes = require("./routes/reportRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const trackingRoutes = require("./routes/trackingRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();


// ========================================
// Helmet: يضيف ترويسات أمان قياسية
// (يمنع أنواع هجمات معروفة مثل clickjacking، sniffing)
// ========================================

app.use(
    helmet({
        // معطل لأن التطبيق مش موقع HTML يعرض صور/سكربتات من مصادر خارجية،
        // وتفعيله الافتراضي يكسر بعض تطبيقات الموبايل/الـAPI أحياناً
        contentSecurityPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" }
    })
);


// ========================================
// حد أقصى للمحاولات: يمنع تخمين كلمات السر
// (Brute Force Protection)
// ========================================

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 10, // 10 محاولات كحد أقصى بنفس الـ15 دقيقة لكل IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "محاولات دخول كثيرة جداً. حاول مرة ثانية بعد 15 دقيقة"
    }
});

// حد أعم لباقي الـAPI، يحمي من إغراق السيرفر بطلبات آلية
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600, // 600 طلب لكل IP كل 15 دقيقة (سخي بما يكفي للاستخدام الطبيعي)
    standardHeaders: true,
    legacyHeaders: false
});


// ========================================
// CORS
// ========================================

app.use(
    cors({
        origin: "*",

        methods: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "OPTIONS"
        ],

        allowedHeaders: [
            "Content-Type",
            "Authorization"
        ]
    })
);


// ========================================
// JSON Middleware
// ========================================

app.use(express.json());

app.use("/api", generalLimiter);
app.use("/api/auth/login", loginLimiter);


// ========================================
// الصفحة الرئيسية
// ========================================

app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "🚀 RouteDesk Backend يعمل بنجاح"
    });

});


// ========================================
// اختبار وصول تطبيق الهاتف إلى API
// ========================================

app.get("/api/ping", (req, res) => {

    res.json({
        success: true,
        message: "API is reachable"
    });

});


// ========================================
// Routes
// ========================================

app.use("/api/users", userRoutes);

app.use("/api/auth", authRoutes);

app.use("/api", protectedRoutes);

app.use("/api/drivers", driverRoutes);

app.use("/api/businesses", businessRoutes);

app.use("/api/reports", reportRoutes);

app.use("/api/transactions", transactionRoutes);

app.use("/api/tracking", trackingRoutes);

app.use("/api/dashboard", dashboardRoutes);

app.use("/api/messages", messageRoutes);


// ========================================
// 404
// ========================================

app.use((req, res) => {

    res.status(404).json({
        success: false,
        message: "Route not found"
    });

});


// ========================================
// Global Error Handler
// ========================================

app.use((error, req, res, next) => {

    console.error(
        "Global API Error:",
        error.message
    );

    res.status(
        error.status || 500
    ).json({
        success: false,
        message:
            error.message ||
            "Internal server error"
    });

});


module.exports = app;