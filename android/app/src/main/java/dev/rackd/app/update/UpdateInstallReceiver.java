package dev.rackd.app.update;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.widget.Toast;
import java.lang.ref.WeakReference;

/** The system installer reports back here, including the confirm step. */
public class UpdateInstallReceiver extends BroadcastReceiver {
    static final String ACTION = "dev.rackd.app.INSTALL_STATUS";

    public interface Listener {
        void onInstallStatus(int status, String message);
    }

    private static WeakReference<Listener> listener = new WeakReference<>(null);

    public static void setListener(Listener next) {
        listener = new WeakReference<>(next);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = confirmIntent(intent);
            if (confirm == null) return;
            confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(confirm);
            Listener active = listener.get();
            if (active != null) active.onInstallStatus(status, "");
            return;
        }
        String detail = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);
        String message = status == PackageInstaller.STATUS_SUCCESS
            ? ""
            : AppUpdate.failureMessage(status, detail);
        Listener active = listener.get();
        if (active != null) {
            active.onInstallStatus(status, message);
            return;
        }
        if (status != PackageInstaller.STATUS_SUCCESS && !message.isEmpty()) {
            Toast.makeText(context, message, Toast.LENGTH_LONG).show();
        }
    }

    private static Intent confirmIntent(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }
}
