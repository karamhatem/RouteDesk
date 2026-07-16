import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { CapacitorHttp, Capacitor } from "@capacitor/core";
import "./App.css";

const API_URL = "https://routedesk-production.up.railway.app/api";
const SOCKET_URL = "https://routedesk-production.up.railway.app";

// ========================================
// طلبات HTTP موحدة
// ========================================
// المشكلة: fetch العادي داخل WebView الخاص بـ Capacitor على أندرويد
// أحياناً يفشل بـ"Failed to fetch" حتى لو النت شغال 100%.
// الحل: نستخدم CapacitorHttp (يمر عبر شبكة أندرويد الأصلية native)
// عندما التطبيق يشتغل كتطبيق حقيقي على الموبايل، ونستخدم fetch العادي
// فقط لو كان يشتغل داخل متصفح عادي (أثناء التطوير على الكمبيوتر مثلاً).
const apiRequest = async (path, { method = "GET", headers = {}, body } = {}) => {
  const url = path.startsWith("http") ? path : `${API_URL}${path}`;

  if (Capacitor.isNativePlatform()) {
    const response = await CapacitorHttp.request({
      url,
      method,
      headers,
      data: body,
    });

    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      json: async () => response.data,
    };
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  return response;
};

// ========================================
// إعدادات WebRTC
// ========================================
// مهم جداً: STUN وحده لا يكفي لضمان اتصال قوي على كل الشبكات.
// سجل حساب مجاني على https://www.metered.ca/tools/openrelay/ أو https://xirsys.com
// واستبدل القيم تحت ببياناتك الحقيقية.
const ICE_SERVERS = [
  { urls: "stun:stun.relay.metered.ca:80" },
  {
    urls: "turn:standard.relay.metered.ca:80",
    username: "240cefa471c702de92ac30a0",
    credential: "GYAanB4Ux3H0DNLZ",
  },
  {
    urls: "turn:standard.relay.metered.ca:80?transport=tcp",
    username: "240cefa471c702de92ac30a0",
    credential: "GYAanB4Ux3H0DNLZ",
  },
  {
    urls: "turn:standard.relay.metered.ca:443",
    username: "240cefa471c702de92ac30a0",
    credential: "GYAanB4Ux3H0DNLZ",
  },
  {
    urls: "turns:standard.relay.metered.ca:443?transport=tcp",
    username: "240cefa471c702de92ac30a0",
    credential: "GYAanB4Ux3H0DNLZ",
  },
];

// ========================================
// تخزين المواقع محلياً لما مافي نت
// ========================================
const OFFLINE_LOCATIONS_KEY = "routedesk_offline_locations";

