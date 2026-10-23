package dev.rackd.app.update;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class AppUpdateTest {
    private static final String RELEASE = """
        {"assets":[
          {"name":"android-versions.json","browser_download_url":"https://example.test/versions.json"},
          {"name":"app-release.apk","browser_download_url":"https://example.test/phone.apk"},
          {"name":"wear-release.apk","browser_download_url":"https://example.test/wear.apk"}
        ]}
        """;

    @Test
    public void offersThePhoneApkWhenTheReleaseIsNewer() {
        AppUpdate.Offer offer = AppUpdate.offer(RELEASE, versions(5, "1.4"), 4);
        assertEquals(5, offer.versionCode);
        assertEquals("1.4", offer.versionName);
        assertEquals("https://example.test/phone.apk", offer.apkUrl);
    }

    @Test
    public void skipsTheSameOrOlderBuild() {
        assertNull(AppUpdate.offer(RELEASE, versions(4, "1.3"), 4));
        assertNull(AppUpdate.offer(RELEASE, versions(3, "1.2"), 4));
    }

    @Test
    public void skipsAReleaseWithoutThePhoneApk() {
        String release = """
            {"assets":[{"name":"wear-release.apk","browser_download_url":"https://example.test/wear.apk"}]}
            """;
        assertNull(AppUpdate.offer(release, versions(9, "2.0"), 4));
    }

    @Test
    public void skipsBrokenVersionMetadata() {
        assertNull(AppUpdate.offer(RELEASE, "{}", 4));
        assertNull(AppUpdate.offer(RELEASE, "not-json", 4));
        assertEquals(-1, AppUpdate.versionCode(null));
    }

    private static String versions(int code, String name) {
        return "{\"phoneVersionCode\":" + code + ",\"phoneVersionName\":\"" + name + "\"}";
    }
}
