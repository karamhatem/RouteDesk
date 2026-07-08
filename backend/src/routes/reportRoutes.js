const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
    createReport,
    getReports
} = require("../controllers/reportController");


// ========================================
// مدير أو محاسب
// ========================================

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


// ========================================
// السائق ينشئ تقرير
// ========================================

router.post(
    "/",
    auth,
    createReport
);


// ========================================
// المدير والمحاسب يشوفون التقارير
// ========================================

router.get(
    "/",
    auth,
    adminOrAccountant,
    getReports
);


module.exports = router;