const getQueuedLocations = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_LOCATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const queueLocationOffline = (locationData) => {
  try {
    const queue = getQueuedLocations();
    queue.push(locationData);
    // نحدد حد أقصى 500 نقطة عشان ما تكبر الذاكرة كثير لو انقطع النت طويل
    const trimmed = queue.slice(-500);
    localStorage.setItem(OFFLINE_LOCATIONS_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn("Failed to queue location offline:", err);
  }
};

const clearQueuedLocations = () => {
  localStorage.removeItem(OFFLINE_LOCATIONS_KEY);
};

function App() {
  const socketRef = useRef(null);
  const chatSocketRef = useRef(null);
  const chatEndRef = useRef(null);
  const chatBoxRef = useRef(null);
  const backgroundTrackingStartedRef = useRef(false);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteMediaRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const activeCallIdRef = useRef(null);
  const ringtoneTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const processedOfferKeysRef = useRef(new Set());
  const processedAnswerKeysRef = useRef(new Set());
  const isCreatingOfferRef = useRef(false);
  const iceRestartAttemptedRef = useRef(false);

  const [phone, setPhone] = useState("07722222222");
  const [password, setPassword] = useState("123456");
  const [user, setUser] = useState(null);
  const [driverView, setDriverView] = useState("home");
  const [status, setStatus] = useState("غير متصل");
  const [tracking, setTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [currentBalance, setCurrentBalance] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [savingVisit, setSavingVisit] = useState(false);
  const [businesses, setBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  const [businessId, setBusinessId] = useState("");
  const [area, setArea] = useState("");
  const [visitNote, setVisitNote] = useState("");

  const [hasReturn, setHasReturn] = useState(false);
  const [returnItemName, setReturnItemName] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnReason, setReturnReason] = useState("");

  const [hasCollection, setHasCollection] = useState(false);
  const [collectionAmount, setCollectionAmount] = useState("");
  const [collectionNote, setCollectionNote] = useState("");

  const [chatMessages, setChatMessages] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");
  const [activeCallType, setActiveCallType] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem("driverUser");
    if (savedUser) setUser(JSON.parse(savedUser));

    return () => {
      // لا نوقف التتبع الأصلي عند خروج الواجهة حتى يستمر في الخلفية.
      if (socketRef.current) socketRef.current.disconnect();
      if (chatSocketRef.current) chatSocketRef.current.disconnect();
    };
  }, []);

  const getToken = () => localStorage.getItem("driverToken");

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
        gain.gain.value = 0.12;

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
      adminUser?.id;

    if (socket?.connected && callId && otherUserId) {
      socket.emit("call:end", { callId, otherUserId });
    }
  };

  const resetCallState = (message = "") => {
    stopRingtone();
    closeCallMedia();
    activeCallIdRef.current = null;
    processedOfferKeysRef.current.clear();
    processedAnswerKeysRef.current.clear();
    isCreatingOfferRef.current = false;
    iceRestartAttemptedRef.current = false;
    setIncomingCall(null);
    setOutgoingCall(null);
    setCallStatus("");
    setActiveCallType(null);

    if (message) {
      setSuccess(message);
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

  // ========================================
  // جلب الصوت/الفيديو مع خطة بديلة:
  // لو الكاميرا فشلت (مستخدمة بمكان ثاني أو صلاحية مرفوضة)،
  // نرجع نحاول بالصوت بس بدل ما نفشل المكالمة كاملة.
  // ========================================
  const getCallMediaStream = async (callType) => {
    try {
      return {
        stream: await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === "video",
        }),
        actualType: callType,
      };
    } catch (err) {
      if (callType === "video") {
        console.warn(
          "تعذر تشغيل الكاميرا، جاري المحاولة بالصوت فقط:",
          err.message
        );
        const audioOnlyStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        return { stream: audioOnlyStream, actualType: "audio" };
      }
      throw err;
    }
  };

  const createPeerConnection = (otherUserId, callId) => {
    const socket = chatSocketRef.current;

    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch (_) {}
      peerConnectionRef.current = null;
    }

    iceRestartAttemptedRef.current = false;

    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
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

    // ========================================
    // مراقبة حالة الاتصال + محاولة إعادة اتصال تلقائية
    // ========================================
    pc.onconnectionstatechange = () => {
      console.warn("WebRTC connection state:", pc.connectionState);

      if (pc.connectionState === "disconnected") {
        // انقطاع مؤقت، ممكن يرجع لحاله بمفرده خلال ثواني
        setCallStatus((current) =>
          current === "active" || current === "accepted" ? "reconnecting" : current
        );
      }

      if (pc.connectionState === "failed" && !iceRestartAttemptedRef.current) {
        // محاولة وحدة لإعادة تفعيل الاتصال قبل ما نعتبره فشل نهائي
        iceRestartAttemptedRef.current = true;
        try {
          console.warn("Attempting ICE restart...");
          pc.restartIce();
        } catch (err) {
          console.error("ICE restart failed:", err);
          notifyOtherSideCallEnded();
          resetCallState("انقطع الاتصال بسبب ضعف الشبكة");
        }
      } else if (pc.connectionState === "failed") {
        // فشل حتى بعد محاولة إعادة الاتصال
        notifyOtherSideCallEnded();
        resetCallState("انقطع الاتصال بسبب ضعف الشبكة");
      }

      if (pc.connectionState === "connected") {
        iceRestartAttemptedRef.current = false;
        setCallStatus("active");
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  };

  // ========================================
  // جلب رصيد السائق مع إعادة محاولة (backoff تصاعدي)
  // ========================================
  const loadCurrentBalance = async ({ silent = true, retries = 4 } = {}) => {
    const token = getToken();
    if (!token) return;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await apiRequest("/transactions/me/balance", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "فشل تحديث الرصيد");
        }

        setCurrentBalance(Number(result.balance || 0));
        return;
      } catch (err) {
        console.warn(`Load balance attempt ${attempt + 1} failed:`, err.message);

        if (attempt === retries) {
          if (!silent) setError(err.message || "فشل تحديث الرصيد");
        } else {
          // انتظار تصاعدي: 1s, 2s, 4s, 8s
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        }
      }
    }
  };

  const connectChatSocket = () => {
    const token = getToken();
    if (!token) return;

    if (chatSocketRef.current) {
      chatSocketRef.current.disconnect();
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      // Socket للتحديث اللحظي، لكن API يبقى المصدر النهائي للرصيد.
      loadCurrentBalance();
    });

    socket.on("chat:new-message", (message) => {
      setChatMessages((currentMessages) => {
        if (currentMessages.some((item) => item.id === message.id)) {
          return currentMessages;
        }

        if (
          adminUser &&
          (message.senderId === adminUser.id ||
            message.receiverId === adminUser.id)
        ) {
          return [...currentMessages, message];
        }

        return [...currentMessages, message];
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
      setSuccess("");
      startRingtone();
    });

    socket.on("call:cancelled", (payload) => {
      if (payload?.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
        return;
      }

      resetCallState("تم إلغاء الاتصال من الطرف الآخر");
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
      setError(payload?.message || "حدث خطأ في الاتصال");
    });

    socket.on("call:ringing", (payload) => {
      activeCallIdRef.current = payload.callId;
      setOutgoingCall(payload);
      setIncomingCall(null);
      setActiveCallType(payload.callType);
      setCallStatus("ringing");
      startRingtone();
      setSuccess(
        payload.callType === "video"
          ? "جاري الاتصال بالفيديو بالإدارة..."
          : "جاري الاتصال الصوتي بالإدارة..."
      );
    });

    socket.on("call:accepted", async (payload) => {
      try {
        if (
          payload.callId &&
          activeCallIdRef.current &&
          payload.callId !== activeCallIdRef.current
        ) {
          return;
        }

        if (isCreatingOfferRef.current) {
          console.warn("Ignoring duplicate call:accepted while creating offer");
          return;
        }

        stopRingtone();
        activeCallIdRef.current = payload.callId;
        setCallStatus("accepted");
        setSuccess(`تم قبول المكالمة من ${payload.acceptedByName || "الإدارة"}`);

        const currentCall = outgoingCall || incomingCall;
        const callType = currentCall?.callType || activeCallType || payload.callType || "audio";
        const otherUserId = payload.acceptedById;

        if (!otherUserId) {
          throw new Error("لم يتم تحديد الطرف الآخر للمكالمة");
        }

        isCreatingOfferRef.current = true;

        const { stream, actualType } = await getCallMediaStream(callType);
        localStreamRef.current = stream;
        setActiveCallType(actualType);

        if (actualType !== callType) {
          setSuccess("تعذر تشغيل الكاميرا، تم المتابعة بمكالمة صوتية فقط");
        }

        if (localVideoRef.current && actualType === "video") {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }

        const pc = createPeerConnection(otherUserId, payload.callId);

        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("webrtc:offer", {
          receiverId: otherUserId,
          callId: payload.callId,
          callType: actualType,
          offer,
        });
      } catch (err) {
        notifyOtherSideCallEnded();
        resetCallState("تم إنهاء المكالمة");
        setError("تعذر تشغيل المايك أو الكاميرا: " + err.message);
      } finally {
        isCreatingOfferRef.current = false;
      }
    });

    socket.on("call:rejected", (payload) => {
      if (payload?.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
        return;
      }

      resetCallState(`تم رفض المكالمة من ${payload.rejectedByName || "الإدارة"}`);
    });

    socket.on("webrtc:offer", async (payload) => {
      try {
        if (
          payload.callId &&
          activeCallIdRef.current &&
          payload.callId !== activeCallIdRef.current
        ) {
          return;
        }

        const offerKey = `${payload.callId}:${payload.senderId}`;
        if (processedOfferKeysRef.current.has(offerKey)) {
          console.warn("Ignoring duplicate WebRTC offer:", offerKey);
          return;
        }

        processedOfferKeysRef.current.add(offerKey);
        stopRingtone();
        activeCallIdRef.current = payload.callId;

        const callType = payload.callType || incomingCall?.callType || activeCallType || "audio";

        const { stream, actualType } = await getCallMediaStream(callType);
        localStreamRef.current = stream;
        setActiveCallType(actualType);

        if (actualType !== callType) {
          setSuccess("تعذر تشغيل الكاميرا، تم المتابعة بمكالمة صوتية فقط");
        }

        if (localVideoRef.current && actualType === "video") {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
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
        if (
          payload.callId &&
          activeCallIdRef.current &&
          payload.callId !== activeCallIdRef.current
        ) {
          return;
        }

        const pc = peerConnectionRef.current;
        if (!pc) return;

        const answerKey = `${payload.callId}:${payload.senderId || "unknown"}`;
        if (processedAnswerKeysRef.current.has(answerKey)) {
          console.warn("Ignoring duplicate WebRTC answer:", answerKey);
          return;
        }

        if (pc.signalingState !== "have-local-offer") {
          console.warn(
            "Ignoring late WebRTC answer. Current state:",
            pc.signalingState
          );
          return;
        }

        await pc.setRemoteDescription(
          new RTCSessionDescription(payload.answer)
        );

        processedAnswerKeysRef.current.add(answerKey);

        for (const candidate of pendingIceCandidatesRef.current) {
          await pc.addIceCandidate(candidate);
        }

        pendingIceCandidatesRef.current = [];
        setCallStatus("active");
      } catch (err) {
        setError("فشل إكمال الاتصال: " + err.message);
      }
    });

    socket.on("webrtc:ice-candidate", async (payload) => {
      try {
        if (!payload.candidate) return;

        if (payload.callId && activeCallIdRef.current && payload.callId !== activeCallIdRef.current) {
          return;
        }

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

    socket.on("balance:updated", (payload) => {
      if (!payload || Number(payload.driverId) !== Number(user?.id)) return;

      setCurrentBalance(Number(payload.balance || 0));
      setSuccess(
        payload.type === "SETTLEMENT"
          ? "تم تحديث الرصيد بعد التسوية"
          : "تم تحديث الرصيد"
      );
    });

    chatSocketRef.current = socket;
  };

  const loadAvailableBusinesses = async () => {
    try {
      setLoadingBusinesses(true);
      const token = getToken();
      if (!token) return;

      const response = await apiRequest("/businesses/available", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل الأماكن");
      }

      setBusinesses(result.businesses || []);
      if (result.businesses?.length > 0) {
        setBusinessId((current) => current || String(result.businesses[0].id));
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingBusinesses(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();

    try {
      setError("");
      setSuccess("");

      // اختبار اتصال من داخل التطبيق نفسه
      const pingResponse = await apiRequest("/ping");
      const pingResult = await pingResponse.json();

      if (!pingResponse.ok || !pingResult.success) {
        throw new Error("التطبيق لم يصل إلى API ping");
      }

      const response = await apiRequest("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: { phone, password },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تسجيل الدخول");
      }

      if (result.user.role !== "DRIVER") {
        throw new Error("هذا الحساب ليس حساب سائق");
      }

      localStorage.setItem("driverToken", result.token);
      localStorage.setItem("driverUser", JSON.stringify(result.user));

      setUser(result.user);
      setDriverView("home");
      setStatus("تم تسجيل الدخول");

    } catch (err) {
      setError(
        `API: ${API_URL} | الخطأ: ${err.name || ""} ${err.message || err}`
      );
    }
  };

  useEffect(() => {
    if (user) {
      connectChatSocket();
      loadAvailableBusinesses();
      loadDriverChat();
      loadCurrentBalance({ silent: false });
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const refreshBalance = () => {
      if (document.visibilityState === "visible") {
        loadCurrentBalance();
      }
    };

    const handleFocus = () => loadCurrentBalance();

    // النت رجع بعد انقطاع؟ نحدث الرصيد فوراً بدل ما ننتظر الـ 60 ثانية
    const handleOnline = () => {
      loadCurrentBalance();
      flushQueuedLocations();
    };

    document.addEventListener("visibilitychange", refreshBalance);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("online", handleOnline);

    // حماية إضافية إذا بقي التطبيق مفتوحًا لساعات.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        loadCurrentBalance();
      }
    }, 60_000);

    return () => {
      document.removeEventListener("visibilitychange", refreshBalance);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("online", handleOnline);
      window.clearInterval(intervalId);
    };
  }, [user]);

  // ========================================
  // إرسال كل المواقع المخزنة محلياً دفعة وحدة
  // تنادى لما النت يرجع أو السوكيت يتصل
  // ========================================
  const flushQueuedLocations = async () => {
    const queue = getQueuedLocations();
    if (queue.length === 0) return;

    const token = getToken();
    if (!token) return;

    try {
      const response = await apiRequest("/tracking/locations/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: { locations: queue },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        clearQueuedLocations();
        console.log(`تم رفع ${queue.length} موقع مخزن بنجاح`);
      } else {
        console.warn("Failed to sync offline locations:", result.message);
      }
    } catch (err) {
      // النت لسا مو شغال، نخلي المواقع بالقائمة ونحاول مرة ثانية بعدين
      console.warn("Flush offline locations failed, will retry later:", err.message);
    }
  };

  const connectSocket = () => {
    const token = getToken();

    if (!token) {
      setError("لا يوجد Token للسائق");
      return null;
    }

    if (socketRef.current) socketRef.current.disconnect();

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      setStatus("متصل بالسيرفر");
      flushQueuedLocations();
    });
    socket.on("driver:location-accepted", () =>
      setStatus("مشاركة الموقع تعمل")
    );
    socket.on("tracking:error", (data) =>
      setError(data.message || "خطأ في التتبع")
    );
    socket.on("connect_error", (err) => {
      setError(err.message);
      setStatus("فشل اتصال التتبع");
    });
    socket.on("disconnect", () => setStatus("انقطع اتصال التتبع"));

    socketRef.current = socket;
    return socket;
  };

  const startTracking = async () => {
    try {
      setError("");
      setSuccess("");

      const token = getToken();
      if (!token) throw new Error("لا يوجد Token للسائق");

      const enableResponse = await apiRequest("/tracking/enable", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const enableResult = await enableResponse.json();

      if (!enableResponse.ok || !enableResult.success) {
        throw new Error(enableResult.message || "فشل تشغيل مشاركة الموقع");
      }

      const socket = connectSocket();

      await BackgroundGeolocation.start(
        {
          backgroundTitle: "RouteDesk Driver",
          backgroundMessage: "مشاركة الموقع تعمل أثناء الدوام",
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        },
        (location, locationError) => {
          if (locationError) {
            console.error("Background location error:", locationError);

            if (locationError.code === "NOT_AUTHORIZED") {
              setError("صلاحية الموقع غير مفعلة. اسمح للتطبيق باستخدام الموقع دائمًا.");
            } else {
              setError(
                "خطأ في تتبع الموقع: " +
                  (locationError.message || locationError.code || "Unknown error")
              );
            }
            return;
          }

          if (!location) return;

          const locationData = {
            latitude: location.latitude,
            longitude: location.longitude,
            lastSeen: new Date().toISOString(),
          };

          setLastLocation(locationData);

          const activeSocket = socketRef.current || socket;
          if (activeSocket?.connected) {
            activeSocket.emit("driver:location", locationData);
          } else {
            // مافي اتصال حالياً - نخزن الموقع محلياً بدل ما نضيعه
            queueLocationOffline(locationData);
          }
        }
      );

      backgroundTrackingStartedRef.current = true;
      setTracking(true);
      setStatus("مشاركة الموقع تعمل بالخلفية");
      setSuccess("تم تشغيل التتبع بالخلفية بنجاح");
    } catch (err) {
      setError(err.message || "فشل تشغيل التتبع بالخلفية");
    }
  };

  const stopTracking = async () => {
    try {
      setError("");

      const token = getToken();
      if (!token) throw new Error("لا يوجد Token للسائق");

      try {
        await BackgroundGeolocation.stop();
      } catch (stopError) {
        console.warn("Background tracking stop warning:", stopError);
      }

      backgroundTrackingStartedRef.current = false;

      const response = await apiRequest("/tracking/disable", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل إيقاف مشاركة الموقع");
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      setTracking(false);
      setStatus("تم إيقاف مشاركة الموقع");
      setSuccess("تم إيقاف التتبع بالخلفية");
    } catch (err) {
      setError(err.message || "فشل إيقاف التتبع");
    }
  };

  const saveVisit = async (e) => {
    e.preventDefault();

    try {
      setSavingVisit(true);
      setError("");
      setSuccess("");

      if (!businessId) throw new Error("اختر المكان أولًا");
      if (hasReturn && (!returnItemName || !returnQuantity)) {
        throw new Error("أكمل اسم المادة الراجعة والكمية");
      }
      if (hasCollection && (!collectionAmount || Number(collectionAmount) <= 0)) {
        throw new Error("أدخل مبلغًا صحيحًا");
      }

      const token = getToken();
      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      };

      const reportDescription = [
        area ? `المنطقة: ${area}` : "",
        visitNote ? `ملاحظة الزيارة: ${visitNote}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const reportResponse = await apiRequest("/reports", {
        method: "POST",
        headers: authHeaders,
        body: {
          businessId: Number(businessId),
          title: "زيارة ميدانية",
          description: reportDescription || "تمت الزيارة",
          returnItems: hasReturn
            ? [
                {
                  itemName: returnItemName,
                  quantity: Number(returnQuantity),
                  reason: returnReason || "غير محدد",
                },
              ]
            : [],
        },
      });

      const reportResult = await reportResponse.json();

      if (!reportResponse.ok || !reportResult.success) {
        throw new Error(reportResult.message || "فشل حفظ تقرير الزيارة");
      }

      if (hasCollection) {
        const collectionResponse = await apiRequest(
          "/transactions/collection",
          {
            method: "POST",
            headers: authHeaders,
            body: {
              businessId: Number(businessId),
              amount: Number(collectionAmount),
              note: collectionNote || `تحصيل أثناء زيارة ${area || "المكان"}`,
            },
          }
        );

        const collectionResult = await collectionResponse.json();

        if (!collectionResponse.ok || !collectionResult.success) {
          throw new Error(
            collectionResult.message ||
              "تم حفظ التقرير لكن فشل تسجيل المبلغ"
          );
        }

        setCurrentBalance(collectionResult.currentBalance);
      }

      setSuccess("تم حفظ الزيارة وإرسالها للإدارة بنجاح");
      setArea("");
      setVisitNote("");
      setHasReturn(false);
      setReturnItemName("");
      setReturnQuantity("1");
      setReturnReason("");
      setHasCollection(false);
      setCollectionAmount("");
      setCollectionNote("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingVisit(false);
    }
  };

  const loadDriverChat = async () => {
    try {
      setChatLoading(true);
      setError("");

      const token = getToken();

      const adminResponse = await apiRequest("/messages/admin", {
        headers: { Authorization: `Bearer ${token}` },
      });

      const adminResult = await adminResponse.json();

      if (!adminResponse.ok || !adminResult.success) {
        throw new Error(adminResult.message || "فشل العثور على حساب الإدارة");
      }

      const admin = adminResult.admin;

      if (!admin) {
        throw new Error("لم يتم العثور على حساب المدير");
      }

      setAdminUser(admin);

      const response = await apiRequest(
        `/messages/conversation/${admin.id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "فشل تحميل المحادثة");
      }

      setChatMessages(result.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setChatLoading(false);
    }
  };

  const sendDriverMessage = async (e) => {
    e.preventDefault();

    try {
      if (!chatText.trim()) return;
      if (!adminUser) throw new Error("حساب المدير غير متوفر");

      setError("");

      const socket = chatSocketRef.current;

      if (!socket || !socket.connected) {
        throw new Error("الدردشة الفورية غير متصلة. حدّث الصفحة وجرب مرة ثانية");
      }

      socket.emit("chat:send-message", {
        receiverId: adminUser.id,
        text: chatText.trim(),
      });

      setChatText("");
    } catch (err) {
      setError(err.message);
    }
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
    setSuccess(
      incomingCall.callType === "video"
        ? "تم قبول مكالمة الفيديو"
        : "تم قبول المكالمة الصوتية"
    );
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

  const startCall = (callType) => {
    try {
      if (!adminUser) {
        throw new Error("حساب المدير غير متوفر");
      }

      const socket = chatSocketRef.current;

      if (!socket || !socket.connected) {
        throw new Error("اتصال المكالمات غير متصل. حدّث الصفحة وجرب مرة ثانية");
      }

      setError("");
      setSuccess("");
      setIncomingCall(null);
      setOutgoingCall(null);
      setCallStatus("");
      setActiveCallType(callType);

      socket.emit("call:start", {
        receiverId: adminUser.id,
        callType,
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const cancelOutgoingCall = () => {
    const socket = chatSocketRef.current;

    if (!socket || !outgoingCall) return;

    socket.emit("call:cancel", {
      callId: outgoingCall.callId,
      receiverId: adminUser?.id || outgoingCall.receiverId,
    });

    resetCallState("تم إلغاء الاتصال");
  };

  const endActiveCall = () => {
    const socket = chatSocketRef.current;

    const currentCall = outgoingCall || incomingCall;
    const otherUserId =
      outgoingCall?.receiverId ||
      incomingCall?.callerId ||
      adminUser?.id;

    if (socket && currentCall && otherUserId) {
      socket.emit("call:end", {
        callId: currentCall.callId,
        otherUserId,
      });
    }

    resetCallState("تم إنهاء المكالمة");
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

  const logout = async () => {
    if (tracking) await stopTracking();
    localStorage.removeItem("driverToken");
    localStorage.removeItem("driverUser");
    setCurrentBalance(null);
    setUser(null);
    setDriverView("home");
  };

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
    }, 120);

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
    if (driverView !== "chat") return;

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
  }, [driverView, chatMessages.length, chatLoading]);

  if (!user) {
    return (
      <div className="driver-page">
        <form className="driver-card login-card" onSubmit={login}>
          <h1>RouteDesk Driver</h1>
          <p>تسجيل دخول السائق</p>

          {error && <div className="error-box">{error}</div>}

          <label>رقم الهاتف</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />

          <label>كلمة المرور</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primary-button">دخول</button>
        </form>
      </div>
    );
  }

  return (
    <div className="driver-page">
      <div className="driver-shell">
        <header className="driver-header">
          <div>
            <span className="app-pill">RouteDesk Driver</span>
            <h1>مرحبًا {user.name}</h1>
            <p>اختر العملية التي تريد تنفيذها أثناء الدوام</p>
          </div>

          <button className="logout-button" onClick={logout}>
            خروج
          </button>
        </header>

        {(error || success) && (
          <div className="message-area">
            {error && <div className="error-box">{error}</div>}
            {success && <div className="success-box">{success}</div>}
          </div>
        )}

        {driverView === "home" && (
          <main className="home-page">
            <section className="driver-card hero-card">
              <div>
                <span className={tracking ? "live-dot active" : "live-dot"}>
                  {tracking ? "الموقع يعمل" : "الموقع متوقف"}
                </span>
                <h2>لوحة السائق الرئيسية</h2>
                <p>من هنا تشغل الموقع، تقدم التقرير، وتتواصل مع الإدارة.</p>
              </div>

              <div className="quick-status-grid">
                <div className="status-box">
                  <span>الحالة</span>
                  <strong>{status}</strong>
                </div>

                <div className="status-box">
                  <span>الرصيد الحالي</span>
                  <strong>
                    {currentBalance !== null
                      ? `${currentBalance.toLocaleString()} د.ع`
                      : "غير محدد"}
                  </strong>
                </div>

                {lastLocation && (
                  <div className="location-box">
                    <span>آخر موقع</span>
                    <strong>{lastLocation.latitude.toFixed(6)}</strong>
                    <strong>{lastLocation.longitude.toFixed(6)}</strong>
                  </div>
                )}
              </div>
            </section>

            <section className="home-actions">
              <button
                type="button"
                className="action-card primary-action"
                onClick={tracking ? stopTracking : startTracking}
              >
                <span className="action-icon">📍</span>
                <strong>
                  {tracking ? "إيقاف مشاركة الموقع" : "تشغيل مشاركة الموقع"}
                </strong>
                <small>تحديث موقعك المباشر للإدارة</small>
              </button>

              <button
                type="button"
                className="action-card"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setDriverView("visit");
                }}
              >
                <span className="action-icon">📝</span>
                <strong>تقديم تقرير / زيارة</strong>
                <small>المكان، الراجع، والتحصيل</small>
              </button>

              <button
                type="button"
                className="action-card"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setDriverView("chat");
                  loadDriverChat();
                }}
              >
                <span className="action-icon">💬</span>
                <strong>التواصل والدردشة</strong>
                <small>رسائل الإدارة والرد المباشر</small>
              </button>

              <button
                type="button"
                className="action-card"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setDriverView("chat");
                  loadDriverChat();
                }}
              >
                <span className="action-icon">📞</span>
                <strong>مركز الاتصال</strong>
                <small>دردشة، اتصال صوتي، ومكالمة فيديو</small>
              </button>
            </section>
          </main>
        )}

        {driverView === "chat" && (
          <main className="driver-card page-card">
            <div className="page-heading">
              <button
                type="button"
                className="back-button"
                onClick={() => setDriverView("home")}
              >
                رجوع
              </button>

              <div>
                <h2>مركز التواصل مع الإدارة</h2>
                <p>الدردشة الفورية والاتصال الصوتي ومكالمة الفيديو</p>
              </div>
            </div>

            <div className="communication-actions">
              <button
                type="button"
                className="communication-button active"
              >
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
                className="logout-button"
                onClick={loadDriverChat}
                disabled={chatLoading}
              >
                تحديث
              </button>
            </div>

            <div className="chat-box" ref={chatBoxRef}>
              {chatLoading && chatMessages.length === 0 ? (
                <p>جاري تحميل الرسائل...</p>
              ) : chatMessages.length === 0 ? (
                <p>لا توجد رسائل بعد</p>
              ) : (
                chatMessages.map((message) => {
                  const mine = message.senderId === user.id;

                  return (
                    <div
                      key={message.id}
                      className={mine ? "chat-message mine" : "chat-message"}
                    >
                      <strong>{message.sender?.name}</strong>
                      <span>{message.text}</span>
                      <small>
                        {new Date(message.createdAt).toLocaleString("ar-IQ")}
                      </small>
                    </div>
                  );
                })
              )}

              <div ref={chatEndRef} />
            </div>

            <form className="chat-form" onSubmit={sendDriverMessage}>
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="اكتب رسالتك إلى الإدارة..."
              />

              <button
                className="primary-button"
                disabled={chatLoading || !chatText.trim() || !adminUser}
              >
                {chatLoading ? "جاري الإرسال..." : "إرسال"}
              </button>
            </form>
          </main>
        )}

        {(incomingCall || outgoingCall) && (
          <div className="incoming-call-overlay">
            <div className="incoming-call-card">
              <div className="incoming-call-icon">
                {(incomingCall || outgoingCall)?.callType === "video" ? "📹" : "📞"}
              </div>

              <span className="incoming-call-label">
                {callStatus === "ringing"
                  ? ((incomingCall || outgoingCall)?.callType === "video"
                      ? "جاري طلب مكالمة فيديو"
                      : "جاري طلب مكالمة صوتية")
                  : ((incomingCall || outgoingCall)?.callType === "video"
                      ? "مكالمة فيديو واردة"
                      : "مكالمة صوتية واردة")}
              </span>

              <h2>
                {callStatus === "ringing"
                  ? "الإدارة"
                  : (incomingCall || outgoingCall)?.callerName || "الإدارة"}
              </h2>

              <p>
                {callStatus === "ringing"
                  ? "بانتظار رد الإدارة..."
                  : callStatus === "reconnecting"
                  ? "جاري إعادة الاتصال..."
                  : callStatus === "accepted" || callStatus === "active"
                  ? "المكالمة جارية"
                  : "الإدارة تحاول الاتصال بك الآن"}
              </p>

              {(callStatus === "accepted" ||
                callStatus === "active" ||
                callStatus === "reconnecting") && (
                <div className="active-call-panel">
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
                      <strong>
                        {callStatus === "reconnecting"
                          ? "جاري إعادة الاتصال..."
                          : "المكالمة الصوتية جارية"}
                      </strong>
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

              {callStatus === "ringing" && (
                <div className="incoming-call-actions">
                  <button
                    type="button"
                    className="call-reject-button"
                    onClick={cancelOutgoingCall}
                  >
                    إلغاء الاتصال
                  </button>
                </div>
              )}

              {callStatus !== "accepted" &&
                callStatus !== "active" &&
                callStatus !== "reconnecting" &&
                callStatus !== "ringing" && (
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
              )}
            </div>
          </div>
        )}

        {driverView === "visit" && (
          <main className="driver-card page-card">
            <div className="page-heading">
              <button type="button" className="back-button" onClick={() => setDriverView("home")}>
                رجوع
              </button>

              <div>
                <h2>تسجيل زيارة جديدة</h2>
                <p>سجل المكان والراجع والتحصيل في عملية واحدة مرتبة</p>
              </div>

              <span className="visit-badge">زيارة ميدانية</span>
            </div>

            <form className="visit-form" onSubmit={saveVisit}>
              <section className="form-section">
                <div className="section-head">
                  <span className="section-number">1</span>
                  <div>
                    <h3>بيانات المكان</h3>
                    <p>حدد المكان والمنطقة التي زرتها</p>
                  </div>
                </div>

                <div className="form-grid">
                  <div className="field-group">
                    <label>اختر المكان</label>
                    <select value={businessId} onChange={(e) => setBusinessId(e.target.value)} disabled={loadingBusinesses || businesses.length === 0}>
                      {loadingBusinesses ? (
                        <option value="">جاري تحميل الأماكن...</option>
                      ) : businesses.length === 0 ? (
                        <option value="">لا توجد أماكن متاحة حاليًا</option>
                      ) : (
                        <>
                          <option value="">اختر المكان</option>
                          {businesses.map((business) => (
                            <option key={business.id} value={business.id}>
                              {business.name} — {business.address || business.type}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="field-group">
                    <label>المنطقة</label>
                    <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="مثال: حي النور" />
                  </div>
                </div>

                <div className="field-group">
                  <label>ملاحظة الزيارة</label>
                  <textarea value={visitNote} onChange={(e) => setVisitNote(e.target.value)} placeholder="مثال: تم التسليم بالكامل" rows="3" />
                </div>
              </section>

              <section className="form-section">
                <div className="section-head">
                  <span className="section-number">2</span>
                  <div>
                    <h3>المواد الراجعة</h3>
                    <p>فعّل هذا القسم فقط إذا كان هناك راجع</p>
                  </div>
                </div>

                <label className="option-toggle">
                  <input type="checkbox" checked={hasReturn} onChange={(e) => setHasReturn(e.target.checked)} />
                  <span>يوجد راجع من هذا المكان</span>
                </label>

                {hasReturn && (
                  <div className="conditional-box">
                    <div className="form-grid">
                      <div className="field-group">
                        <label>اسم المادة</label>
                        <input value={returnItemName} onChange={(e) => setReturnItemName(e.target.value)} placeholder="مثال: صمون" />
                      </div>

                      <div className="field-group">
                        <label>الكمية</label>
                        <input type="number" min="1" value={returnQuantity} onChange={(e) => setReturnQuantity(e.target.value)} />
                      </div>
                    </div>

                    <div className="field-group">
                      <label>سبب الراجع</label>
                      <input value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="مثال: تالف أو منتهي الصلاحية" />
                    </div>
                  </div>
                )}
              </section>

              <section className="form-section">
                <div className="section-head">
                  <span className="section-number">3</span>
                  <div>
                    <h3>التحصيل المالي</h3>
                    <p>سجل المبلغ إذا استلمت دفعة من المكان</p>
                  </div>
                </div>

                <label className="option-toggle">
                  <input type="checkbox" checked={hasCollection} onChange={(e) => setHasCollection(e.target.checked)} />
                  <span>تم استلام مبلغ من هذا المكان</span>
                </label>

                {hasCollection && (
                  <div className="conditional-box">
                    <div className="field-group">
                      <label>المبلغ المستلم</label>
                      <input type="number" min="1" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} placeholder="مثال: 50000" />
                    </div>

                    <div className="field-group">
                      <label>ملاحظة التحصيل</label>
                      <input value={collectionNote} onChange={(e) => setCollectionNote(e.target.value)} placeholder="مثال: دفعة جزئية" />
                    </div>
                  </div>
                )}
              </section>

              <button className="primary-button save-visit-button" disabled={savingVisit}>
                {savingVisit ? "جاري حفظ الزيارة..." : "حفظ الزيارة وإرسالها"}
              </button>
            </form>
          </main>
        )}
      </div>
    </div>
  );

}

export default App;
