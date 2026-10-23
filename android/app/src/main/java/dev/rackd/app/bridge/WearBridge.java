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
import java.util.ArrayDeque;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Phone side of the Wear OS companion. The watch reads `/rackd/workout`.
 * Log / skip / +30s / weight / reps arrive on `/rackd/action`. State rules match
 * `apps/web/src/features/active-workout/watch-payload.ts`.
 */
public final class WearBridge {
    static final String PATH = "/rackd/workout";
    private static final String PREFS = "rackd_wear";
    private static final String TAG = "RackdWear";
    private static final double KG_PER_LB = 0.45359237;

    private static boolean inflight = false;
    private static boolean adjustBusy = false;
    /** Latest weight/reps still waiting on the in-flight PUT. One entry per set, in order. */
    private static final ArrayDeque<PendingAdjust> pendingAdjusts = new ArrayDeque<>();

    private static final class PendingAdjust {
        final String setId;
        Double weightKg;
        Integer reps;

        PendingAdjust(String setId, Double weightKg, Integer reps) {
            this.setId = setId;
            this.weightKg = weightKg;
            this.reps = reps;
        }
    }

    private WearBridge() {}

    /** Republish the phone capability. Static wear.xml is not enough after a Wear OS 6 sync stall. */
    public static void advertise(Context context) {
        if (context == null) return;
        try {
            Wearable.getCapabilityClient(context.getApplicationContext()).addLocalCapability("rackd_phone");
        } catch (Exception e) {
            Log.w(TAG, "capability advertise failed", e);
        }
    }

    public static void publish(Context context, String payloadJson, String token, String apiBase) {
        Context app = context.getApplicationContext();
        advertise(app);
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
            adjustBusy = false;
            pendingAdjusts.clear();
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
        logSet(context, null);
    }

