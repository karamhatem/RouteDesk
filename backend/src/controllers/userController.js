const bcrypt = require("bcrypt");
const prisma = require("../lib/prisma");

const adminOnly = (req, res) => {
  if (!req.user || req.user.role !== "ADMIN") {
    res.status(403).json({
      success: false,
      message: "Only admin can manage users",
    });
    return false;
  }

  return true;
};

const getUsers = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createUser = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const { name, phone, password, role } = req.body;

    if (!name || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Name, phone, password and role are required",
      });
    }

    if (!["ADMIN", "DRIVER", "ACCOUNTANT"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role",
      });
    }

    const exists = await prisma.user.findUnique({ where: { phone } });

    if (exists) {
      return res.status(400).json({
        success: false,
        message: "Phone already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        password: hashedPassword,
        role,
        isActive: true,
        ...(role === "DRIVER"
          ? {
              driverProfile: {
                create: {},
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const toggleUserStatus = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: "You cannot disable your own account",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      message: updatedUser.isActive
        ? "User activated successfully"
        : "User disabled successfully",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const resetUserPassword = async (req, res) => {
  try {
    if (!adminOnly(req, res)) return;

    const id = Number(req.params.id);
    const { password } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid user id",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
      select: {
        id: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    res.json({
      success: true,
      message: "Password updated successfully",
      user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getUsers,
  createUser,
  toggleUserStatus,
  resetUserPassword,
};