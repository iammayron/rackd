package dev.rackd.app.bridge;

import android.content.pm.PackageInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Exposes the installed Android version to the WebView (Settings footer). */
@CapacitorPlugin(name = "RackdApp")
public class RackdAppPlugin extends Plugin {
    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            JSObject ret = new JSObject();
            ret.put("versionName", info.versionName == null ? "" : info.versionName);
            ret.put("versionCode", info.getLongVersionCode());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "version unavailable" : e.getMessage());
        }
    }
}
