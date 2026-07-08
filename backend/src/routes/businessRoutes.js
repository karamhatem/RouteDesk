const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");
const isAdmin = require("../middleware/adminMiddleware");

const {
    createBusiness,
    getBusinesses,
    getBusinessById,
    updateBusiness,
    deactivateBusiness,
    activateBusiness,
    assignBusinessToDriver,
    removeBusinessFromDriver,
    getMyBusinesses,
    getAvailableBusinesses
} = require("../controllers/businessController");


// ========================================
// عام للسائقين: كل الأماكن النشطة
// ========================================
router.get(
    "/available",
    auth,
    getAvailableBusinesses
);


// ========================================
// قديم: الأماكن المخصصة للسائق
// نخليه موجود بس ما نستخدمه هسه
// ========================================
router.get(
    "/my-businesses",
    auth,
    getMyBusinesses
);


// ========================================
// ADMIN
// ========================================

router.post(
    "/",
    auth,
    isAdmin,
    createBusiness
);

router.get(
    "/",
    auth,
    isAdmin,
    getBusinesses
);

router.post(
    "/:id/assign-driver",
    auth,
    isAdmin,
    assignBusinessToDriver
);

router.patch(
    "/:id/remove-driver/:driverId",
    auth,
    isAdmin,
    removeBusinessFromDriver
);

router.patch(
    "/:id/deactivate",
    auth,
    isAdmin,
    deactivateBusiness
);

router.patch(
    "/:id/activate",
    auth,
    isAdmin,
    activateBusiness
);

router.put(
    "/:id",
    auth,
    isAdmin,
    updateBusiness
);

// لازم يبقى بالأخير
router.get(
    "/:id",
    auth,
    isAdmin,
    getBusinessById
);

module.exports = router;