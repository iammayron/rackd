import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.rackd.app",
  appName: "Rackd",
  webDir: "public",
  server: {
    androidScheme: "https",
    cleartext: true,
  },
};

export default config;
