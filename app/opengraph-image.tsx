import { ImageResponse } from "next/og";
import { siteConfig } from "@/config/site";

export const size = {
  width: 1200,
  height: 630
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fbfaf7",
          color: "#171717",
          padding: 72
        }}
      >
        <div
          style={{
            color: "#713d2f",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase"
          }}
        >
          Photography and client delivery
        </div>
        <div style={{ fontSize: 128, fontWeight: 800, lineHeight: 0.88 }}>
          {siteConfig.name}
        </div>
        <div style={{ color: "#66625d", fontSize: 34 }}>{siteConfig.description}</div>
      </div>
    ),
    size
  );
}
