package dev.rackd.wear;

import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.WearableListenerService;
import java.nio.charset.StandardCharsets;

/** Bluetooth workout messages from the phone, including while the screen is off. */
public class WorkoutListenerService extends WearableListenerService {
    @Override
    public void onMessageReceived(MessageEvent messageEvent) {
        if (messageEvent.getPath() == null || !"/rackd/workout".equals(messageEvent.getPath())) return;
        byte[] data = messageEvent.getData();
        if (data == null) return;
        MainActivity.onWorkoutMessage(this, new String(data, StandardCharsets.UTF_8));
    }
}
