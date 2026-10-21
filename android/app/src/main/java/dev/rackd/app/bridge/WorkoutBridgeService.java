package dev.rackd.app.bridge;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import dev.rackd.app.MainActivity;

/**
 * Keeps the phone process up while a workout is on the watch. Samsung will
 * otherwise freeze the WebView and sometimes the wearable listener with it.
 */
public class WorkoutBridgeService extends Service {
    static final String CHANNEL = "rackd_watch";
    private static final int NOTE_ID = 41;

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL,
                "Watch workout",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shown while a workout is mirrored to your watch");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new NotificationCompat.Builder(this, CHANNEL)
            .setContentTitle("Rackd")
            .setContentText("Workout on your watch")
            .setSmallIcon(android.R.drawable.stat_notify_more)
            .setContentIntent(pending)
            .setOngoing(true)
            .build();
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(NOTE_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);
            } else {
                startForeground(NOTE_ID, notification);
            }
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
