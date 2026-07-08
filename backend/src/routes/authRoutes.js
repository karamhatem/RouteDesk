const express = require("express");

const router = express.Router();

const {
    createAdmin,
    login
} = require("../controllers/authController");

router.post("/create-admin", createAdmin);

router.post("/login", login);

module.exports = router;