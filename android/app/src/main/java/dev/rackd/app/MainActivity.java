package dev.rackd.app;

import android.app.AlertDialog;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.ProgressDialog;
import android.content.pm.PackageInstaller;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import dev.rackd.app.bridge.RackdAppPlugin;
import dev.rackd.app.bridge.RackdSharePlugin;
import dev.rackd.app.bridge.RackdWearPlugin;
import dev.rackd.app.bridge.WearBridge;
import dev.rackd.app.update.AppUpdate;
import dev.rackd.app.update.AppUpdater;
import dev.rackd.app.update.UpdateInstallReceiver;

public class MainActivity extends BridgeActivity implements UpdateInstallReceiver.Listener {
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean resumed;
    private boolean updating;
    private boolean awaitingInstallPermission;
    private AppUpdate.Offer pendingOffer;
    private AlertDialog updateDialog;
    private ProgressDialog progressDialog;

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
        registerPlugin(RackdAppPlugin.class);
        super.onCreate(savedInstanceState);
        WearBridge.advertise(this);
        createNotificationChannels();
    }

    @Override
    public void onResume() {
        super.onResume();
        resumed = true;
        UpdateInstallReceiver.setListener(this);
        handler.removeCallbacks(updateTick);
        handler.post(updateTick);
        if (awaitingInstallPermission) {
            if (AppUpdater.canInstall(this)) {
                awaitingInstallPermission = false;
                startUpdate();
                return;
            }
            showPermissionHint();
            return;
        }
        presentUpdate();
    }

    @Override
    public void onPause() {
        resumed = false;
        handler.removeCallbacks(updateTick);
        super.onPause();
    }

    @Override
    public void onDestroy() {
        UpdateInstallReceiver.setListener(null);
        dismissProgress();
        super.onDestroy();
    }

    @Override
    public void onInstallStatus(int status, String message) {
        runOnUiThread(() -> {
            if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
                showProgress("Confirm the update…", false);
                return;
            }
            updating = false;
            dismissProgress();
            if (status == PackageInstaller.STATUS_SUCCESS) {
                pendingOffer = null;
                return;
            }
            if (!isFinishing() && !isDestroyed()) {
                new AlertDialog.Builder(this)
                    .setTitle("Update failed")
                    .setMessage(message == null || message.isEmpty()
                        ? AppUpdate.failureMessage(status, null)
                        : message)
                    .setPositiveButton("OK", null)
                    .show();
            }
        });
    }

    private void presentUpdate() {
        AppUpdate.Offer offer = pendingOffer;
        if (offer == null || updating || awaitingInstallPermission || !resumed || isFinishing()) return;
        if (AppUpdater.isSnoozed(this, offer.versionCode)) return;
        if (updateDialog != null && updateDialog.isShowing()) return;
        String message = offer.versionName == null || offer.versionName.isEmpty()
            ? "A new version is ready."
            : "Version " + offer.versionName + " is ready.";
        updateDialog = new AlertDialog.Builder(this)
            .setTitle("Update Rackd")
            .setMessage(message)
            .setPositiveButton("Update", (dialog, which) -> startUpdate())
            .setNegativeButton("Later", (dialog, which) -> AppUpdater.snooze(this, offer.versionCode))
            .setCancelable(false)
            .create();
        updateDialog.show();
    }

    private void startUpdate() {
        AppUpdate.Offer offer = pendingOffer;
        if (offer == null || updating) return;
        if (!AppUpdater.canInstall(this)) {
            awaitingInstallPermission = true;
            showPermissionHint();
            AppUpdater.requestInstallPermission(this);
            return;
        }
        updating = true;
        if (updateDialog != null && updateDialog.isShowing()) updateDialog.dismiss();
        showProgress("Downloading update…", true);
        String apkUrl = offer.apkUrl;
        new Thread(() -> {
            try {
                AppUpdater.install(MainActivity.this, apkUrl, (read, total) -> runOnUiThread(() -> {
                    if (progressDialog == null || !progressDialog.isShowing()) return;
                    if (total > 0) {
                        int pct = (int) Math.min(100, (read * 100) / total);
                        progressDialog.setProgress(pct);
                        progressDialog.setMessage("Downloading update… " + pct + "%");
                    }
                }));
                runOnUiThread(() -> showProgress("Waiting for installer…", false));
            } catch (Exception e) {
                runOnUiThread(() -> {
                    updating = false;
                    dismissProgress();
                    if (!isFinishing() && !isDestroyed()) {
                        new AlertDialog.Builder(MainActivity.this)
                            .setTitle("Update failed")
                            .setMessage(e.getMessage() == null || e.getMessage().isEmpty()
                                ? "Couldn’t download the update. Check your connection and try again."
                                : e.getMessage())
                            .setPositiveButton("OK", null)
                            .show();
                    }
                });
            }
        }, "rackd-install").start();
    }

    private void showPermissionHint() {
        Toast.makeText(
            this,
            "Allow installs from Rackd, then return here to finish the update.",
            Toast.LENGTH_LONG
        ).show();
    }

    @SuppressWarnings("deprecation")
    private void showProgress(String message, boolean determinate) {
        if (isFinishing() || isDestroyed()) return;
        int style = determinate ? ProgressDialog.STYLE_HORIZONTAL : ProgressDialog.STYLE_SPINNER;
        if (progressDialog != null && progressDialog.isShowing()) {
            // Style can't change on a live dialog — rebuild when switching determinate ↔ spinner.
            boolean same = (progressDialog.isIndeterminate() && !determinate)
                || (!progressDialog.isIndeterminate() && determinate);
            if (!same) {
                progressDialog.dismiss();
                progressDialog = null;
            }
        }
        if (progressDialog == null) {
            progressDialog = new ProgressDialog(this);
            progressDialog.setTitle("Updating Rackd");
            progressDialog.setCancelable(false);
            progressDialog.setCanceledOnTouchOutside(false);
            progressDialog.setProgressStyle(style);
            if (determinate) {
                progressDialog.setMax(100);
                progressDialog.setProgress(0);
            }
        }
        progressDialog.setIndeterminate(!determinate);
        progressDialog.setMessage(message);
        if (!progressDialog.isShowing()) progressDialog.show();
    }

    private void dismissProgress() {
        if (progressDialog != null && progressDialog.isShowing()) progressDialog.dismiss();
        progressDialog = null;
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
