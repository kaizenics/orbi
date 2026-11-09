import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@orbi/core";

/** Lets the web app be installed to a phone's home screen (the iPhone option while the app is Android-only). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: "/trips",
    display: "standalone",
    background_color: "#fbfbfa",
    theme_color: "#fbfbfa",
    icons: [{ src: "/icon.png", sizes: "1024x1024", type: "image/png" }],
  };
}
