import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Bunkialo";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #0f2a3d 45%, #07101a 100%)",
          color: "#ffffff",
          padding: 64,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            Bunkialo
          </div>
          <div style={{ fontSize: 32, opacity: 0.92, maxWidth: 900 }}>
            Attendance, deadlines, timetable. One app for IIIT Kottayam.
          </div>
          <div style={{ fontSize: 22, opacity: 0.7 }}>
            lmsug24.iiitkottayam.ac.in
          </div>
        </div>
      </div>
    ),
    size,
  );
}

