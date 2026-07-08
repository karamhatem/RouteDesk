console.log("🔥 APP LOADED");

const express = require("express");
const cors = require("cors");

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