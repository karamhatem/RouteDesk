const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

const {
    getDashboardSummary,
    getDriverDashboardDetails
} = require("../controllers/dashboardController");

const adminOrAccountant = (req, res, next) => {
    if (
        req.user &&
        ["ADMIN", "ACCOUNTANT"].includes(req.user.role)
    ) {
        return next();
    }

    return res.status(403).json({
        success: false,
        message: "Access denied. Admin or accountant only."
    });
};

// ملخص لوحة التحكم: مدير + محاسب
router.get(
    "/summary",
    auth,
    adminOrAccountant,
    getDashboardSummary
);

// تفاصيل السائق: مدير فقط
router.get(
    "/drivers/:id",
    auth,
    isAdmin,
    getDriverDashboardDetails
);

module.exports = router;