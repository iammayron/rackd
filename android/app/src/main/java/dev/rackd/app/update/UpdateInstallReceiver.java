package dev.rackd.app.update;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;
import android.widget.Toast;

/** The system installer reports back here, including the confirm step. */
public class UpdateInstallReceiver extends BroadcastReceiver {
    static final String ACTION = "dev.rackd.app.INSTALL_STATUS";

    @Override
    public void onReceive(Context context, Intent intent) {
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm = confirmIntent(intent);
            if (confirm == null) return;
            confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(confirm);
            return;
        }
        if (status != PackageInstaller.STATUS_SUCCESS) {
            Toast.makeText(context, "Update failed", Toast.LENGTH_SHORT).show();
        }
    }

    private static Intent confirmIntent(Intent intent) {
        if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
        return intent.getParcelableExtra(Intent.EXTRA_INTENT);
    }
}
