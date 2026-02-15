import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Bunkialo";
export const size = {
  width: 1200,
  height: 600,
};

export const contentType = "image/png";

export default async function TwitterImage() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "https://bunkialo.noel.is-a.dev";

  const logoUrl = `${siteUrl}/og-logo.png`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background:
            "radial-gradient(900px 420px at 18% 35%, rgba(255, 171, 0, 0.55) 0%, rgba(255, 171, 0, 0) 62%), radial-gradient(700px 380px at 92% 30%, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0) 72%), linear-gradient(135deg, #090b10 0%, #0c111b 45%, #07070a 100%)",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 78,
                height: 78,
                borderRadius: 22,
                background: "#ffab00",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 16px 34px rgba(255, 171, 0, 0.30)",
                border: "1px solid rgba(255, 255, 255, 0.22)",
              }}
            >
              <img
                src={logoUrl}
                width={56}
                height={56}
                alt="Bunkialo"
                style={{ display: "block" }}
              />
            </div>
            <div
              style={{
                fontSize: 70,
                fontWeight: 850,
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              Bunkialo
            </div>
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, maxWidth: 820 }}>
            Track attendance, deadlines, timetable. Built for IIIT Kottayam.
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {["Attendance", "Deadlines", "Timetable"].map((label) => (
              <div
                key={label}
                style={{
                  fontSize: 20,
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  color: "rgba(255, 255, 255, 0.92)",
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 56,
            background:
              "linear-gradient(180deg, rgba(255, 171, 0, 0.18) 0%, rgba(255, 171, 0, 0.06) 100%)",
            border: "1px solid rgba(255, 171, 0, 0.30)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -100,
              background:
                "radial-gradient(closest-side, rgba(255, 171, 0, 0.45) 0%, rgba(255, 171, 0, 0) 70%)",
              transform: "translate(40px, 30px)",
            }}
          />
          <div
            style={{
              width: 190,
              height: 190,
              borderRadius: 56,
              background: "#ffab00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 22px 52px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.22)",
            }}
          >
            <img
              src={logoUrl}
              width={138}
              height={138}
              alt="Bunkialo"
              style={{ display: "block" }}
            />
          </div>
        </div>
      </div>
    ),
    size,
  );
}