    /** `setId` null logs the first open set. A watch looking at another exercise passes that set. */
    public static void logSet(Context context, String setId) {
        Context app = context.getApplicationContext();
        String token;
        String apiBase;
        synchronized (WearBridge.class) {
            if (inflight) return;
            JSONObject stored = read(app);
            if (stored == null) return;
            JSONObject target = setId == null || setId.isEmpty()
                ? firstOpen(stored.optJSONArray("items"))
                : findSet(stored.optJSONArray("items"), setId);
            if (target == null || target.optBoolean("completed")) return;
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

    /** `weightKg` null updates reps only. `reps` null updates weight only. */
    public static void adjust(Context context, String setId, Double weightKg, Integer reps) {
        if ((weightKg == null && reps == null) || setId == null || setId.isEmpty()) return;
        Context app = context.getApplicationContext();
        PendingAdjust job = null;
        String token = null;
        String apiBase = null;
        synchronized (WearBridge.class) {
            JSONObject stored = read(app);
            if (stored == null) return;
            if (findSet(stored.optJSONArray("items"), setId) == null) return;
            token = prefs(app).getString("token", "");
            apiBase = prefs(app).getString("apiBase", "");
            if (token == null || token.isEmpty() || apiBase == null || apiBase.isEmpty()) {
                fail(app, stored, "Open Rackd on your phone");
                return;
            }
            try {
                JSONObject next = adjustItem(stored, setId, weightKg, reps);
                next.remove("error");
                write(app, next, null, null);
                push(app, next);
            } catch (Exception e) {
                Log.e(TAG, "adjust apply failed", e);
                return;
            }
            queueAdjust(setId, weightKg, reps);
            if (adjustBusy) return;
            adjustBusy = true;
            job = pendingAdjusts.poll();
        }
        drainAdjusts(app, token, apiBase, job);
    }

    /** A later tap on the same set replaces the value still waiting to be saved. */
    private static void queueAdjust(String setId, Double weightKg, Integer reps) {
        PendingAdjust last = pendingAdjusts.peekLast();
        if (last != null && last.setId.equals(setId)) {
            if (weightKg != null) last.weightKg = weightKg;
            if (reps != null) last.reps = reps;
            return;
        }
        pendingAdjusts.add(new PendingAdjust(setId, weightKg, reps));
    }

    private static void drainAdjusts(Context app, String token, String apiBase, PendingAdjust job) {
        while (job != null) {
            int code = putSet(apiBase, token, job.setId, adjustBody(job));
            String kind = job.weightKg != null ? "weight" : "reps";
            synchronized (WearBridge.class) {
                JSONObject stored = read(app);
                if (stored == null) {
                    adjustBusy = false;
                    pendingAdjusts.clear();
                    return;
                }
                if (code < 200 || code >= 300) {
                    adjustBusy = false;
                    pendingAdjusts.clear();
                    fail(app, stored, code == 401 ? "Open Rackd on your phone" : "Couldn't update that set");
                    return;
                }
                job = pendingAdjusts.poll();
                if (job == null) {
                    adjustBusy = false;
                    RackdWearPlugin.emit(kind, stored.optLong("restEndAt"), stored.optInt("revision"));
                    return;
                }
                token = prefs(app).getString("token", "");
                apiBase = prefs(app).getString("apiBase", "");
            }
        }
    }

    private static String adjustBody(PendingAdjust job) {
        StringBuilder body = new StringBuilder("{");
        if (job.weightKg != null) {
            body.append("\"weight\":").append(String.format(Locale.US, "%.4f", job.weightKg));
        }
        if (job.reps != null) {
            if (job.weightKg != null) body.append(',');
            body.append("\"reps\":").append(job.reps);
        }
        body.append('}');
        return body.toString();
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
            next.put("unit", incoming.optString("unit", "kg"));
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
                JSONObject prev = findSet(storedItems, item.optString("setId"));
                if (prev != null) {
                    item.put("weight", prev.optDouble("weight", item.optDouble("weight", 0)));
                    item.put("weightLabel", prev.optString("weightLabel", item.optString("weightLabel", "")));
                    item.put("reps", prev.optInt("reps", item.optInt("reps", 0)));
                    if (prev.optBoolean("completed")) item.put("completed", true);
                }
                merged.put(item);
            }
        }
        next.put("sessionId", stored.optString("sessionId", ""));
        next.put("restEndAt", stored.optLong("restEndAt", 0));
        next.put("unit", stored.optString("unit", "kg"));
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

    private static JSONObject adjustItem(JSONObject stored, String setId, Double weightKg, Integer reps) throws Exception {
        JSONArray items = stored.optJSONArray("items");
        JSONObject target = findSet(items, setId);
        if (target == null) return stored;
        if (weightKg != null) {
            target.put("weight", weightKg);
            target.put("weightLabel", formatWeight(weightKg, stored.optString("unit", "kg")));
        }
        if (reps != null) target.put("reps", reps);
        JSONObject next = new JSONObject(stored.toString());
        next.put("revision", stored.optInt("revision", 0) + 1);
        next.put("items", items);
        return next;
    }

    static String formatWeight(double kg, String unit) {
        boolean lb = "lb".equals(unit);
        double display = lb ? kg / KG_PER_LB : kg;
        double rounded = Math.round(display * 10.0) / 10.0;
        String text = Math.abs(rounded - Math.rint(rounded)) < 0.001
            ? String.valueOf((long) Math.rint(rounded))
            : String.format(Locale.US, "%.1f", rounded);
        return text + (lb ? " lb" : " kg");
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

    private static JSONObject findSet(JSONArray items, String setId) {
        if (items == null || setId == null) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && setId.equals(item.optString("setId"))) return item;
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
        return putSet(apiBase, token, setId, "{\"completed\":true}");
    }

    private static int putSet(String apiBase, String token, String setId, String json) {
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
            byte[] body = json.getBytes(StandardCharsets.UTF_8);
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
