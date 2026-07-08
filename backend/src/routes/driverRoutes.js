const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

const {
    createDriver,
    getDrivers,
    updateDriver,
    deactivateDriver,
    activateDriver,
    changeDriverPassword
} = require("../controllers/driverController");

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

// إضافة سائق جديد: مدير فقط
router.post("/", auth, isAdmin, createDriver);

// عرض السواق: مدير + محاسب
router.get("/", auth, adminOrAccountant, getDrivers);

// تعديل بيانات السائق: مدير فقط
router.put("/:id", auth, isAdmin, updateDriver);

// تعطيل السائق: مدير فقط
router.patch("/:id/deactivate", auth, isAdmin, deactivateDriver);

// تفعيل السائق: مدير فقط
router.patch("/:id/activate", auth, isAdmin, activateDriver);

// تغيير كلمة مرور السائق: مدير فقط
router.patch("/:id/password", auth, isAdmin, changeDriverPassword);

module.exports = router;