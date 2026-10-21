package dev.rackd.app.bridge;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Log;
import com.google.android.gms.wearable.DataClient;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Phone side of the Wear OS companion. The watch reads `/rackd/workout`.
 * Log / skip / +30s arrive on `/rackd/action`. State rules match
 * `apps/web/src/features/active-workout/watch-payload.ts`.
 */
public final class WearBridge {
    static final String PATH = "/rackd/workout";
    private static final String PREFS = "rackd_wear";
    private static final String TAG = "RackdWear";

    private static boolean inflight = false;

    private WearBridge() {}

    public static void publish(Context context, String payloadJson, String token, String apiBase) {
        Context app = context.getApplicationContext();
        synchronized (WearBridge.class) {
            try {
                JSONObject incoming = new JSONObject(payloadJson);
                JSONObject stored = read(app);
                JSONObject next = merge(stored, incoming);
                if (incoming.has("error")) next.remove("error");
                write(app, next, token, apiBase);
                push(app, next);
            } catch (Exception e) {
                Log.e(TAG, "publish failed", e);
            }
        }
        startService(app);
    }

    public static void clear(Context context) {
        Context app = context.getApplicationContext();
        synchronized (WearBridge.class) {
            prefs(app).edit().clear().apply();
            inflight = false;
        }
        try {
            Uri uri = new Uri.Builder().scheme("wear").path(PATH).build();
            Wearable.getDataClient(app).deleteDataItems(uri, DataClient.FILTER_PREFIX);
        } catch (Exception e) {
            Log.e(TAG, "clear failed", e);
        }
        app.stopService(new Intent(app, WorkoutBridgeService.class));
    }

    /** revision + restEndAt for the web view to catch up after a locked screen. */
    public static JSONObject snapshot(Context context) {
        JSONObject stored = read(context.getApplicationContext());
        JSONObject out = new JSONObject();
        try {
            out.put("revision", stored == null ? 0 : stored.optInt("revision", 0));
            out.put("restEndAt", stored == null ? 0 : stored.optLong("restEndAt", 0));
            out.put("sessionId", stored == null ? "" : stored.optString("sessionId", ""));
        } catch (Exception ignored) {
        }
        return out;
    }

    public static void logCurrentSet(Context context) {
        Context app = context.getApplicationContext();
        String setId;
        String token;
        String apiBase;
        synchronized (WearBridge.class) {
            if (inflight) return;
            JSONObject stored = read(app);
            if (stored == null) return;
            JSONObject target = firstOpen(stored.optJSONArray("items"));
            if (target == null) return;
            setId = target.optString("setId", "");
            token = prefs(app).getString("token", "");
            apiBase = prefs(app).getString("apiBase", "");
            if (setId.isEmpty() || token == null || token.isEmpty() || apiBase == null || apiBase.isEmpty()) {
                fail(app, stored, "Open Rackd on your phone");
                return;
            }
            inflight = true;
        }
        int code = putCompleted(apiBase, token, setId);
        synchronized (WearBridge.class) {
            inflight = false;
            JSONObject stored = read(app);
            if (stored == null) return;
            if (code < 200 || code >= 300) {
                fail(app, stored, code == 401 ? "Open Rackd on your phone" : "Couldn't log that set");
                return;
            }
            try {
                JSONObject next = completeSet(stored, setId, System.currentTimeMillis());
                next.remove("error");
                write(app, next, null, null);
                push(app, next);
                RackdWearPlugin.emit("log", next.optLong("restEndAt"), next.optInt("revision"));
            } catch (Exception e) {
                Log.e(TAG, "log apply failed", e);
            }
        }
    }

    public static void skipRest(Context context) {
        mutate(context, "skip");
    }

    public static void addRest(Context context) {
        mutate(context, "add30");
    }

    private static void mutate(Context context, String action) {
        Context app = context.getApplicationContext();
        synchronized (WearBridge.class) {
            JSONObject stored = read(app);
            if (stored == null) return;
            try {
                long now = System.currentTimeMillis();
                JSONObject next = "skip".equals(action) ? afterSkip(stored) : afterAdd(stored, now);
                next.remove("error");
                write(app, next, null, null);
                push(app, next);
                RackdWearPlugin.emit(action, next.optLong("restEndAt"), next.optInt("revision"));
            } catch (Exception e) {
                Log.e(TAG, action + " failed", e);
            }
        }
    }

