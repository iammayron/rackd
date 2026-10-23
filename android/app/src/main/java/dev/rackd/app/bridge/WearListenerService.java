package dev.rackd.app.bridge;

import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.WearableListenerService;
import java.nio.charset.StandardCharsets;

/** Watch taps arrive here even when the phone is locked. */
public class WearListenerService extends WearableListenerService {
    @Override
    public void onCreate() {
        super.onCreate();
        WearBridge.advertise(this);
    }

    @Override
    public void onMessageReceived(MessageEvent messageEvent) {
        if (messageEvent.getPath() == null || !messageEvent.getPath().equals("/rackd/action")) return;
        String action = new String(messageEvent.getData(), StandardCharsets.UTF_8);
        if ("log".equals(action)) WearBridge.logCurrentSet(this);
        else if (action.startsWith("log:")) WearBridge.logSet(this, action.substring(4));
        else if ("skip".equals(action)) WearBridge.skipRest(this);
        else if ("add30".equals(action)) WearBridge.addRest(this);
        else if (action.startsWith("w:") || action.startsWith("r:")) adjust(action);
    }

    /** `w:<setId>:<kg>` or `r:<setId>:<reps>`. */
    private void adjust(String action) {
        String[] parts = action.split(":", 3);
        if (parts.length < 3 || parts[1].isEmpty()) return;
        try {
            if ("w".equals(parts[0])) {
                WearBridge.adjust(this, parts[1], Double.parseDouble(parts[2]), null);
            } else {
                int reps = Integer.parseInt(parts[2]);
                if (reps < 1) reps = 1;
                if (reps > 99) reps = 99;
                WearBridge.adjust(this, parts[1], null, reps);
            }
        } catch (NumberFormatException ignored) {
        }
    }
}
