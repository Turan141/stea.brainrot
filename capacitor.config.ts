import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.brainrotheist.game",
  appName: "Brainrot Heist",
  webDir: "dist",
  android: {
    // game is landscape/fullscreen; let the WebView own the whole surface
    backgroundColor: "#0b0f1a",
  },
};

export default config;
