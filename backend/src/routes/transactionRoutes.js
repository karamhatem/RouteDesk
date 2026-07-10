const express = require("express");
const router = express.Router();

const auth = require("../middleware/authMiddleware");

const {
    getMyBalance,
    createCollection,
    createSettlement,
    getDriverBalance,
    getDriverTransactions
} = require("../controllers/transactionController");


// ========================================
// مدير أو محاسب فقط
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
// السائق الحالي يجلب رصيده بنفسه
// مهم: يجب أن يكون قبل /driver/:driverId
// ========================================

router.get(
    "/me/balance",
    auth,
    getMyBalance
);


// ========================================
// السائق يسجل مبلغ استلمه من مكان
// ========================================

router.post(
    "/collection",
    auth,
    createCollection
);


// ========================================
// المدير أو المحاسب يسجل تسوية
// ========================================

router.post(
    "/settlement",
    auth,
    adminOrAccountant,
    createSettlement
);


// ========================================
// المدير أو المحاسب يعرض رصيد سائق
// ========================================

router.get(
    "/driver/:driverId/balance",
    auth,
    adminOrAccountant,
    getDriverBalance
);


// ========================================
// المدير أو المحاسب يعرض سجل حركات السائق
// ========================================

router.get(
    "/driver/:driverId",
    auth,
    adminOrAccountant,
    getDriverTransactions
);


module.exports = router;