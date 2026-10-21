package dev.rackd.app.bridge;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONObject;

/** WebView entry to {@link WearBridge}. Registered from {@code MainActivity}. */
@CapacitorPlugin(name = "RackdWear")
public class RackdWearPlugin extends Plugin {
    private static WeakReference<RackdWearPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    @PluginMethod
    public void publish(PluginCall call) {
        instance = new WeakReference<>(this);
        String payload = call.getString("payload", "");
        String token = call.getString("token", "");
        String apiBase = call.getString("apiBase", "");
        if (payload == null || payload.isEmpty()) {
            call.reject("payload required");
            return;
        }
        WearBridge.publish(getContext(), payload, token == null ? "" : token, apiBase == null ? "" : apiBase);
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        WearBridge.clear(getContext());
        call.resolve();
    }

    @PluginMethod
    public void sync(PluginCall call) {
        JSONObject snap = WearBridge.snapshot(getContext());
        JSObject ret = new JSObject();
        ret.put("revision", snap.optInt("revision", 0));
        ret.put("restEndAt", snap.optLong("restEndAt", 0));
        ret.put("sessionId", snap.optString("sessionId", ""));
        call.resolve(ret);
    }

    static void emit(String type, long restEndAt, int revision) {
        RackdWearPlugin plugin = instance.get();
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("type", type);
        data.put("restEndAt", restEndAt);
        data.put("revision", revision);
        plugin.notifyListeners("action", data);
    }
}
