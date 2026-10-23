package dev.rackd.app.bridge;

import android.app.Activity;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import android.util.Base64;

/** Saves and shares the workout card. The WebView cannot do either on its own. */
@CapacitorPlugin(name = "RackdShare")
public class RackdSharePlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) {
            call.reject("image required");
            return;
        }
        String text = call.getString("text", "");
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                File file = new File(getContext().getCacheDir(), "rackd-workout.png");
                try (FileOutputStream out = new FileOutputStream(file)) {
                    out.write(png);
                }
                Uri uri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                if (text != null && !text.isEmpty()) send.putExtra(Intent.EXTRA_TEXT, text);
                send.setClipData(ClipData.newRawUri("Rackd workout", uri));
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                Intent chooser = Intent.createChooser(send, "Share workout");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                activity.startActivity(chooser);
                call.resolve();
            } catch (Exception e) {
                call.reject("Couldn't share the image");
            }
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        byte[] png = decode(call);
        if (png == null) {
            call.reject("image required");
            return;
        }
        try {
            Uri uri = Build.VERSION.SDK_INT >= 29 ? saveToGallery(png) : saveLegacy(png);
            JSObject ret = new JSObject();
            ret.put("uri", uri == null ? "" : uri.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Couldn't save the image");
        }
    }

    private Uri saveToGallery(byte[] png) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "rackd-workout-" + System.currentTimeMillis() + ".png");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Rackd");
        values.put(MediaStore.Images.Media.IS_PENDING, 1);
        Uri uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new IllegalStateException("insert failed");
        try (OutputStream out = getContext().getContentResolver().openOutputStream(uri)) {
            if (out == null) throw new IllegalStateException("no stream");
            out.write(png);
        }
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        getContext().getContentResolver().update(uri, values, null, null);
        return uri;
    }

    private Uri saveLegacy(byte[] png) throws Exception {
        File dir = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
            "Rackd"
        );
        if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no pictures dir");
        File file = new File(dir, "rackd-workout-" + System.currentTimeMillis() + ".png");
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(png);
        }
        MediaScannerConnection.scanFile(
            getContext(),
            new String[] {file.getAbsolutePath()},
            new String[] {"image/png"},
            null
        );
        return Uri.fromFile(file);
    }

    private static byte[] decode(PluginCall call) {
        String raw = call.getString("base64", "");
        if (raw == null || raw.isEmpty()) return null;
        int comma = raw.indexOf(',');
        if (raw.startsWith("data:") && comma >= 0) raw = raw.substring(comma + 1);
        try {
            return Base64.decode(raw, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
