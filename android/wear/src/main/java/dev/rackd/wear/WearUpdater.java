package dev.rackd.wear;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;

/** Fetches the public GitHub release and hands the watch APK to the system installer. */
public final class WearUpdater {
    /** The activity checks on open, then again on this interval while it stays open. */
    public static final long INTERVAL_MS = 60L * 60 * 1000;
    private static final String PREFS = "rackd_wear_update";
    private static final AtomicBoolean BUSY = new AtomicBoolean(false);

    public interface Callback {
        void onOffer(WearUpdate.Offer offer);
    }

    public interface Progress {
        /** {@code totalBytes} is -1 when the server omits Content-Length. */
        void onProgress(long readBytes, long totalBytes);
    }

    private WearUpdater() {}

    public static void check(Context context, Callback callback) {
        Context app = context.getApplicationContext();
        int installed = installedCode(app);
        if (!BUSY.compareAndSet(false, true)) {
            callback.onOffer(readCached(app, installed));
            return;
        }
        new Thread(() -> {
            try {
                callback.onOffer(fetch(app, installed));
            } finally {
                BUSY.set(false);
            }
        }, "rackd-update").start();
    }

    public static boolean canInstall(Context context) {
        return Build.VERSION.SDK_INT < 26 || context.getPackageManager().canRequestPackageInstalls();
    }

    public static void requestInstallPermission(Context context) {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + context.getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    public static void install(Context context, String apkUrl) throws Exception {
        install(context, apkUrl, null);
    }

    public static void install(Context context, String apkUrl, Progress progress) throws Exception {
        PackageInstaller installer = context.getPackageManager().getPackageInstaller();
        PackageInstaller.SessionParams params = new PackageInstaller.SessionParams(
            PackageInstaller.SessionParams.MODE_FULL_INSTALL
        );
        if (Build.VERSION.SDK_INT >= 31) {
            params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_REQUIRED);
        }
        int sessionId = installer.createSession(params);
        PackageInstaller.Session session = installer.openSession(sessionId);
        try {
            HttpURLConnection conn = open(apkUrl, false);
            long total = conn.getContentLengthLong();
            try (InputStream in = conn.getInputStream();
                 OutputStream out = session.openWrite("rackd.apk", 0, total > 0 ? total : -1)) {
                byte[] buf = new byte[8192];
                long read = 0;
                int n;
                while ((n = in.read(buf)) >= 0) {
                    out.write(buf, 0, n);
                    read += n;
                    if (progress != null) progress.onProgress(read, total);
                }
                session.fsync(out);
            } finally {
                conn.disconnect();
            }
            Intent callback = new Intent(context, UpdateInstallReceiver.class);
            callback.setAction(UpdateInstallReceiver.ACTION);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
            PendingIntent pending = PendingIntent.getBroadcast(context, sessionId, callback, flags);
            session.commit(pending.getIntentSender());
        } catch (Exception e) {
            session.abandon();
            throw e;
        } finally {
            session.close();
        }
    }

    private static WearUpdate.Offer fetch(Context app, int installed) {
        try {
            String release = get(WearUpdate.RELEASES_URL, true);
            String versionsUrl = WearUpdate.assetUrl(release, WearUpdate.VERSIONS_ASSET);
            if (versionsUrl == null) {
                remember(app, null);
                return null;
            }
            WearUpdate.Offer offer = WearUpdate.offer(release, get(versionsUrl, false), installed);
            remember(app, offer);
            return offer;
        } catch (Exception e) {
            return readCached(app, installed);
        }
    }

    private static void remember(Context app, WearUpdate.Offer offer) {
        SharedPreferences.Editor editor = prefs(app).edit().putLong("checkedAt", System.currentTimeMillis());
        if (offer == null) editor.remove("versionCode").remove("versionName").remove("apkUrl");
        else {
            editor.putInt("versionCode", offer.versionCode);
            editor.putString("versionName", offer.versionName);
            editor.putString("apkUrl", offer.apkUrl);
        }
        editor.apply();
    }

    private static WearUpdate.Offer readCached(Context app, int installed) {
        SharedPreferences prefs = prefs(app);
        int code = prefs.getInt("versionCode", -1);
        String url = prefs.getString("apkUrl", "");
        if (code <= installed || url == null || url.isEmpty()) return null;
        return new WearUpdate.Offer(code, prefs.getString("versionName", ""), url);
    }

    private static int installedCode(Context app) {
        try {
            PackageInfo info = app.getPackageManager().getPackageInfo(app.getPackageName(), 0);
            return (int) info.getLongVersionCode();
        } catch (Exception e) {
            return 0;
        }
    }

    private static String get(String target, boolean api) throws Exception {
        HttpURLConnection conn = open(target, api);
        try (InputStream in = conn.getInputStream()) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } finally {
            conn.disconnect();
        }
    }

    private static HttpURLConnection open(String target, boolean api) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(target).openConnection();
        conn.setConnectTimeout(8000);
        conn.setReadTimeout(20000);
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "RackdWear");
        conn.setRequestProperty("Accept", api ? "application/vnd.github+json" : "*/*");
        return conn;
    }

    private static SharedPreferences prefs(Context app) {
        return app.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
