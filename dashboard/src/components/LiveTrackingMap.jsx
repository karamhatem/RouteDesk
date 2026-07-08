import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
} from "react-leaflet";

import { io } from "socket.io-client";
import L from "leaflet";

const SOCKET_URL = "http://localhost:5000";

const driverIcon = L.divIcon({
  className: "driver-map-marker",
  html: `
    <div class="driver-marker-inner">
      🚗
    </div>
  `,
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

function LiveTrackingMap({ drivers }) {
  const [liveDrivers, setLiveDrivers] = useState(drivers || []);
  const [socketStatus, setSocketStatus] = useState("connecting");
  const [socketError, setSocketError] = useState("");

  useEffect(() => {
    setLiveDrivers(drivers || []);
  }, [drivers]);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setSocketStatus("disconnected");
      setSocketError("لا يوجد Token لتسجيل اتصال التتبع");
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on("connect", () => {
      setSocketStatus("connected");
      setSocketError("");
      socket.emit("admin:join-tracking");
    });

    socket.on("tracking:joined", () => {});

    socket.on("driver:location-updated", (locationData) => {
      setLiveDrivers((currentDrivers) =>
        currentDrivers.map((driver) => {
          if (Number(driver.id) !== Number(locationData.driverId)) {
            return driver;
          }

          return {
            ...driver,
            tracking: {
              ...driver.tracking,
              status: "ONLINE",
              latitude: Number(locationData.latitude),
              longitude: Number(locationData.longitude),
              lastSeen: locationData.lastSeen,
              sharingEnabled: true,
              openIncident: null,
            },
          };
        })
      );
    });

    socket.on("driver:tracking-inactive", (payload) => {
      setLiveDrivers((currentDrivers) =>
        currentDrivers.map((driver) => {
          if (Number(driver.id) !== Number(payload.driverId)) {
            return driver;
          }

          return {
            ...driver,
            tracking: {
              ...driver.tracking,
              status: payload.type || "APP_INACTIVE",
              sharingEnabled: false,
              openIncident: {
                id: payload.incidentId,
                type: payload.type || "APP_INACTIVE",
                startedAt: payload.startedAt || new Date().toISOString(),
              },
            },
          };
        })
      );
    });

    socket.on("driver:tracking-restored", (payload) => {
      setLiveDrivers((currentDrivers) =>
        currentDrivers.map((driver) => {
          if (Number(driver.id) !== Number(payload.driverId)) {
            return driver;
          }

          return {
            ...driver,
            tracking: {
              ...driver.tracking,
              status: "ONLINE",
              sharingEnabled: true,
              openIncident: null,
            },
          };
        })
      );
    });

    socket.on("tracking:error", (data) => {
      setSocketError(data?.message || "حدث خطأ في نظام التتبع");
    });

    socket.on("connect_error", (error) => {
      setSocketStatus("disconnected");
      setSocketError(error.message || "تعذر الاتصال بسيرفر التتبع");
    });

    socket.on("disconnect", () => {
      setSocketStatus("disconnected");
    });

    socket.io.on("reconnect_attempt", () => {
      setSocketStatus("connecting");
    });

    return () => {
      socket.off("connect");
      socket.off("tracking:joined");
      socket.off("driver:location-updated");
      socket.off("driver:tracking-inactive");
      socket.off("driver:tracking-restored");
      socket.off("tracking:error");
      socket.off("connect_error");
      socket.off("disconnect");
      socket.io.off("reconnect_attempt");
      socket.disconnect();
    };
  }, []);

  const isValidLocation = (driver) => {
    const latitude = Number(driver.tracking?.latitude);
    const longitude = Number(driver.tracking?.longitude);

    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  };

  const isDriverVisibleOnMap = (driver) => {
    return (
      driver.tracking?.sharingEnabled === true &&
      driver.tracking?.status === "ONLINE" &&
      isValidLocation(driver)
    );
  };

  const driversWithLocation = liveDrivers.filter(isDriverVisibleOnMap);

  const stoppedDrivers = liveDrivers.filter(
    (driver) =>
      driver.tracking?.sharingEnabled === false ||
      driver.tracking?.status !== "ONLINE"
  );

  return (
    <section className="tracking-page">
      <div className="tracking-header">
        <div>
          <h3>الخريطة المباشرة</h3>
          <p>
            تعرض فقط السائقين الذين يشغلون مشاركة الموقع حاليًا
          </p>
        </div>

        <div className="tracking-status-area">
          <div
            className={
              socketStatus === "connected"
                ? "socket-status connected"
                : "socket-status disconnected"
            }
          >
            <span className="socket-dot"></span>

            {socketStatus === "connected"
              ? "التتبع متصل"
              : socketStatus === "connecting"
              ? "جاري الاتصال..."
              : "التتبع منقطع"}
          </div>

          <div className="tracking-count">
            <span>السائقون على الخريطة</span>
            <strong>{driversWithLocation.length}</strong>
          </div>
        </div>
      </div>

      {socketError && (
        <div className="tracking-error">
          <strong>خطأ اتصال التتبع:</strong>
          <span>{socketError}</span>
        </div>
      )}

      {stoppedDrivers.length > 0 && (
        <div className="tracking-error">
          <strong>سائقون غير ظاهرين على الخريطة:</strong>
          <span>
            {stoppedDrivers
              .map((driver) => `${driver.name} (${driver.tracking?.status || "NO_LOCATION"})`)
              .join("، ")}
          </span>
        </div>
      )}

      <div className="map-card">
        <MapContainer
          center={[36.3456, 43.1234]}
          zoom={13}
          className="live-map"
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {driversWithLocation.map((driver) => (
            <Marker
              key={driver.id}
              position={[
                Number(driver.tracking.latitude),
                Number(driver.tracking.longitude),
              ]}
              icon={driverIcon}
            >
              <Popup>
                <div className="map-popup">
                  <strong>{driver.name}</strong>

                  <span>
                    {driver.vehicle?.type || "بدون مركبة"}
                  </span>

                  <span>الحالة: متصل</span>

                  <span>
                    الرصيد: {Number(driver.balance || 0).toLocaleString()} د.ع
                  </span>

                  {driver.tracking.lastSeen && (
                    <span>
                      آخر تحديث:{" "}
                      {new Date(driver.tracking.lastSeen).toLocaleTimeString(
                        "ar-IQ"
                      )}
                    </span>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}

export default LiveTrackingMap;