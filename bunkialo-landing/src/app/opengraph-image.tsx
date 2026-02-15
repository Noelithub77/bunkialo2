import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Bunkialo";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function OpenGraphImage() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
    "https://bunkialo.noel.is-a.dev";

  // Satori often fails to load <img src="..."> URLs. Fetch and pass ArrayBuffer instead.
  const logoPng = await fetch(new URL("/og-logo.png", siteUrl)).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch logo: ${res.status}`);
    return res.arrayBuffer();
  });

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
            "radial-gradient(900px 500px at 18% 38%, rgba(255, 171, 0, 0.55) 0%, rgba(255, 171, 0, 0) 65%), radial-gradient(850px 420px at 88% 24%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0) 70%), linear-gradient(135deg, #090b10 0%, #0c111b 45%, #07070a 100%)",
          color: "#ffffff",
          padding: 72,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <div
              style={{
                width: 76,
                height: 76,
                borderRadius: 20,
                background: "rgba(255, 171, 0, 0.14)",
                border: "1px solid rgba(255, 171, 0, 0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "#ffab00",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 14px 32px rgba(255, 171, 0, 0.35)",
                }}
              >
                <img
                  // @ts-expect-error Satori supports ArrayBuffer src.
                  src={logoPng}
                  width={44}
                  height={44}
                  alt="Bunkialo"
                  style={{ display: "block" }}
                />
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
              <div style={{ fontSize: 22, opacity: 0.78 }}>
                IIIT Kottayam companion app
              </div>
            </div>
          </div>

          <div style={{ fontSize: 34, opacity: 0.93, maxWidth: 820 }}>
            Track attendance, deadlines, and timetable in one place.
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            {[
              "Attendance",
              "Assignments",
              "Timetable",
              "Mess menu",
              "Notifications",
            ].map((label) => (
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
            width: 380,
            height: 380,
            borderRadius: 84,
            background:
              "linear-gradient(180deg, rgba(255, 171, 0, 0.22) 0%, rgba(255, 171, 0, 0.06) 100%)",
            border: "1px solid rgba(255, 171, 0, 0.32)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: -120,
              background:
                "radial-gradient(closest-side, rgba(255, 171, 0, 0.48) 0%, rgba(255, 171, 0, 0) 70%)",
              transform: "translate(60px, 40px)",
            }}
          />
          <div
            style={{
              width: 240,
              height: 240,
              borderRadius: 72,
              background: "#ffab00",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <img
              // @ts-expect-error Satori supports ArrayBuffer src.
              src={logoPng}
              width={180}
              height={180}
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
