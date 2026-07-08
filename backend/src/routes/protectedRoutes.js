const express = require("express");

const auth = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/dashboard", auth, (req, res) => {

    res.json({
        success: true,
        message: "Welcome Admin",
        user: req.user
    });

});

module.exports = router;