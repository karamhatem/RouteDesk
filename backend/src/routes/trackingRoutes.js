const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

const {
    enableLocationSharing,
    disableLocationSharing,
    updateLocation,
    getDriversLocations,
    getTrackingIncidents
} = require("../controllers/trackingController");


// ========================================
// السائق يشغل مشاركة الموقع
// ========================================
router.patch(
    "/enable",
    auth,
    enableLocationSharing
);


// ========================================
// السائق يوقف مشاركة الموقع
// ========================================
router.patch(
    "/disable",
    auth,
    disableLocationSharing
);


// ========================================
// تطبيق السائق يرسل الموقع تلقائيًا
// ========================================
router.post(
    "/location",
    auth,
    updateLocation
);


// ========================================
// المدير يشوف مواقع جميع السواق
// ========================================
router.get(
    "/drivers",
    auth,
    isAdmin,
    getDriversLocations
);


// ========================================
// المدير يشوف تقارير توقف التتبع
// ========================================
router.get(
    "/incidents",
    auth,
    isAdmin,
    getTrackingIncidents
);


module.exports = router;