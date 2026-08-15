import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { User, IdCard, Briefcase, CalendarDays } from "lucide-react";

const C = {
  white: "#ffffff",
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate300: "#cbd5e1",
  slate200: "#e2e8f0",
  slate100: "#f1f5f9",
  purple: "#6D28D9",
  purple2: "#7C3AED",
  blue: "#2563EB",
  green: "#10B981",
  orange: "#F97316",
};

const IconBox = ({ bg, children }) => (
  <div
    style={{
      width: 44,
      height: 44,
      borderRadius: 14,
      background: bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 10px 20px rgba(15,23,42,0.10)",
      flexShrink: 0,
      boxSizing: "border-box",
    }}
  >
    {children}
  </div>
);

const InfoRow = ({ iconBg, icon, label, value }) => {
  const safeValue = value || "—";

  // Optional: slightly smaller font for long values
  const valueFontSize = safeValue.length > 24 ? 12 : 13;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start", // ✅ top align so wrapped text isn't clipped
        gap: 12,
        padding: "12px 12px",
        borderRadius: 16,
        background: C.white,
        border: `1px solid ${C.slate200}`,
        boxShadow: "0 10px 20px rgba(15,23,42,0.06)",
        boxSizing: "border-box",
      }}
    >
      <IconBox bg={iconBg}>{icon}</IconBox>

      {/* ✅ Grid: label | : | value  (value wraps safely) */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "grid",
          gridTemplateColumns: "90px 14px 1fr",
          columnGap: 8,
          rowGap: 0,
          alignItems: "start",
          boxSizing: "border-box",
          paddingTop: 6, // aligns text vertically with icon nicely
        }}
      >
        <span
          style={{
            fontSize: 13,
            color: C.slate500,
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          {label}
        </span>

        <span
          style={{
            color: C.slate300,
            fontWeight: 900,
            textAlign: "center",
            lineHeight: 1.25,
          }}
        >
          :
        </span>

        <span
          style={{
            fontSize: valueFontSize,
            color: C.slate900,
            fontWeight: 900,
            lineHeight: 1.25,
            whiteSpace: "normal", // ✅ allow wrap
            wordBreak: "break-word", // ✅ avoid overflow
            overflow: "visible", // ✅ no clipping
          }}
          title={safeValue}
        >
          {safeValue}
        </span>
      </div>
    </div>
  );
};

const EmployeeIDCard = ({ employee, barcodeValue, cardRefProp }) => {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barcodeValue || "", {
        format: "CODE128",
        displayValue: false,
        height: 46,
        margin: 0,
      });
    } catch {
      // ignore
    }
  }, [barcodeValue]);

  const fullName =
    employee?.name ||
    `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();

  const joinDateText = employee?.joinDate
    ? new Date(employee.joinDate).toLocaleDateString()
    : "—";

  return (
    <div
      ref={cardRefProp}
      style={{
        width: 360,
        borderRadius: 24,
        overflow: "hidden",
        background: C.white,
        border: `1px solid ${C.slate200}`,
        boxShadow: "0 24px 60px rgba(15,23,42,0.14)",
        boxSizing: "border-box",
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          position: "relative",
          padding: "18px 18px 92px",
          background:
            "linear-gradient(135deg, #2563EB 0%, #6D28D9 55%, #7C3AED 100%)",
          color: C.white,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 16,
            top: 18,
            width: 72,
            height: 44,
            opacity: 0.22,
            backgroundImage: "radial-gradient(#fff 1.4px, transparent 1.4px)",
            backgroundSize: "10px 10px",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 14,
            top: 10,
            width: 90,
            height: 90,
            opacity: 0.18,
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
            transform: "rotate(10deg)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: "rgba(255,255,255,0.18)",
              border: "1px solid rgba(255,255,255,0.26)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IdCard size={18} color="#fff" />
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, opacity: 0.92, fontWeight: 800 }}>
              ID CARD
            </div>
            <div style={{ fontSize: 18, fontWeight: 950, letterSpacing: 0.3 }}>
              TechTitans (Pvt) Ltd
            </div>
          </div>
        </div>

        {/* white wave */}
        <svg
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -1,
            width: "100%",
            height: 80,
          }}
        >
          <path
            d="M0,40 C180,110 360,110 540,70 C720,30 900,0 1080,25 C1260,50 1350,90 1440,110 L1440,120 L0,120 Z"
            fill="#ffffff"
          />
        </svg>
      </div>

      {/* AVATAR */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          marginTop: -72,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 999,
            background: C.white,
            padding: 6,
            boxShadow: "0 22px 40px rgba(15,23,42,0.20)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 999,
              overflow: "hidden",
              background: C.slate100,
              border: `1px solid ${C.slate200}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxSizing: "border-box",
            }}
          >
            {employee?.image ? (
              <img
                src={employee.image}
                alt="profile"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span
                style={{ fontSize: 28, fontWeight: 950, color: C.slate500 }}
              >
                {(employee?.firstName?.[0] || "U").toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: "16px 18px 18px", boxSizing: "border-box" }}>
        <div style={{ display: "grid", gap: 12 }}>
          <InfoRow
            iconBg={`linear-gradient(135deg, ${C.purple2} 0%, ${C.purple} 100%)`}
            icon={<User size={18} color="#fff" />}
            label="Name"
            value={fullName}
          />
          <InfoRow
            iconBg={`linear-gradient(135deg, ${C.blue} 0%, #1D4ED8 100%)`}
            icon={<IdCard size={18} color="#fff" />}
            label="NIC"
            value={employee?.nationalIdNumber}
          />
          <InfoRow
            iconBg={`linear-gradient(135deg, ${C.green} 0%, #059669 100%)`}
            icon={<Briefcase size={18} color="#fff" />}
            label="Position"
            value={employee?.position}
          />
          <InfoRow
            iconBg={`linear-gradient(135deg, ${C.orange} 0%, #EA580C 100%)`}
            icon={<CalendarDays size={18} color="#fff" />}
            label="Join Date"
            value={joinDateText}
          />
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 18,
            background: C.white,
            border: `1px solid ${C.slate200}`,
            boxShadow: "0 12px 22px rgba(15,23,42,0.08)",
            boxSizing: "border-box",
          }}
        >
          <svg
            ref={svgRef}
            style={{ width: "100%", height: 56, display: "block" }}
          />
          <div
            style={{
              marginTop: 10,
              textAlign: "center",
              fontSize: 12,
              fontWeight: 950,
              color: C.purple,
              letterSpacing: 0.6,
            }}
          >
            ★ Valid Employee ID ★
          </div>
          <div
            style={{
              marginTop: 6,
              textAlign: "center",
              fontSize: 11,
              color: C.slate500,
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            }}
          >
            {barcodeValue}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeIDCard;
