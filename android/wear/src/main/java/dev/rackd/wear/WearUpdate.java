package dev.rackd.wear;

import org.json.JSONArray;
import org.json.JSONObject;

/** Decides whether a public GitHub release is a newer watch build. */
public final class WearUpdate {
    public static final String RELEASES_URL = "https://api.github.com/repos/iammayron/rackd/releases/latest";
    public static final String VERSIONS_ASSET = "android-versions.json";
    public static final String APK_ASSET = "wear-release.apk";

    public static final class Offer {
        public final int versionCode;
        public final String versionName;
        public final String apkUrl;

        public Offer(int versionCode, String versionName, String apkUrl) {
            this.versionCode = versionCode;
            this.versionName = versionName;
            this.apkUrl = apkUrl;
        }
    }

    private WearUpdate() {}

    /** Null when the release is missing, not newer, or has no watch APK. */
    public static Offer offer(String releaseJson, String versionsJson, int installedCode) {
        int latest = versionCode(versionsJson);
        String apkUrl = assetUrl(releaseJson, APK_ASSET);
        if (latest <= installedCode || apkUrl == null) return null;
        String versionName = versionName(versionsJson);
        return new Offer(latest, versionName == null ? "" : versionName, apkUrl);
    }

    public static int versionCode(String versionsJson) {
        if (versionsJson == null || versionsJson.isEmpty()) return -1;
        try {
            return new JSONObject(versionsJson).optInt("wearVersionCode", -1);
        } catch (Exception e) {
            return -1;
        }
    }

    public static String versionName(String versionsJson) {
        if (versionsJson == null || versionsJson.isEmpty()) return "";
        try {
            return new JSONObject(versionsJson).optString("wearVersionName", "");
        } catch (Exception e) {
            return "";
        }
    }

    public static String assetUrl(String releaseJson, String assetName) {
        if (releaseJson == null || assetName == null) return null;
        try {
            JSONArray assets = new JSONObject(releaseJson).optJSONArray("assets");
            if (assets == null) return null;
            for (int i = 0; i < assets.length(); i++) {
                JSONObject asset = assets.optJSONObject(i);
                if (asset == null || !assetName.equals(asset.optString("name"))) continue;
                String url = asset.optString("browser_download_url", "");
                return url.isEmpty() ? null : url;
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
