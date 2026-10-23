package dev.rackd.app;

import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import dev.rackd.app.bridge.RackdSharePlugin;
import dev.rackd.app.bridge.RackdWearPlugin;
import dev.rackd.app.bridge.WearBridge;
import dev.rackd.app.update.AppUpdate;
import dev.rackd.app.update.AppUpdater;

public class MainActivity extends BridgeActivity {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean resumed;
    private boolean updating;
    private AppUpdate.Offer pendingOffer;
    private AlertDialog updateDialog;

    private final Runnable updateTick = new Runnable() {
        @Override
        public void run() {
            if (isFinishing() || isDestroyed()) return;
            handler.postDelayed(this, AppUpdater.INTERVAL_MS);
            AppUpdater.check(MainActivity.this, offer -> runOnUiThread(() -> {
                if (isFinishing() || isDestroyed()) return;
                pendingOffer = offer;
                presentUpdate();
            }));
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RackdWearPlugin.class);
        registerPlugin(RackdSharePlugin.class);
        super.onCreate(savedInstanceState);
        WearBridge.advertise(this);
        createNotificationChannels();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumed = true;
        handler.removeCallbacks(updateTick);
        handler.post(updateTick);
        presentUpdate();
    }

    @Override
    public void onPause() {
        resumed = false;
        handler.removeCallbacks(updateTick);
        super.onPause();
    }

    private void presentUpdate() {
        AppUpdate.Offer offer = pendingOffer;
        if (offer == null || updating || !resumed || isFinishing()) return;
        if (updateDialog != null && updateDialog.isShowing()) return;
        String message = offer.versionName == null || offer.versionName.isEmpty()
            ? "A new version is ready."
            : "Version " + offer.versionName + " is ready.";
        updateDialog = new AlertDialog.Builder(this)
            .setTitle("Update Rackd")
            .setMessage(message)
            .setPositiveButton("Update", (dialog, which) -> startUpdate())
            .setNegativeButton("Later", null)
            .create();
        updateDialog.show();
    }

    private void startUpdate() {
        AppUpdate.Offer offer = pendingOffer;
        if (offer == null || updating) return;
        if (!AppUpdater.canInstall(this)) {
            AppUpdater.requestInstallPermission(this);
            return;
        }
        updating = true;
        String apkUrl = offer.apkUrl;
        new Thread(() -> {
            try {
                AppUpdater.install(MainActivity.this, apkUrl);
                runOnUiThread(() -> updating = false);
            } catch (Exception e) {
                runOnUiThread(() -> {
                    updating = false;
                    if (!isFinishing() && !isDestroyed()) {
                        Toast.makeText(MainActivity.this, "Update failed", Toast.LENGTH_SHORT).show();
                    }
                });
            }
        }, "rackd-install").start();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            String channelId = "rackd_rest_timer";
            CharSequence name = "Rest Timer Alerts";
            String description = "High priority sound and vibration when rest timer finishes";
            int importance = NotificationManager.IMPORTANCE_HIGH;

            NotificationChannel channel = new NotificationChannel(channelId, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 800});
            channel.enableLights(true);

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (defaultSoundUri == null) {
                defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build();
            channel.setSound(defaultSoundUri, audioAttributes);

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
