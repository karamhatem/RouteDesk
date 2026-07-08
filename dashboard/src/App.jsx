import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import LiveTrackingMap from "./components/LiveTrackingMap";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";



function App() {
  const chatSocketRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatBoxRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteMediaRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const activeCallIdRef = useRef(null);
  const ringtoneTimerRef = useRef(null);
  const audioContextRef = useRef(null);

  const [data, setData] = useState(null);
  const [driverDetails, setDriverDetails] = useState(null);
  const [view, setView] = useState("dashboard");

  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("07700000000");
  const [password, setPassword] = useState("admin123");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [businesses, setBusinesses] = useState([]);
  const [businessLoading, setBusinessLoading] = useState(false);
  const [businessMessage, setBusinessMessage] = useState("");
  const [newBusiness, setNewBusiness] = useState({
    name: "",
    type: "SUPERMARKET",
    phone: "",
    address: "",
  });

  const [allDrivers, setAllDrivers] = useState([]);
  const [driversLoading, setDriversLoading] = useState(false);
  const [driverMessage, setDriverMessage] = useState("");

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  const [accountsDrivers, setAccountsDrivers] = useState([]);
  const [selectedAccountDriver, setSelectedAccountDriver] = useState(null);
  const [accountTransactions, setAccountTransactions] = useState([]);
  const [accountBalance, setAccountBalance] = useState(0);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const [trackingIncidents, setTrackingIncidents] = useState([]);
  const [incidentsLoading, setIncidentsLoading] = useState(false);

  const [chatDrivers, setChatDrivers] = useState([]);
  const [selectedChatDriver, setSelectedChatDriver] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessage, setChatMessage] = useState("");

  const [outgoingCall, setOutgoingCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");
  const [activeCallType, setActiveCallType] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const [newDriver, setNewDriver] = useState({
    name: "",
    phone: "",
    password: "",
    vehicleType: "",
    vehiclePlate: "",
  });

  // ========================================
  // User Management
  // ========================================
  const [systemUsers, setSystemUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userMessage, setUserMessage] = useState("");
  const [passwordResetUserId, setPasswordResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [newSystemUser, setNewSystemUser] = useState({
    name: "",
    phone: "",
    password: "",
    role: "DRIVER",
  });

  const loadDashboard = async (providedToken = null, providedUser = null) => {
    try {
      setLoading(true);
      setError("");

      const currentToken = providedToken || localStorage.getItem("token");
      const currentUser =
        providedUser ||
        (localStorage.getItem("user")
          ? JSON.parse(localStorage.getItem("user"))
          : null);

      if (!currentToken || !currentUser) {
        setData(null);
        setUser(null);
        return;
      }

      const response = await fetch(`${API_URL}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);
        setData(null);
        throw new Error(result.message || "فشل تحميل البيانات");
      }

      setUser(currentUser);
      setData(result);
      setView("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDriverDetails = async (driverId) => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/dashboard/drivers/${driverId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "فشل تحميل تفاصيل السائق");
      }

      setDriverDetails(result);
      setView("driver-details");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBusinesses = async () => {
    try {
      setBusinessLoading(true);
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/businesses?limit=100`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل المحلات");
      }

      setBusinesses(result.businesses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusinessLoading(false);
    }
  };

  const openBusinesses = async () => {
    setView("businesses");
    setBusinessMessage("");
    await loadBusinesses();
  };

  const createBusiness = async (e) => {
    e.preventDefault();

    try {
      setBusinessLoading(true);
      setBusinessMessage("");
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/businesses`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(newBusiness),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل إضافة المكان");
      }

      setNewBusiness({
        name: "",
        type: "SUPERMARKET",
        phone: "",
        address: "",
      });

      setBusinessMessage("تمت إضافة المكان بنجاح");
      await loadBusinesses();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusinessLoading(false);
    }
  };

  const toggleBusiness = async (business) => {
    try {
      setBusinessLoading(true);
      setBusinessMessage("");
      setError("");

      const action = business.isActive ? "deactivate" : "activate";
      const currentToken = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/businesses/${business.id}/${action}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${currentToken}` },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تغيير حالة المكان");
      }

      setBusinessMessage(
        business.isActive ? "تم تعطيل المكان" : "تم تفعيل المكان"
      );

      await loadBusinesses();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusinessLoading(false);
    }
  };

  const loadDrivers = async () => {
    try {
      setDriversLoading(true);
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drivers?limit=100`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل السائقين");
      }

      setAllDrivers(result.drivers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDriversLoading(false);
    }
  };

  const openDrivers = async () => {
    setView("drivers");
    setDriverMessage("");
    setError("");
    await loadDrivers();
  };

  const createDriver = async (e) => {
    e.preventDefault();

    try {
      setDriversLoading(true);
      setDriverMessage("");
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drivers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(newDriver),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل إضافة السائق");
      }

      setNewDriver({
        name: "",
        phone: "",
        password: "",
        vehicleType: "",
        vehiclePlate: "",
      });

      setDriverMessage("تمت إضافة السائق بنجاح");
      await loadDrivers();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setDriversLoading(false);
    }
  };

  const toggleDriver = async (driver) => {
    try {
      setDriversLoading(true);
      setDriverMessage("");
      setError("");

      const action = driver.isActive ? "deactivate" : "activate";
      const currentToken = localStorage.getItem("token");

      const response = await fetch(
        `${API_URL}/drivers/${driver.id}/${action}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${currentToken}` },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تغيير حالة السائق");
      }

      setDriverMessage(
        driver.isActive ? "تم تعطيل السائق" : "تم تفعيل السائق"
      );

      await loadDrivers();
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setDriversLoading(false);
    }
  };

  // ========================================
  // إدارة المستخدمين
  // ========================================

  const loadSystemUsers = async () => {
    try {
      setUsersLoading(true);
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/users`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل المستخدمين");
      }

      setSystemUsers(result.users || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const openUsers = async () => {
    setView("users");
    setError("");
    setUserMessage("");
    setPasswordResetUserId(null);
    setNewPassword("");
    await loadSystemUsers();
  };

  const createSystemUser = async (e) => {
    e.preventDefault();

    try {
      setUsersLoading(true);
      setError("");
      setUserMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify(newSystemUser),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل إنشاء الحساب");
      }

      setNewSystemUser({
        name: "",
        phone: "",
        password: "",
        role: "DRIVER",
      });

      setUserMessage("تم إنشاء الحساب بنجاح");
      await loadSystemUsers();
      await loadDashboard();
      setView("users");
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const toggleSystemUser = async (systemUser) => {
    try {
      setUsersLoading(true);
      setError("");
      setUserMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/users/${systemUser.id}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تغيير حالة الحساب");
      }

      setUserMessage(
        result.user?.isActive
          ? "تم تفعيل الحساب بنجاح"
          : "تم تعطيل الحساب بنجاح"
      );

      await loadSystemUsers();
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const resetSystemUserPassword = async (e, userId) => {
    e.preventDefault();

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل");
      }

      setUsersLoading(true);
      setError("");
      setUserMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/users/${userId}/password`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentToken}`,
          },
          body: JSON.stringify({
            password: newPassword,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تغيير كلمة المرور");
      }

      setPasswordResetUserId(null);
      setNewPassword("");
      setUserMessage("تم تغيير كلمة المرور بنجاح");
    } catch (err) {
      setError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const getRoleLabel = (role) => {
    if (role === "ADMIN") return "مدير";
    if (role === "ACCOUNTANT") return "محاسب";
    if (role === "DRIVER") return "سائق";
    return role;
  };

  const loadReports = async () => {
    try {
      setReportsLoading(true);
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/reports?limit=100`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل التقارير");
      }

      setReports(result.reports || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setReportsLoading(false);
    }
  };

  const openReports = async () => {
    setView("reports");
    setError("");
    await loadReports();
  };

  const loadAccountDriver = async (driver) => {
    try {
      setAccountsLoading(true);
      setError("");
      setAccountMessage("");

      const currentToken = localStorage.getItem("token");

      const [balanceResponse, transactionsResponse] = await Promise.all([
        fetch(`${API_URL}/transactions/driver/${driver.id}/balance`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
        fetch(`${API_URL}/transactions/driver/${driver.id}`, {
          headers: { Authorization: `Bearer ${currentToken}` },
        }),
      ]);

      const balanceResult = await balanceResponse.json();
      const transactionsResult = await transactionsResponse.json();

      if (!balanceResponse.ok || !balanceResult.success) {
        throw new Error(balanceResult.message || "فشل تحميل رصيد السائق");
      }

      if (!transactionsResponse.ok || !transactionsResult.success) {
        throw new Error(transactionsResult.message || "فشل تحميل سجل الحركات");
      }

      setSelectedAccountDriver(driver);
      setAccountBalance(
        Number(
          balanceResult.balance ??
          balanceResult.driver?.balance ??
          driver.driverProfile?.balance ??
          0
        )
      );
      setAccountTransactions(transactionsResult.transactions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setAccountsLoading(false);
    }
  };

  const openAccounts = async () => {
    try {
      setView("accounts");
      setAccountsLoading(true);
      setError("");
      setAccountMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drivers?limit=100`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل السائقين");
      }

      const list = result.drivers || [];
      setAccountsDrivers(list);

      if (list.length > 0) {
        await loadAccountDriver(list[0]);
      } else {
        setSelectedAccountDriver(null);
        setAccountTransactions([]);
        setAccountBalance(0);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setAccountsLoading(false);
    }
  };

  const createSettlement = async (e) => {
    e.preventDefault();

    try {
      if (!selectedAccountDriver) {
        throw new Error("اختر سائقًا أولًا");
      }

      const amount = Number(settlementAmount);

      if (!amount || amount <= 0) {
        throw new Error("أدخل مبلغ تسوية صحيح");
      }

      setAccountsLoading(true);
      setError("");
      setAccountMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/transactions/settlement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${currentToken}`,
        },
        body: JSON.stringify({
          driverId: selectedAccountDriver.id,
          amount,
          note: settlementNote || null,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تسجيل التسوية");
      }

      setSettlementAmount("");
      setSettlementNote("");
      setAccountMessage("تم تسجيل التسوية بنجاح");

      await loadAccountDriver(selectedAccountDriver);
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    } finally {
      setAccountsLoading(false);
    }
  };

  const loadConversation = async (driver) => {
    try {
      setChatLoading(true);
      setError("");
      setChatMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(
        `${API_URL}/messages/conversation/${driver.id}`,
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل المحادثة");
      }

      setSelectedChatDriver(driver);
      setChatMessages(result.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  const openChat = async () => {
    try {
      setView("chat");
      setChatLoading(true);
      setError("");
      setChatMessage("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/drivers?limit=100`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل السائقين");
      }

      const list = result.drivers || [];
      setChatDrivers(list);

      if (list.length > 0) {
        await loadConversation(list[0]);
      } else {
        setSelectedChatDriver(null);
        setChatMessages([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();

    try {
      if (!selectedChatDriver) {
        throw new Error("اختر سائقًا أولًا");
      }

      if (!chatText.trim()) return;

      setError("");
      setChatMessage("");

      const socket = chatSocketRef.current;

      if (!socket || !socket.connected) {
        throw new Error("الدردشة الفورية غير متصلة. حدّث الصفحة وجرب مرة ثانية");
      }

      socket.emit("chat:send-message", {
        receiverId: selectedChatDriver.id,
        text: chatText.trim(),
      });

      setChatText("");
    } catch (err) {
      setError(err.message);
    }
  };

  const stopRingtone = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close?.().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const startRingtone = () => {
    stopRingtone();

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const playBeep = () => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.value = 0.1;

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.18);
      };

      playBeep();
      ringtoneTimerRef.current = setInterval(playBeep, 1000);
    } catch (err) {
      console.warn("Ringtone error:", err);
    }
  };

  const notifyOtherSideCallEnded = () => {
    const socket = chatSocketRef.current;
    const currentCall = outgoingCall || incomingCall;
    const callId = activeCallIdRef.current || currentCall?.callId;

    const otherUserId =
      outgoingCall?.receiverId ||
      outgoingCall?.callerId ||
      incomingCall?.callerId ||
      incomingCall?.receiverId ||
      selectedChatDriver?.id;

    if (socket?.connected && callId && otherUserId) {
      socket.emit("call:end", { callId, otherUserId });
    }
  };

  const resetCallState = (message = "") => {
    stopRingtone();
    closeCallMedia();
    activeCallIdRef.current = null;
    setIncomingCall(null);
    setOutgoingCall(null);
    setCallStatus("");
    setActiveCallType(null);

    if (message) {
      setChatMessage(message);
    }
  };

  const closeCallMedia = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (remoteMediaRef.current) {
      remoteMediaRef.current.srcObject = null;
    }

    remoteStreamRef.current = null;
    pendingIceCandidatesRef.current = [];

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setIsMicMuted(false);
    setIsCameraOff(false);
  };

  const createPeerConnection = (otherUserId, callId) => {
    const socket = chatSocketRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        socket.emit("webrtc:ice-candidate", {
          receiverId: otherUserId,
          callId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams?.[0];

      if (!remoteStream) return;

      remoteStreamRef.current = remoteStream;

      if (remoteMediaRef.current) {
        remoteMediaRef.current.srcObject = remoteStream;
        remoteMediaRef.current.play?.().catch(() => {});
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  const startLocalMedia = async (callType) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: callType === "video",
    });

    localStreamRef.current = stream;

    if (localVideoRef.current && callType === "video") {
      localVideoRef.current.srcObject = stream;
    }

    return stream;
  };

  const startCall = (callType) => {
    try {
      if (!selectedChatDriver) {
        throw new Error("اختر سائقًا أولًا");
      }

      const socket = chatSocketRef.current;

      if (!socket || !socket.connected) {
        throw new Error("اتصال المكالمات غير متصل. حدّث الصفحة وجرب مرة ثانية");
      }

      setError("");
      setChatMessage("");
      setIncomingCall(null);
      setOutgoingCall(null);
      setCallStatus("");
      setActiveCallType(callType);

      socket.emit("call:start", {
        receiverId: selectedChatDriver.id,
        callType,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelOutgoingCall = () => {
    const socket = chatSocketRef.current;

    if (!socket || !outgoingCall || !selectedChatDriver) return;

    socket.emit("call:cancel", {
      callId: outgoingCall.callId,
      receiverId: selectedChatDriver.id,
    });

    resetCallState("تم إلغاء الاتصال");
  };

  const toggleMicrophone = () => {
    const audioTrack = localStreamRef.current?.getAudioTracks?.()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMicMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const videoTrack = localStreamRef.current?.getVideoTracks?.()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraOff(!videoTrack.enabled);
  };

  const acceptIncomingCall = () => {
    const socket = chatSocketRef.current;

    if (!socket || !socket.connected || !incomingCall) {
      setError("اتصال المكالمات غير متصل");
      return;
    }

    socket.emit("call:accept", {
      callId: incomingCall.callId,
      callerId: incomingCall.callerId,
      callType: incomingCall.callType,
    });

    stopRingtone();
    activeCallIdRef.current = incomingCall.callId;
    setOutgoingCall(incomingCall);
    setActiveCallType(incomingCall.callType);
    setCallStatus("accepted");
    setChatMessage("تم قبول المكالمة، جاري تجهيز الاتصال...");
  };

  const rejectIncomingCall = () => {
    const socket = chatSocketRef.current;

    if (!socket || !socket.connected || !incomingCall) {
      setError("اتصال المكالمات غير متصل");
      return;
    }

    socket.emit("call:reject", {
      callId: incomingCall.callId,
      callerId: incomingCall.callerId,
    });

    resetCallState("تم رفض المكالمة");
  };

  const endActiveCall = () => {
    const socket = chatSocketRef.current;
    const otherUserId =
      selectedChatDriver?.id ||
      outgoingCall?.receiverId ||
      incomingCall?.callerId;

    const currentCall = outgoingCall || incomingCall;

    if (socket && otherUserId && currentCall) {
      socket.emit("call:end", {
        callId: currentCall.callId,
        otherUserId,
      });
    }

    resetCallState("تم إنهاء المكالمة");
  };

  const loadTrackingIncidents = async () => {
    try {
      setIncidentsLoading(true);
      setError("");

      const currentToken = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/tracking/incidents`, {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل تنبيهات التتبع");
      }

      setTrackingIncidents(
        result.incidents ||
        result.trackingIncidents ||
        result.data ||
        []
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setIncidentsLoading(false);
    }
  };

  const openTrackingIncidents = async () => {
    setView("tracking-incidents");
    setError("");
    await loadTrackingIncidents();
  };

  const getIncidentTypeLabel = (type) => {
    if (type === "LOCATION_DISABLED") return "تم إيقاف مشاركة الموقع";
    if (type === "CONNECTION_LOST") return "انقطع الاتصال";
    if (type === "APP_INACTIVE") return "التطبيق غير نشط";
    return type || "تنبيه غير معروف";
  };

  const formatIncidentDuration = (seconds) => {
    if (seconds === null || seconds === undefined) return "حادثة مفتوحة";

    const totalSeconds = Number(seconds);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hours > 0) return `${hours} ساعة و ${minutes} دقيقة`;
    if (minutes > 0) return `${minutes} دقيقة و ${secs} ثانية`;
    return `${secs} ثانية`;
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!user) return;

    const restrictedViews = [
      "users",
      "drivers",
      "businesses",
      "tracking",
      "tracking-incidents",
      "driver-details",
    ];

    if (user.role === "ACCOUNTANT" && restrictedViews.includes(view)) {
      setView("dashboard");
      setError("لا تملك صلاحية الوصول إلى هذه الصفحة");
    }
  }, [user, view]);

  useEffect(() => {
    if (!user) return;

    const currentToken = localStorage.getItem("token");
    if (!currentToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: currentToken },
      transports: ["websocket", "polling"],
    });

    chatSocketRef.current = socket;

    socket.on("chat:new-message", (message) => {
      setChatMessages((currentMessages) => {
        if (currentMessages.some((item) => item.id === message.id)) {
          return currentMessages;
        }

        const activeDriverId = selectedChatDriver?.id;

        if (
          activeDriverId &&
          (message.senderId === activeDriverId ||
            message.receiverId === activeDriverId)
        ) {
          return [...currentMessages, message];
        }

        return currentMessages;
      });
    });

    socket.on("chat:error", (payload) => {
      setError(payload?.message || "حدث خطأ في الدردشة الفورية");
    });

    socket.on("call:incoming", (payload) => {
      if (activeCallIdRef.current && activeCallIdRef.current !== payload.callId) {
        socket.emit("call:reject", {
          callId: payload.callId,
          callerId: payload.callerId,
        });
        return;
      }

      activeCallIdRef.current = payload.callId;
      setIncomingCall(payload);
      setOutgoingCall(null);
      setActiveCallType(payload.callType);
      setCallStatus("incoming");
      setError("");
      startRingtone();
      setChatMessage(
        payload.callType === "video"
          ? "مكالمة فيديو واردة من السائق"
          : "مكالمة صوتية واردة من السائق"
      );
    });

    socket.on("call:cancelled", (payload) => {
      if (payload?.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
        return;
      }

      resetCallState("تم إلغاء الاتصال من السائق");
    });

    socket.on("call:ringing", (payload) => {
      activeCallIdRef.current = payload.callId;
      setOutgoingCall(payload);
      setIncomingCall(null);
      setCallStatus("ringing");
      startRingtone();
      setChatMessage(
        payload.callType === "video"
          ? "جاري الاتصال بالفيديو..."
          : "جاري الاتصال الصوتي..."
      );
    });

    socket.on("call:accepted", async (payload) => {
      try {
        if (payload.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
          return;
        }

        stopRingtone();
        activeCallIdRef.current = payload.callId;
        setCallStatus("accepted");
        setChatMessage(`تم قبول المكالمة من ${payload.acceptedByName || "السائق"}`);

        const currentCall = outgoingCall;
        const callType = currentCall?.callType || activeCallType || payload.callType || "audio";
        const otherUserId = payload.acceptedById;

        setActiveCallType(callType);

        const stream = await startLocalMedia(callType);
        const pc = createPeerConnection(otherUserId, payload.callId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc:offer", {
          receiverId: otherUserId,
          callId: payload.callId,
          callType,
          offer,
        });
      } catch (err) {
        notifyOtherSideCallEnded();
        resetCallState("تم إنهاء المكالمة");
        setError("تعذر تشغيل المايك أو الكاميرا: " + err.message);
      }
    });

    socket.on("webrtc:offer", async (payload) => {
      try {
        const callType = payload.callType || activeCallType || incomingCall?.callType || "audio";
        setActiveCallType(callType);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        });

        localStreamRef.current = stream;

        if (localVideoRef.current && callType === "video") {
          localVideoRef.current.srcObject = stream;
        }

        const pc = createPeerConnection(payload.senderId, payload.callId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));

        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(candidate);
        }
        pendingIceCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("webrtc:answer", {
          receiverId: payload.senderId,
          callId: payload.callId,
          answer,
        });

        setCallStatus("active");
      } catch (err) {
        notifyOtherSideCallEnded();
        resetCallState("تم إنهاء المكالمة");
        setError("تعذر تشغيل المايك أو الكاميرا: " + err.message);
      }
    });

    socket.on("webrtc:answer", async (payload) => {
      try {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));

        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(candidate);
        }
        pendingIceCandidatesRef.current = [];
      } catch (err) {
        setError("فشل إكمال الاتصال: " + err.message);
      }
    });

    socket.on("webrtc:ice-candidate", async (payload) => {
      try {
        if (!payload.candidate) return;

        const pc = peerConnectionRef.current;
        const candidate = new RTCIceCandidate(payload.candidate);

        if (!pc || !pc.remoteDescription) {
          pendingIceCandidatesRef.current.push(candidate);
          return;
        }

        await pc.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE candidate error:", err);
      }
    });

    socket.on("call:rejected", (payload) => {
      if (payload?.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
        return;
      }

      resetCallState(`تم رفض المكالمة من ${payload.rejectedByName || "السائق"}`);
    });

    socket.on("call:ended", (payload) => {
      if (payload?.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
        return;
      }

      resetCallState("تم إنهاء المكالمة");
    });

    socket.on("call:ended-local", () => {
      resetCallState("تم إنهاء المكالمة");
    });

    socket.on("call:cancelled-local", () => {
      resetCallState("تم إلغاء الاتصال");
    });

    socket.on("call:rejected-local", () => {
      resetCallState("تم رفض المكالمة");
    });

    socket.on("call:error", (payload) => {
      stopRingtone();
      setOutgoingCall(null);
      setCallStatus("");
      setError(payload?.message || "حدث خطأ في الاتصال");
    });

    socket.on("balance:updated", (payload) => {
      if (!payload?.driverId) return;

      setData((current) => {
        if (!current?.drivers) return current;

        return {
          ...current,
          drivers: current.drivers.map((driver) =>
            Number(driver.id) === Number(payload.driverId)
              ? { ...driver, balance: Number(payload.balance || 0) }
              : driver
          ),
        };
      });

      setAccountsDrivers((currentDrivers) =>
        currentDrivers.map((driver) =>
          Number(driver.id) === Number(payload.driverId)
            ? {
                ...driver,
                driverProfile: {
                  ...driver.driverProfile,
                  balance: Number(payload.balance || 0),
                },
              }
            : driver
        )
      );

      if (
        selectedAccountDriver &&
        Number(selectedAccountDriver.id) === Number(payload.driverId)
      ) {
        setAccountBalance(Number(payload.balance || 0));
      }
    });

    return () => {
      socket.disconnect();
      chatSocketRef.current = null;
    };
  }, [user, selectedChatDriver?.id]);

  useEffect(() => {
    if (callStatus !== "accepted" && callStatus !== "active") return;

    const timer = setTimeout(() => {
      if (remoteMediaRef.current && remoteStreamRef.current) {
        remoteMediaRef.current.srcObject = remoteStreamRef.current;
        remoteMediaRef.current.play?.().catch(() => {});
      }

      if (
        activeCallType === "video" &&
        localVideoRef.current &&
        localStreamRef.current
      ) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play?.().catch(() => {});
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [callStatus, activeCallType]);

  const scrollChatToBottom = (behavior = "auto") => {
    const box = chatBoxRef.current;

    if (box) {
      box.scrollTop = box.scrollHeight;
    }

    chatEndRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });
  };

  useEffect(() => {
    if (view !== "chat") return;

    const firstTimer = setTimeout(() => {
      scrollChatToBottom("auto");
    }, 100);

    const secondTimer = setTimeout(() => {
      scrollChatToBottom("auto");
    }, 350);

    return () => {
      clearTimeout(firstTimer);
      clearTimeout(secondTimer);
    };
  }, [view, chatMessages.length, chatLoading, selectedChatDriver?.id]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تسجيل الدخول");
      }

      if (!["ADMIN", "ACCOUNTANT"].includes(result.user.role)) {
        throw new Error("هذا الحساب غير مسموح له بدخول لوحة الإدارة");
      }

      localStorage.setItem("token", result.token);
      localStorage.setItem("user", JSON.stringify(result.user));

      setUser(result.user);
      setView("dashboard");

      await loadDashboard(result.token, result.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setData(null);
    setDriverDetails(null);
    setView("dashboard");
  };

  const isAdmin = user?.role === "ADMIN";
  const isAccountant = user?.role === "ACCOUNTANT";

  if (!user && !data) {
    return (
      <div className="login-page">
        <form className="login-card" onSubmit={handleLogin}>
          <h1>RouteDesk</h1>
          <p>تسجيل دخول المدير</p>

          {error && <div className="error-box">{error}</div>}

          <label>رقم الهاتف</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />

          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primary-button" disabled={loading}>
            {loading ? "جاري الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="page-message">جاري التحميل...</div>;
  }

  if (error && !data) {
    return (
      <div className="page-message">
        <h2>حدث خطأ</h2>
        <p>{error}</p>
        <button onClick={logout}>رجوع</button>
      </div>
    );
  }

  const { summary, drivers } = data;

  return (
    <div className="app">
      <aside className="sidebar">
        <div>
          <h1 className="logo">RouteDesk</h1>
          <p className="logo-subtitle">نظام إدارة السائقين</p>

          <nav className="nav">
            <button
              className={view === "dashboard" ? "nav-item active" : "nav-item"}
              onClick={() => setView("dashboard")}
            >
              لوحة التحكم
            </button>

{isAdmin && (
            <button
            className={view === "tracking" ? "nav-item active" : "nav-item"}
            onClick={() => setView("tracking")}
            >
            التتبع المباشر
            </button>
            )}
{isAdmin && (
            <button
              className={
                view === "tracking-incidents" ? "nav-item active" : "nav-item"
              }
              onClick={openTrackingIncidents}
            >
              تنبيهات التتبع
            </button>
            )}

{isAdmin && (
            <button
              className={view === "drivers" ? "nav-item active" : "nav-item"}
              onClick={openDrivers}
            >
              السائقون
            </button>
            )}
{isAdmin && (
            <button
              className={view === "businesses" ? "nav-item active" : "nav-item"}
              onClick={openBusinesses}
            >
              المحلات
            </button>
            )}
            <button
              className={view === "reports" ? "nav-item active" : "nav-item"}
              onClick={openReports}
            >
              التقارير
            </button>
            <button
              className={view === "chat" ? "nav-item active" : "nav-item"}
              onClick={openChat}
            >
              الدردشة
            </button>

{isAdmin && (
            <button
              className={view === "users" ? "nav-item active" : "nav-item"}
              onClick={openUsers}
            >
              إدارة المستخدمين
            </button>
            )}

            <button
              className={view === "accounts" ? "nav-item active" : "nav-item"}
              onClick={openAccounts}
            >
              الحسابات
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">RouteDesk v1.0</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h2>
             {view === "dashboard"
              ? "لوحة التحكم"
              : view === "tracking"
              ? "التتبع المباشر"
              : view === "tracking-incidents"
              ? "تنبيهات التتبع"
              : view === "businesses"
              ? "إدارة المحلات"
              : view === "drivers"
              ? "إدارة السائقين"
              : view === "reports"
              ? "التقارير"
              : view === "accounts"
              ? "الحسابات"
              : view === "users"
              ? "إدارة المستخدمين"
              : view === "chat"
              ? "الدردشة"
              : "تفاصيل السائق"}
            </h2>
            <p>نظرة عامة على حركة السائقين والعمل اليومي</p>
          </div>

          <div className="admin-box">
            <div className="avatar">A</div>
            <div>
              <strong>{user?.name || "Admin"}</strong>
              <span>{user?.role === "ACCOUNTANT" ? "محاسب" : "مدير النظام"}</span>
            </div>

            <button className="logout-button" onClick={logout}>
              خروج
            </button>
          </div>
        </header>

        {view !== "chat" && (incomingCall || outgoingCall) && (
          <div className="global-call-layer">
            {callStatus === "incoming" && incomingCall && (
              <div className="incoming-call-card admin-incoming-call-card">
                <div className="incoming-call-icon">
                  {incomingCall.callType === "video" ? "📹" : "📞"}
                </div>

                <span className="incoming-call-label">
                  {incomingCall.callType === "video"
                    ? "مكالمة فيديو واردة"
                    : "مكالمة صوتية واردة"}
                </span>

                <h2>{incomingCall.callerName || "السائق"}</h2>
                <p>السائق يحاول الاتصال بالإدارة الآن</p>

                <div className="incoming-call-actions">
                  <button
                    type="button"
                    className="call-accept-button"
                    onClick={acceptIncomingCall}
                  >
                    قبول
                  </button>

                  <button
                    type="button"
                    className="call-reject-button"
                    onClick={rejectIncomingCall}
                  >
                    رفض
                  </button>
                </div>
              </div>
            )}

            {(callStatus === "accepted" || callStatus === "active") && (
              <div className="active-call-panel global-active-call-panel">
                <h3>
                  {activeCallType === "video"
                    ? "مكالمة فيديو جارية"
                    : "مكالمة صوتية جارية"}
                </h3>

                {activeCallType === "video" ? (
                  <div className="call-video-stage">
                    <video
                      ref={remoteMediaRef}
                      autoPlay
                      playsInline
                      className="remote-call-video"
                    />
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="local-call-video"
                    />
                  </div>
                ) : (
                  <div className="audio-call-stage">
                    <div className="audio-call-avatar">📞</div>
                    <audio ref={remoteMediaRef} autoPlay />
                    <strong>المكالمة الصوتية جارية</strong>
                  </div>
                )}

                <div className="call-control-bar">
                  <button
                    type="button"
                    className={isMicMuted ? "call-control-button off" : "call-control-button"}
                    onClick={toggleMicrophone}
                  >
                    {isMicMuted ? "تشغيل المايك" : "كتم المايك"}
                  </button>

                  {activeCallType === "video" && (
                    <button
                      type="button"
                      className={isCameraOff ? "call-control-button off" : "call-control-button"}
                      onClick={toggleCamera}
                    >
                      {isCameraOff ? "تشغيل الكاميرا" : "إطفاء الكاميرا"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="call-end-button"
                    onClick={endActiveCall}
                  >
                    إنهاء المكالمة
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {view === "dashboard" && (
          <>
            <section className="stats">
              <div className="stat-card">
                <span>إجمالي السائقين</span>
                <strong>{summary.totalDrivers}</strong>
              </div>

              <div className="stat-card">
                <span>السائقون النشطون</span>
                <strong>{summary.activeDrivers}</strong>
              </div>

              <div className="stat-card">
                <span>المحلات</span>
                <strong>{summary.totalBusinesses}</strong>
              </div>

              <button
                type="button"
                className="stat-card warning"
                onClick={openTrackingIncidents}
              >
                <span>تنبيهات التتبع</span>
                <strong>{summary.openTrackingIncidents}</strong>
              </button>
            </section>

            <section className="content-card">
              <div className="section-title">
                <div>
                  <h3>السائقون</h3>
                  <p>حالة السائقين وآخر تحديث للموقع</p>
                </div>

                {isAdmin && (
                  <button className="primary-button" onClick={openDrivers}>
                    إضافة سائق
                  </button>
                )}
              </div>

              {drivers.map((driver) => (
                <div className="driver-row" key={driver.id}>
                  <div className="driver-info">
                    <div className="driver-avatar">
                      {driver.name.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <strong>{driver.name}</strong>
                      <span>
                        {driver.vehicle.type || "بدون مركبة"} ·{" "}
                        {driver.vehicle.plate || "بدون رقم"}
                      </span>
                    </div>
                  </div>

                  <div className="driver-data">
                    <span
                      className={
                        driver.tracking.status === "ONLINE"
                          ? "status online"
                          : "status inactive"
                      }
                    >
                      {driver.tracking.status === "ONLINE"
                        ? "متصل"
                        : driver.tracking.status}
                    </span>

                    <div>
                      <small>الرصيد</small>
                      <strong>{driver.balance.toLocaleString()} د.ع</strong>
                    </div>

                    {isAdmin && (
                      <button
                        className="details-button"
                        onClick={() => loadDriverDetails(driver.id)}
                      >
                        عرض التفاصيل
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          </>
        )}
        {view === "tracking" && (
          <LiveTrackingMap drivers={drivers} />
           )}
        {view === "tracking-incidents" && (
          <section className="incidents-page">
            {error && <div className="error-box">{error}</div>}

            <div className="content-card">
              <div className="section-title">
                <div>
                  <h3>تنبيهات وحوادث التتبع</h3>
                  <p>متابعة توقف الموقع وانقطاع الاتصال وحالة التطبيق</p>
                </div>

                <button
                  className="details-button"
                  onClick={loadTrackingIncidents}
                  disabled={incidentsLoading}
                >
                  {incidentsLoading ? "جاري التحديث..." : "تحديث"}
                </button>
              </div>

              {incidentsLoading && trackingIncidents.length === 0 ? (
                <p>جاري تحميل التنبيهات...</p>
              ) : trackingIncidents.length === 0 ? (
                <p>لا توجد حوادث تتبع مسجلة حاليًا</p>
              ) : (
                <div className="business-list">
                  {trackingIncidents.map((incident) => (
                    <div className="business-row" key={incident.id}>
                      <div className="business-main-info">
                        <div className="business-icon">!</div>
                        <div>
                          <strong>
                            {incident.driver?.name || "سائق غير معروف"}
                          </strong>
                          <span>
                            {getIncidentTypeLabel(incident.type)}
                          </span>
                          <small>
                            بدأ:{" "}
                            {incident.startedAt
                              ? new Date(incident.startedAt).toLocaleString("ar-IQ")
                              : "غير معروف"}
                          </small>
                        </div>
                      </div>

                      <div className="business-actions">
                        <span
                          className={
                            incident.endedAt
                              ? "status online"
                              : "status inactive"
                          }
                        >
                          {incident.endedAt ? "انتهت" : "مفتوحة"}
                        </span>

                        <strong>
                          {formatIncidentDuration(incident.durationSeconds)}
                        </strong>

                        {incident.endedAt && (
                          <span>
                            انتهت:{" "}
                            {new Date(incident.endedAt).toLocaleString("ar-IQ")}
                          </span>
                        )}

                        {(incident.lastLatitude !== null &&
                          incident.lastLatitude !== undefined &&
                          incident.lastLongitude !== null &&
                          incident.lastLongitude !== undefined) && (
                          <small>
                            آخر موقع: {Number(incident.lastLatitude).toFixed(5)},{" "}
                            {Number(incident.lastLongitude).toFixed(5)}
                          </small>
                        )}

                        {incident.note && <small>{incident.note}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "drivers" && (
          <section className="drivers-page">
            {error && <div className="error-box">{error}</div>}
            {driverMessage && (
              <div className="success-box">{driverMessage}</div>
            )}

            <div className="businesses-layout">
              <form className="content-card business-form" onSubmit={createDriver}>
                <div className="section-title">
                  <div>
                    <h3>إضافة سائق جديد</h3>
                    <p>أنشئ حساب السائق وأدخل بيانات مركبته</p>
                  </div>
                </div>

                <label>اسم السائق</label>
                <input
                  value={newDriver.name}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, name: e.target.value })
                  }
                  placeholder="مثال: أحمد محمد"
                  required
                />

                <label>رقم الهاتف</label>
                <input
                  value={newDriver.phone}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, phone: e.target.value })
                  }
                  placeholder="07700000000"
                  required
                />

                <label>كلمة المرور</label>
                <input
                  type="password"
                  value={newDriver.password}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, password: e.target.value })
                  }
                  placeholder="6 أحرف أو أرقام على الأقل"
                  minLength="6"
                  required
                />

                <label>نوع المركبة</label>
                <input
                  value={newDriver.vehicleType}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, vehicleType: e.target.value })
                  }
                  placeholder="مثال: Kia Bongo"
                />

                <label>رقم اللوحة</label>
                <input
                  value={newDriver.vehiclePlate}
                  onChange={(e) =>
                    setNewDriver({ ...newDriver, vehiclePlate: e.target.value })
                  }
                  placeholder="مثال: 12 A 34567"
                />

                <button className="primary-button" disabled={driversLoading}>
                  {driversLoading ? "جاري الحفظ..." : "إضافة السائق"}
                </button>
              </form>

              <div className="content-card business-list-card">
                <div className="section-title">
                  <div>
                    <h3>السائقون المسجلون</h3>
                    <p>عرض حسابات السائقين والتحكم بحالتها</p>
                  </div>
                  <strong>{allDrivers.length}</strong>
                </div>

                {driversLoading && allDrivers.length === 0 ? (
                  <p>جاري تحميل السائقين...</p>
                ) : allDrivers.length === 0 ? (
                  <p>لا يوجد سائقون مسجلون</p>
                ) : (
                  <div className="business-list">
                    {allDrivers.map((driver) => (
                      <div className="business-row" key={driver.id}>
                        <div className="business-main-info">
                          <div className="driver-avatar">
                            {driver.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <strong>{driver.name}</strong>
                            <span>
                              {driver.phone} ·{" "}
                              {driver.driverProfile?.vehicleType || "بدون مركبة"} ·{" "}
                              {driver.driverProfile?.vehiclePlate || "بدون رقم"}
                            </span>
                          </div>
                        </div>

                        <div className="business-actions">
                          <span
                            className={
                              driver.isActive
                                ? "status online"
                                : "status inactive"
                            }
                          >
                            {driver.isActive ? "نشط" : "معطل"}
                          </span>

                          <button
                            className="details-button"
                            onClick={() => loadDriverDetails(driver.id)}
                          >
                            عرض التفاصيل
                          </button>

                          <button
                            className={
                              driver.isActive
                                ? "business-disable-button"
                                : "business-enable-button"
                            }
                            onClick={() => toggleDriver(driver)}
                            disabled={driversLoading}
                          >
                            {driver.isActive ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {view === "businesses" && (
          <section className="businesses-page">
            {error && <div className="error-box">{error}</div>}
            {businessMessage && (
              <div className="success-box">{businessMessage}</div>
            )}

            <div className="businesses-layout">
              <form className="content-card business-form" onSubmit={createBusiness}>
                <div className="section-title">
                  <div>
                    <h3>إضافة مكان جديد</h3>
                    <p>أضف ماركت، مطعم، صيدلية أو أي نقطة زيارة</p>
                  </div>
                </div>

                <label>اسم المكان</label>
                <input
                  value={newBusiness.name}
                  onChange={(e) =>
                    setNewBusiness({ ...newBusiness, name: e.target.value })
                  }
                  placeholder="مثال: Al Noor Market"
                  required
                />

                <label>نوع المكان</label>
                <select
                  value={newBusiness.type}
                  onChange={(e) =>
                    setNewBusiness({ ...newBusiness, type: e.target.value })
                  }
                >
                  <option value="SUPERMARKET">ماركت</option>
                  <option value="RESTAURANT">مطعم</option>
                  <option value="PHARMACY">صيدلية</option>
                  <option value="BAKERY">مخبز</option>
                  <option value="FLOWERS">زهور</option>
                  <option value="STORE">متجر</option>
                  <option value="OTHER">أخرى</option>
                </select>

                <label>رقم الهاتف</label>
                <input
                  value={newBusiness.phone}
                  onChange={(e) =>
                    setNewBusiness({ ...newBusiness, phone: e.target.value })
                  }
                  placeholder="اختياري"
                />

                <label>العنوان</label>
                <input
                  value={newBusiness.address}
                  onChange={(e) =>
                    setNewBusiness({ ...newBusiness, address: e.target.value })
                  }
                  placeholder="مثال: الموصل - المجموعة"
                />

                <button className="primary-button" disabled={businessLoading}>
                  {businessLoading ? "جاري الحفظ..." : "إضافة المكان"}
                </button>
              </form>

              <div className="content-card business-list-card">
                <div className="section-title">
                  <div>
                    <h3>الأماكن المسجلة</h3>
                    <p>إدارة الأماكن العامة المتاحة لجميع السائقين</p>
                  </div>
                  <strong>{businesses.length}</strong>
                </div>

                {businessLoading && businesses.length === 0 ? (
                  <p>جاري تحميل الأماكن...</p>
                ) : businesses.length === 0 ? (
                  <p>لا توجد أماكن مسجلة حاليًا</p>
                ) : (
                  <div className="business-list">
                    {businesses.map((business) => (
                      <div className="business-row" key={business.id}>
                        <div className="business-main-info">
                          <div className="business-icon">⌖</div>
                          <div>
                            <strong>{business.name}</strong>
                            <span>
                              {business.type} · {business.address || "بدون عنوان"}
                            </span>
                          </div>
                        </div>

                        <div className="business-actions">
                          <span
                            className={
                              business.isActive
                                ? "status online"
                                : "status inactive"
                            }
                          >
                            {business.isActive ? "نشط" : "معطل"}
                          </span>

                          <button
                            className={
                              business.isActive
                                ? "business-disable-button"
                                : "business-enable-button"
                            }
                            onClick={() => toggleBusiness(business)}
                            disabled={businessLoading}
                          >
                            {business.isActive ? "تعطيل" : "تفعيل"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {view === "reports" && (
          <section className="reports-page">
            {error && <div className="error-box">{error}</div>}

            <div className="content-card">
              <div className="section-title">
                <div>
                  <h3>تقارير الزيارات</h3>
                  <p>متابعة زيارات السائقين والمواد الراجعة وأسباب الإرجاع</p>
                </div>

                <button
                  className="details-button"
                  onClick={loadReports}
                  disabled={reportsLoading}
                >
                  {reportsLoading ? "جاري التحديث..." : "تحديث"}
                </button>
              </div>

              {reportsLoading && reports.length === 0 ? (
                <p>جاري تحميل التقارير...</p>
              ) : reports.length === 0 ? (
                <p>لا توجد تقارير مسجلة حاليًا</p>
              ) : (
                <div className="reports-list">
                  {reports.map((report) => (
                    <div className="report-card" key={report.id}>
                      <div className="report-card-header">
                        <div>
                          <h4>{report.business?.name || "مكان غير محدد"}</h4>
                          <span>
                            {report.business?.type || "غير محدد"} ·{" "}
                            {report.business?.address || "بدون عنوان"}
                          </span>
                        </div>

                        <div className="report-driver-box">
                          <span>السائق</span>
                          <strong>{report.driver?.name || "غير معروف"}</strong>
                          <small>{report.driver?.phone || ""}</small>
                        </div>
                      </div>

                      <div className="report-meta">
                        <strong>{report.title}</strong>
                        <span>
                          {new Date(report.createdAt).toLocaleString("ar-IQ")}
                        </span>
                      </div>

                      {report.description && (
                        <p className="report-description">
                          {report.description}
                        </p>
                      )}

                      <div className="report-returns">
                        <h5>المواد الراجعة</h5>

                        {report.returnItems?.length > 0 ? (
                          report.returnItems.map((item) => (
                            <div className="return-row" key={item.id}>
                              <strong>
                                {item.itemName} × {item.quantity}
                              </strong>
                              <span>
                                السبب: {item.reason || "بدون سبب"}
                              </span>
                              {item.note && <small>{item.note}</small>}
                            </div>
                          ))
                        ) : (
                          <span>لا يوجد راجع في هذه الزيارة</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "chat" && (
          <section className="chat-page">
            {error && <div className="error-box">{error}</div>}
            {chatMessage && <div className="success-box">{chatMessage}</div>}

            <div className="businesses-layout">
              <div className="content-card business-list-card">
                <div className="section-title">
                  <div>
                    <h3>السائقون</h3>
                    <p>اختر سائقًا لفتح المحادثة</p>
                  </div>
                  <strong>{chatDrivers.length}</strong>
                </div>

                <div className="business-list">
                  {chatDrivers.map((driver) => (
                    <button
                      type="button"
                      key={driver.id}
                      className="business-row"
                      onClick={() => loadConversation(driver)}
                    >
                      <div className="business-main-info">
                        <div className="driver-avatar">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{driver.name}</strong>
                          <span>{driver.phone}</span>
                        </div>
                      </div>

                      <span className="details-button">
                        {selectedChatDriver?.id === driver.id
                          ? "مفتوحة"
                          : "فتح المحادثة"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="content-card">
                {!selectedChatDriver ? (
                  <p>لا يوجد سائق محدد</p>
                ) : (
                  <>
                    {callStatus === "incoming" && incomingCall && (
                      <div className="incoming-call-card admin-incoming-call-card">
                        <div className="incoming-call-icon">
                          {incomingCall.callType === "video" ? "📹" : "📞"}
                        </div>

                        <span className="incoming-call-label">
                          {incomingCall.callType === "video"
                            ? "مكالمة فيديو واردة"
                            : "مكالمة صوتية واردة"}
                        </span>

                        <h2>{incomingCall.callerName || "السائق"}</h2>
                        <p>السائق يحاول الاتصال بالإدارة الآن</p>

                        <div className="incoming-call-actions">
                          <button
                            type="button"
                            className="call-accept-button"
                            onClick={acceptIncomingCall}
                          >
                            قبول
                          </button>

                          <button
                            type="button"
                            className="call-reject-button"
                            onClick={rejectIncomingCall}
                          >
                            رفض
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="section-title">
                      <div>
                        <h3>مركز التواصل - {selectedChatDriver.name}</h3>
                        <p>{selectedChatDriver.phone}</p>
                      </div>

                      <div className="communication-actions">
                        <button type="button" className="communication-button active">
                          دردشة
                        </button>

                        <button
                          type="button"
                          className="communication-button"
                          onClick={() => startCall("audio")}
                        >
                          اتصال صوتي
                        </button>

                        <button
                          type="button"
                          className="communication-button"
                          onClick={() => startCall("video")}
                        >
                          مكالمة فيديو
                        </button>

                        {callStatus === "ringing" && (
                          <button
                            type="button"
                            className="communication-button"
                            onClick={cancelOutgoingCall}
                          >
                            إلغاء الاتصال
                          </button>
                        )}

                        <button
                          type="button"
                          className="details-button"
                          onClick={() => loadConversation(selectedChatDriver)}
                          disabled={chatLoading}
                        >
                          تحديث
                        </button>
                      </div>
                    </div>

                    {(callStatus === "accepted" || callStatus === "active") && (
                      <div className="active-call-panel">
                        <h3>
                          {activeCallType === "video"
                            ? "مكالمة فيديو جارية"
                            : "مكالمة صوتية جارية"}
                        </h3>

                        {activeCallType === "video" ? (
                          <div className="call-video-stage">
                            <video
                              ref={remoteMediaRef}
                              autoPlay
                              playsInline
                              className="remote-call-video"
                            />
                            <video
                              ref={localVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="local-call-video"
                            />
                          </div>
                        ) : (
                          <div className="audio-call-stage">
                            <div className="audio-call-avatar">📞</div>
                            <audio ref={remoteMediaRef} autoPlay />
                            <strong>المكالمة الصوتية جارية</strong>
                          </div>
                        )}

                        <div className="call-control-bar">
                          <button
                            type="button"
                            className={isMicMuted ? "call-control-button off" : "call-control-button"}
                            onClick={toggleMicrophone}
                          >
                            {isMicMuted ? "تشغيل المايك" : "كتم المايك"}
                          </button>

                          {activeCallType === "video" && (
                            <button
                              type="button"
                              className={isCameraOff ? "call-control-button off" : "call-control-button"}
                              onClick={toggleCamera}
                            >
                              {isCameraOff ? "تشغيل الكاميرا" : "إطفاء الكاميرا"}
                            </button>
                          )}

                          <button
                            type="button"
                            className="call-end-button"
                            onClick={endActiveCall}
                          >
                            إنهاء المكالمة
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      ref={chatBoxRef}
                      style={{
                        minHeight: "360px",
                        maxHeight: "480px",
                        overflowY: "auto",
                        padding: "14px",
                        background: "#f8fafc",
                        borderRadius: "14px",
                        marginBottom: "14px",
                      }}
                    >
                      {chatLoading && chatMessages.length === 0 ? (
                        <p>جاري تحميل المحادثة...</p>
                      ) : chatMessages.length === 0 ? (
                        <p>لا توجد رسائل بعد</p>
                      ) : (
                        chatMessages.map((message) => {
                          const mine = message.sender?.role === "ADMIN";

                          return (
                            <div
                              key={message.id}
                              style={{
                                display: "flex",
                                justifyContent: mine ? "flex-start" : "flex-end",
                                marginBottom: "10px",
                              }}
                            >
                              <div
                                style={{
                                  maxWidth: "75%",
                                  padding: "10px 14px",
                                  borderRadius: "14px",
                                  background: mine ? "#dbeafe" : "#ffffff",
                                  border: "1px solid #e5e7eb",
                                }}
                              >
                                <strong style={{ display: "block", marginBottom: "4px" }}>
                                  {message.sender?.name}
                                </strong>
                                <span>{message.text}</span>
                                <small
                                  style={{
                                    display: "block",
                                    marginTop: "6px",
                                    opacity: 0.65,
                                  }}
                                >
                                  {new Date(message.createdAt).toLocaleString("ar-IQ")}
                                </small>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={sendChatMessage}>
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          value={chatText}
                          onChange={(e) => setChatText(e.target.value)}
                          placeholder="اكتب رسالة إلى السائق..."
                          style={{ flex: 1 }}
                        />
                        <button
                          className="primary-button"
                          disabled={chatLoading || !chatText.trim()}
                        >
                          إرسال
                        </button>
                      </div>
                    </form>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {view === "users" && (
          <section className="users-page">
            {error && <div className="error-box">{error}</div>}
            {userMessage && (
              <div className="success-box">{userMessage}</div>
            )}

            <div className="businesses-layout">
              <form
                className="content-card business-form"
                onSubmit={createSystemUser}
              >
                <div className="section-title">
                  <div>
                    <h3>إنشاء حساب جديد</h3>
                    <p>إنشاء حساب مدير أو محاسب أو سائق</p>
                  </div>
                </div>

                <label>الاسم</label>
                <input
                  value={newSystemUser.name}
                  onChange={(e) =>
                    setNewSystemUser({
                      ...newSystemUser,
                      name: e.target.value,
                    })
                  }
                  placeholder="الاسم الكامل"
                  required
                />

                <label>رقم الهاتف</label>
                <input
                  value={newSystemUser.phone}
                  onChange={(e) =>
                    setNewSystemUser({
                      ...newSystemUser,
                      phone: e.target.value,
                    })
                  }
                  placeholder="07700000000"
                  required
                />

                <label>كلمة المرور</label>
                <input
                  type="password"
                  minLength="6"
                  value={newSystemUser.password}
                  onChange={(e) =>
                    setNewSystemUser({
                      ...newSystemUser,
                      password: e.target.value,
                    })
                  }
                  placeholder="6 أحرف أو أرقام على الأقل"
                  required
                />

                <label>نوع الحساب</label>
                <select
                  value={newSystemUser.role}
                  onChange={(e) =>
                    setNewSystemUser({
                      ...newSystemUser,
                      role: e.target.value,
                    })
                  }
                >
                  <option value="DRIVER">سائق</option>
                  <option value="ACCOUNTANT">محاسب</option>
                  <option value="ADMIN">مدير</option>
                </select>

                <button
                  className="primary-button"
                  disabled={usersLoading}
                >
                  {usersLoading ? "جاري الحفظ..." : "إنشاء الحساب"}
                </button>
              </form>

              <div className="content-card business-list-card">
                <div className="section-title">
                  <div>
                    <h3>المستخدمون</h3>
                    <p>إدارة الحسابات والصلاحيات وحالة الدخول</p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      alignItems: "center",
                    }}
                  >
                    <strong>{systemUsers.length}</strong>
                    <button
                      type="button"
                      className="details-button"
                      onClick={loadSystemUsers}
                      disabled={usersLoading}
                    >
                      تحديث
                    </button>
                  </div>
                </div>

                {usersLoading && systemUsers.length === 0 ? (
                  <p>جاري تحميل المستخدمين...</p>
                ) : systemUsers.length === 0 ? (
                  <p>لا توجد حسابات مسجلة</p>
                ) : (
                  <div className="business-list">
                    {systemUsers.map((systemUser) => (
                      <div className="business-row" key={systemUser.id}>
                        <div className="business-main-info">
                          <div className="driver-avatar">
                            {systemUser.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{systemUser.name}</strong>
                            <span>
                              {systemUser.phone} · {getRoleLabel(systemUser.role)}
                            </span>
                            <small>
                              أُنشئ:{" "}
                              {new Date(systemUser.createdAt).toLocaleString("ar-IQ")}
                            </small>
                          </div>
                        </div>

                        <div className="business-actions">
                          <span
                            className={
                              systemUser.isActive
                                ? "status online"
                                : "status inactive"
                            }
                          >
                            {systemUser.isActive ? "نشط" : "معطل"}
                          </span>

                          <button
                            type="button"
                            className="details-button"
                            onClick={() => {
                              setPasswordResetUserId(
                                passwordResetUserId === systemUser.id
                                  ? null
                                  : systemUser.id
                              );
                              setNewPassword("");
                              setError("");
                              setUserMessage("");
                            }}
                          >
                            تغيير كلمة المرور
                          </button>

                          {Number(systemUser.id) !== Number(user?.id) && (
                            <button
                              type="button"
                              className={
                                systemUser.isActive
                                  ? "business-disable-button"
                                  : "business-enable-button"
                              }
                              onClick={() => toggleSystemUser(systemUser)}
                              disabled={usersLoading}
                            >
                              {systemUser.isActive ? "تعطيل" : "تفعيل"}
                            </button>
                          )}

                          {passwordResetUserId === systemUser.id && (
                            <form
                              onSubmit={(e) =>
                                resetSystemUserPassword(e, systemUser.id)
                              }
                              style={{
                                width: "100%",
                                display: "flex",
                                gap: "8px",
                                marginTop: "10px",
                              }}
                            >
                              <input
                                type="password"
                                minLength="6"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="كلمة المرور الجديدة"
                                required
                                style={{ flex: 1 }}
                              />

                              <button
                                className="primary-button"
                                disabled={usersLoading}
                              >
                                حفظ
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {view === "accounts" && (
          <section className="accounts-page">
            {error && <div className="error-box">{error}</div>}
            {accountMessage && (
              <div className="success-box">{accountMessage}</div>
            )}

            <div className="businesses-layout">
              <div className="content-card business-list-card">
                <div className="section-title">
                  <div>
                    <h3>حسابات السائقين</h3>
                    <p>اختر سائقًا لعرض الرصيد وسجل الحركات</p>
                  </div>
                  <strong>{accountsDrivers.length}</strong>
                </div>

                <div className="business-list">
                  {accountsDrivers.map((driver) => (
                    <button
                      type="button"
                      key={driver.id}
                      className="business-row"
                      onClick={() => loadAccountDriver(driver)}
                    >
                      <div className="business-main-info">
                        <div className="driver-avatar">
                          {driver.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{driver.name}</strong>
                          <span>{driver.phone}</span>
                        </div>
                      </div>

                      <div className="business-actions">
                        <strong>
                          {Number(driver.driverProfile?.balance || 0).toLocaleString()} د.ع
                        </strong>
                        <span className="details-button">فتح الحساب</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="content-card">
                {!selectedAccountDriver ? (
                  <p>لا يوجد سائق محدد</p>
                ) : (
                  <>
                    <div className="section-title">
                      <div>
                        <h3>{selectedAccountDriver.name}</h3>
                        <p>{selectedAccountDriver.phone}</p>
                      </div>
                      <div>
                        <small>الرصيد الحالي</small>
                        <h3>{accountBalance.toLocaleString()} د.ع</h3>
                      </div>
                    </div>

                    <form className="business-form" onSubmit={createSettlement}>
                      <label>مبلغ التسوية</label>
                      <input
                        type="number"
                        min="1"
                        value={settlementAmount}
                        onChange={(e) => setSettlementAmount(e.target.value)}
                        placeholder="مثال: 50000"
                        required
                      />

                      <label>ملاحظة</label>
                      <input
                        value={settlementNote}
                        onChange={(e) => setSettlementNote(e.target.value)}
                        placeholder="مثال: تسوية نهاية اليوم"
                      />

                      <button
                        className="primary-button"
                        disabled={accountsLoading}
                      >
                        {accountsLoading ? "جاري الحفظ..." : "تسجيل التسوية"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>

            <div className="content-card">
              <div className="section-title">
                <div>
                  <h3>سجل الحركات المالية</h3>
                  <p>التحصيلات والتسويات مرتبة من الأحدث</p>
                </div>
              </div>

              {accountsLoading && accountTransactions.length === 0 ? (
                <p>جاري تحميل الحركات...</p>
              ) : accountTransactions.length === 0 ? (
                <p>لا توجد حركات مالية لهذا السائق</p>
              ) : (
                <div className="business-list">
                  {accountTransactions.map((transaction) => (
                    <div className="business-row" key={transaction.id}>
                      <div className="business-main-info">
                        <div>
                          <strong>
                            {transaction.type === "COLLECTION"
                              ? "تحصيل"
                              : transaction.type === "SETTLEMENT"
                              ? "تسوية"
                              : "تعديل"}
                          </strong>
                          <span>
                            {transaction.business?.name || "بدون مكان"} ·{" "}
                            {transaction.note || "بدون ملاحظة"}
                          </span>
                        </div>
                      </div>

                      <div className="business-actions">
                        <strong>
                          {Number(transaction.amount || 0).toLocaleString()} د.ع
                        </strong>
                        <span>
                          {new Date(transaction.createdAt).toLocaleString("ar-IQ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {view === "driver-details" && driverDetails && (
          <section className="details-grid">
            <div className="content-card details-main">
              <button
                className="details-button"
                onClick={() => setView("dashboard")}
              >
                رجوع
              </button>

              <h3>{driverDetails.driver.name}</h3>
              <p>{driverDetails.driver.phone}</p>

              <div className="details-stats">
                <div>
                  <span>الرصيد</span>
                  <strong>{driverDetails.driver.balance.toLocaleString()} د.ع</strong>
                </div>

                <div>
                  <span>المركبة</span>
                  <strong>
                    {driverDetails.driver.vehicle.type || "-"} ·{" "}
                    {driverDetails.driver.vehicle.plate || "-"}
                  </strong>
                </div>

                <div>
                  <span>حالة التتبع</span>
                  <strong>{driverDetails.driver.tracking.status}</strong>
                </div>
              </div>
            </div>

            <div className="content-card visits-card">
              <h3>سجل الأماكن والزيارات</h3>
              <p>الراجع والمبالغ المستلمة مجمعة حسب المكان</p>

              {(() => {
                const places = {};

                driverDetails.reports.forEach((report) => {
                  const businessId = report.business?.id || "unknown";
                  if (!places[businessId]) {
                    places[businessId] = {
                      id: businessId,
                      name: report.business?.name || "مكان غير محدد",
                      type: report.business?.type || "غير محدد",
                      reports: [],
                      transactions: [],
                    };
                  }
                  places[businessId].reports.push(report);
                });

                driverDetails.transactions
                  .filter((transaction) =>
                    transaction.type === "COLLECTION" && transaction.business
                  )
                  .forEach((transaction) => {
                    const businessId = transaction.business.id;
                    if (!places[businessId]) {
                      places[businessId] = {
                        id: businessId,
                        name: transaction.business.name,
                        type: transaction.business.type || "غير محدد",
                        reports: [],
                        transactions: [],
                      };
                    }
                    places[businessId].transactions.push(transaction);
                  });

                const placeList = Object.values(places);

                if (placeList.length === 0) {
                  return <p>لا توجد زيارات مسجلة لهذا السائق</p>;
                }

                return placeList.map((place) => {
                  const totalCollected = place.transactions.reduce(
                    (sum, transaction) => sum + Number(transaction.amount || 0),
                    0
                  );

                  return (
                    <div className="place-visit-card" key={place.id}>
                      <div className="place-visit-header">
                        <div>
                          <h4>{place.name}</h4>
                          <span>{place.type}</span>
                        </div>

                        <div className="place-total">
                          <span>إجمالي المستلم</span>
                          <strong>{totalCollected.toLocaleString()} د.ع</strong>
                        </div>
                      </div>

                      {place.reports.map((report) => (
                        <div className="visit-section" key={`report-${report.id}`}>
                          <strong>{report.title}</strong>
                          {report.description && <p>{report.description}</p>}

                          {report.returnItems.length > 0 ? (
                            report.returnItems.map((item) => (
                              <div className="return-row" key={item.id}>
                                <span>{item.itemName} × {item.quantity}</span>
                                <span>السبب: {item.reason || "بدون سبب"}</span>
                              </div>
                            ))
                          ) : (
                            <span>لا يوجد راجع في هذا التقرير</span>
                          )}
                        </div>
                      ))}

                      {place.transactions.length > 0 && (
                        <div className="visit-section">
                          <strong>المبالغ المستلمة</strong>
                          {place.transactions.map((transaction) => (
                            <div className="collection-row" key={`transaction-${transaction.id}`}>
                              <strong>{transaction.amount.toLocaleString()} د.ع</strong>
                              <span>{transaction.note || "بدون ملاحظة"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>

            <div className="content-card">
              <h3>حوادث التتبع</h3>

              {driverDetails.trackingIncidents.map((incident) => (
                <div className="mini-card" key={incident.id}>
                  <strong>{incident.type}</strong>
                  <span>
                    {incident.durationSeconds
                      ? `${incident.durationSeconds} ثانية`
                      : "حادثة مفتوحة"}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;