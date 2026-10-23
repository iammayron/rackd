package dev.rackd.wear;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class WearUpdateTest {
    private static final String RELEASE = """
        {"assets":[
          {"name":"android-versions.json","browser_download_url":"https://example.test/versions.json"},
          {"name":"app-release.apk","browser_download_url":"https://example.test/phone.apk"},
          {"name":"wear-release.apk","browser_download_url":"https://example.test/wear.apk"}
        ]}
        """;

    @Test
    public void offersTheWatchApkWhenTheReleaseIsNewer() {
        WearUpdate.Offer offer = WearUpdate.offer(RELEASE, versions(5, "1.4"), 4);
        assertEquals(5, offer.versionCode);
        assertEquals("1.4", offer.versionName);
        assertEquals("https://example.test/wear.apk", offer.apkUrl);
    }

    @Test
    public void skipsTheSameOrOlderBuild() {
        assertNull(WearUpdate.offer(RELEASE, versions(4, "1.3"), 4));
        assertNull(WearUpdate.offer(RELEASE, versions(3, "1.2"), 4));
    }

    @Test
    public void skipsAReleaseWithoutTheWatchApk() {
        String release = """
            {"assets":[{"name":"app-release.apk","browser_download_url":"https://example.test/phone.apk"}]}
            """;
        assertNull(WearUpdate.offer(release, versions(9, "2.0"), 4));
    }

    @Test
    public void skipsBrokenVersionMetadata() {
        assertNull(WearUpdate.offer(RELEASE, "{}", 4));
        assertNull(WearUpdate.offer(RELEASE, "not-json", 4));
        assertEquals(-1, WearUpdate.versionCode(null));
    }

    private static String versions(int code, String name) {
        return "{\"wearVersionCode\":" + code + ",\"wearVersionName\":\"" + name + "\"}";
    }
}
