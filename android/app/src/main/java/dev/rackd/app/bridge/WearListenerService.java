package dev.rackd.app.bridge;

import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.WearableListenerService;
import java.nio.charset.StandardCharsets;

/** Watch taps arrive here even when the phone is locked. */
public class WearListenerService extends WearableListenerService {
    @Override
    public void onMessageReceived(MessageEvent messageEvent) {
        if (messageEvent.getPath() == null || !messageEvent.getPath().equals("/rackd/action")) return;
        String action = new String(messageEvent.getData(), StandardCharsets.UTF_8);
        if ("log".equals(action)) WearBridge.logCurrentSet(this);
        else if ("skip".equals(action)) WearBridge.skipRest(this);
        else if ("add30".equals(action)) WearBridge.addRest(this);
    }
}
