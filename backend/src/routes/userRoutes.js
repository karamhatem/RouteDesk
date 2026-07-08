const express = require("express");
const {
  getUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword,
} = require("../controllers/userController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, getUsers);
router.post("/", authMiddleware, createUser);
router.patch("/:id/status", authMiddleware, toggleUserStatus);
router.patch("/:id/password", authMiddleware, resetUserPassword);

module.exports = router;