    private static JSONObject merge(JSONObject stored, JSONObject incoming) throws Exception {
        int revision = stored == null ? 0 : stored.optInt("revision", 0);
        int ack = incoming.optInt("ack", 0);
        JSONObject next = new JSONObject();
        next.put("revision", revision);
        if (stored == null || ack >= revision) {
            next.put("sessionId", incoming.optString("sessionId", ""));
            next.put("restEndAt", incoming.optLong("restEndAt", 0));
            next.put("items", incoming.optJSONArray("items"));
            return next;
        }
        JSONArray done = new JSONArray();
        JSONArray storedItems = stored.optJSONArray("items");
        if (storedItems != null) {
            for (int i = 0; i < storedItems.length(); i++) {
                JSONObject item = storedItems.optJSONObject(i);
                if (item != null && item.optBoolean("completed")) done.put(item.optString("setId"));
            }
        }
        JSONArray incomingItems = incoming.optJSONArray("items");
        JSONArray merged = new JSONArray();
        if (incomingItems != null) {
            for (int i = 0; i < incomingItems.length(); i++) {
                JSONObject item = incomingItems.optJSONObject(i);
                if (item == null) continue;
                for (int d = 0; d < done.length(); d++) {
                    if (done.optString(d).equals(item.optString("setId"))) item.put("completed", true);
                }
                merged.put(item);
            }
        }
        next.put("sessionId", stored.optString("sessionId", ""));
        next.put("restEndAt", stored.optLong("restEndAt", 0));
        next.put("items", merged);
        if (stored.has("error")) next.put("error", stored.optString("error"));
        return next;
    }

    /**
     * Marks the set we just PUT. Same rest rule as `afterLog` in watch-payload.ts.
     * If a phone publish already marked it, leave the snapshot alone.
     */
    private static JSONObject completeSet(JSONObject stored, String setId, long now) throws Exception {
        JSONArray items = stored.optJSONArray("items");
        if (items == null) return stored;
        JSONObject target = null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && setId.equals(item.optString("setId"))) {
                target = item;
                break;
            }
        }
        if (target == null || target.optBoolean("completed")) return stored;
        target.put("completed", true);
        boolean anyLeft = false;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && !item.optBoolean("completed")) anyLeft = true;
        }
        long restEndAt = 0;
        if (target.optBoolean("rests") && anyLeft && target.optInt("restSec") > 0) {
            restEndAt = now + target.optInt("restSec") * 1000L;
        }
        JSONObject next = new JSONObject(stored.toString());
        next.put("revision", stored.optInt("revision", 0) + 1);
        next.put("restEndAt", restEndAt);
        next.put("items", items);
        return next;
    }

    private static JSONObject afterSkip(JSONObject stored) throws Exception {
        JSONObject next = new JSONObject(stored.toString());
        next.put("revision", stored.optInt("revision", 0) + 1);
        next.put("restEndAt", 0);
        return next;
    }

    private static JSONObject afterAdd(JSONObject stored, long now) throws Exception {
        long current = stored.optLong("restEndAt", 0);
        long base = current > now ? current : now;
        JSONObject next = new JSONObject(stored.toString());
        next.put("revision", stored.optInt("revision", 0) + 1);
        next.put("restEndAt", base + 30_000L);
        return next;
    }

    private static JSONObject firstOpen(JSONArray items) {
        if (items == null) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && !item.optBoolean("completed")) return item;
        }
        return null;
    }

    private static void fail(Context app, JSONObject stored, String message) {
        try {
            stored.put("error", message);
            write(app, stored, null, null);
            push(app, stored);
            RackdWearPlugin.emit("error", stored.optLong("restEndAt"), stored.optInt("revision"));
        } catch (Exception e) {
            Log.e(TAG, "fail status", e);
        }
    }

    private static int putCompleted(String apiBase, String token, String setId) {
        HttpURLConnection conn = null;
        try {
            String base = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
            URL url = new URL(base + "/api/set-logs/" + setId);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("PUT");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            byte[] body = "{\"completed\":true}".getBytes(StandardCharsets.UTF_8);
            try (OutputStream out = conn.getOutputStream()) {
                out.write(body);
            }
            return conn.getResponseCode();
        } catch (Exception e) {
            Log.e(TAG, "set log request failed", e);
            return 0;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    private static void push(Context app, JSONObject payload) {
        try {
            PutDataMapRequest request = PutDataMapRequest.create(PATH);
            request.getDataMap().putString("json", payload.toString());
            request.getDataMap().putLong("ts", System.currentTimeMillis());
            PutDataRequest put = request.asPutDataRequest();
            put.setUrgent();
            Wearable.getDataClient(app).putDataItem(put);
        } catch (Exception e) {
            Log.e(TAG, "push to watch failed", e);
        }
    }

    private static void write(Context app, JSONObject payload, String token, String apiBase) {
        SharedPreferences.Editor editor = prefs(app).edit().putString("payload", payload.toString());
        if (token != null) editor.putString("token", token);
        if (apiBase != null) editor.putString("apiBase", apiBase);
        editor.apply();
    }

    private static JSONObject read(Context app) {
        String raw = prefs(app).getString("payload", null);
        if (raw == null || raw.isEmpty()) return null;
        try {
            return new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static SharedPreferences prefs(Context app) {
        return app.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static void startService(Context app) {
        try {
            Intent intent = new Intent(app, WorkoutBridgeService.class);
            if (android.os.Build.VERSION.SDK_INT >= 26) app.startForegroundService(intent);
            else app.startService(intent);
        } catch (Exception e) {
            Log.w(TAG, "bridge service not started", e);
        }
    }
}
