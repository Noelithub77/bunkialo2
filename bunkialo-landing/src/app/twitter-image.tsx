import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Bunkialo";
export const size = {
  width: 1200,
  height: 600,
};

export const contentType = "image/png";

export default async function TwitterImage() {
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
            "radial-gradient(900px 400px at 20% 20%, rgba(34, 211, 238, 0.25) 0%, rgba(34, 211, 238, 0) 60%), linear-gradient(135deg, #0b1220 0%, #0b1b2e 45%, #07101a 100%)",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 68,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            Bunkialo
          </div>
          <div style={{ fontSize: 30, opacity: 0.92, maxWidth: 860 }}>
            Track attendance and deadlines, generate your timetable, stay on top of
            campus life.
          </div>
        </div>
        <div
          style={{
            width: 280,
            height: 280,
            borderRadius: 56,
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          IIIT K
        </div>
      </div>
    ),
    size,
  );
}

