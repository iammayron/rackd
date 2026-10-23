package dev.rackd.wear;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import androidx.core.app.NotificationCompat;
import androidx.wear.ongoing.OngoingActivity;
import androidx.wear.widget.BoxInsetLayout;
import com.google.android.gms.wearable.CapabilityClient;
import com.google.android.gms.wearable.CapabilityInfo;
import com.google.android.gms.wearable.DataClient;
import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.Wearable;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Glance screen for the set in progress. The phone owns the workout.
 * Rest shows only the timer. Otherwise: weight, reps, and the exercise.
 * A live session posts an ongoing activity. The display sleeps when you
 * look away, and the workout stays one tap from the watch face.
 */
public class MainActivity extends Activity
    implements DataClient.OnDataChangedListener, CapabilityClient.OnCapabilityChangedListener {
    private static final int CORAL = 0xFFFF5A3C;
    private static final int INK = 0xFF0E1116;
    private static final double KG_PER_LB = 0.45359237;
    private static final String PHONE_CAPABILITY = "rackd_phone";
    private static final String ACTION_PATH = "/rackd/action";
    private static final String CHANNEL = "rackd_workout";
    private static final int NOTE_ID = 7;
    private static final int NOTE_PERMISSION = 41;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private LinearLayout col;
    private TextView status;
    private TextView name;
    private TextView setLine;
    private TextView weight;
    private TextView reps;
    private TextView countdown;
    private LinearLayout nameRow;
    private LinearLayout weightRow;
    private LinearLayout repsRow;
    private LinearLayout timerRow;
    private Button log;
    private Button skip;
    private Button add;
    private Button prev;
    private Button next;
    private JSONObject snapshot;
    private String focusName;
    private String shownSession = "";
    private long buzzedForEndAt = -1;
    private boolean wasResting = false;
    private boolean presenceOn = false;
    private boolean askedNotification = false;
    private String presenceLabel = "";
    private String phoneNodeId;
    private boolean phoneUnreachable;
    /** Set the watch just asked the phone to log. Advance once that set comes back completed. */
    private String pendingAdvanceSet;
    private String pendingAdvanceExercise;
    private Button updateButton;
    private WearUpdate.Offer pendingUpdate;
    private boolean updating;
    private boolean updateFailed;

    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            render();
            handler.postDelayed(this, 200);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(INK);

        BoxInsetLayout box = new BoxInsetLayout(this);
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER);
        int pad = dp(2);
        col.setPadding(pad, pad, pad, pad);

        status = label(11, false, 0xFFB7B0AC);
        name = label(15, true, Color.WHITE);
        name.setMaxLines(2);
        name.setEllipsize(TextUtils.TruncateAt.END);
        setLine = label(12, false, 0xFFB7B0AC);
        weight = label(18, true, Color.WHITE);
        reps = label(18, true, Color.WHITE);
        countdown = label(48, true, CORAL);

        prev = stepButton("‹");
        next = stepButton("›");
        Button weightMinus = stepButton("−");
        Button weightPlus = stepButton("+");
        Button repsMinus = stepButton("−");
        Button repsPlus = stepButton("+");
        weightMinus.setOnClickListener(v -> stepWeight(-1));
        weightPlus.setOnClickListener(v -> stepWeight(1));
        repsMinus.setOnClickListener(v -> stepReps(-1));
        repsPlus.setOnClickListener(v -> stepReps(1));
        prev.setOnClickListener(v -> move(-1));
        next.setOnClickListener(v -> move(1));

        nameRow = new LinearLayout(this);
        nameRow.setOrientation(LinearLayout.HORIZONTAL);
        nameRow.setGravity(Gravity.CENTER_VERTICAL);
        nameRow.addView(prev, sideParams());
        nameRow.addView(name, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        nameRow.addView(next, sideParams());

        weightRow = stepperRow(weightMinus, weight, weightPlus);
        repsRow = stepperRow(repsMinus, reps, repsPlus);

        log = button("Log set", true, 32);
        skip = button("Skip", false, 32);
        add = button("+30s", false, 32);
        log.setOnClickListener(v -> logFocused());
        skip.setOnClickListener(v -> send("skip"));
        add.setOnClickListener(v -> send("add30"));

        timerRow = new LinearLayout(this);
        timerRow.setOrientation(LinearLayout.HORIZONTAL);
        timerRow.setGravity(Gravity.CENTER);
        timerRow.addView(skip, rowParams());
        timerRow.addView(add, rowParams());

        col.addView(status);
        col.addView(nameRow);
        col.addView(setLine);
        col.addView(weightRow);
        col.addView(repsRow);
        col.addView(countdown);
        updateButton = button("Update", true, 32);
        updateButton.setVisibility(View.GONE);
        updateButton.setOnClickListener(v -> startUpdate());

        col.addView(log, fullWidth());
        col.addView(timerRow);
        col.addView(updateButton, fullWidth());

        BoxInsetLayout.LayoutParams lp = new BoxInsetLayout.LayoutParams(
            BoxInsetLayout.LayoutParams.MATCH_PARENT,
            BoxInsetLayout.LayoutParams.MATCH_PARENT
        );
        lp.boxedEdges = BoxInsetLayout.LayoutParams.BOX_ALL;
        scroll.addView(col, new ScrollView.LayoutParams(
            ScrollView.LayoutParams.MATCH_PARENT,
            ScrollView.LayoutParams.WRAP_CONTENT
        ));
        box.addView(scroll, lp);
        setContentView(box);
        showIdle();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Wearable.getDataClient(this).addListener(this);
        Wearable.getCapabilityClient(this).addListener(this, PHONE_CAPABILITY);
        loadSnapshot();
        warmPhoneNode();
        WearUpdater.check(this, offer -> runOnUiThread(() -> {
            pendingUpdate = offer;
            if (offer != null) updateFailed = false;
            showUpdateOffer();
        }));
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        Wearable.getDataClient(this).removeListener(this);
        Wearable.getCapabilityClient(this).removeListener(this, PHONE_CAPABILITY);
        super.onPause();
    }

    @Override
    public void onDataChanged(DataEventBuffer events) {
        try {
        for (DataEvent event : events) {
            String path = event.getDataItem().getUri().getPath();
            if (path == null || !path.equals("/rackd/workout")) continue;
            if (event.getType() == DataEvent.TYPE_DELETED) {
                runOnUiThread(() -> {
                    snapshot = null;
                    showIdle();
                });
            } else if (event.getType() == DataEvent.TYPE_CHANGED) {
                DataMapItem item = DataMapItem.fromDataItem(event.getDataItem());
                String json = item.getDataMap().getString("json");
                runOnUiThread(() -> apply(json));
            }
        }
        } finally {
            events.release();
        }
    }

    private void loadSnapshot() {
        Wearable.getDataClient(this)
            .getDataItems()
            .addOnSuccessListener(buffer -> {
                String json = null;
                long ts = -1;
                for (int i = 0; i < buffer.getCount(); i++) {
                    if (!"/rackd/workout".equals(buffer.get(i).getUri().getPath())) continue;
                    DataMapItem item = DataMapItem.fromDataItem(buffer.get(i));
                    long itemTs = item.getDataMap().getLong("ts");
                    if (itemTs >= ts) {
                        ts = itemTs;
                        json = item.getDataMap().getString("json");
                    }
                }
                buffer.release();
                String found = json;
                runOnUiThread(() -> {
                    if (found == null) showIdle();
                    else apply(found);
                });
            });
    }

    private void apply(String json) {
        try {
            snapshot = new JSONObject(json);
            String session = snapshot.optString("sessionId", "");
            if (!session.equals(shownSession)) {
                shownSession = session;
                focusName = null;
                pendingAdvanceSet = null;
            }
            if (pendingAdvanceSet != null && setCompleted(snapshot.optJSONArray("items"), pendingAdvanceSet)) {
                focusName = ExerciseFocus.nextOpen(rows(snapshot.optJSONArray("items")), pendingAdvanceExercise);
                pendingAdvanceSet = null;
            }
            render();
        } catch (Exception e) {
            showIdle();
        }
    }

    private void render() {
        try {
        if (snapshot == null) {
            showIdle();
            return;
        }
        JSONArray items = snapshot.optJSONArray("items");
        JSONObject open = null;
        int total = items == null ? 0 : items.length();
        int done = 0;
        if (items != null) {
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                if (item.optBoolean("completed")) done++;
                else if (open == null) open = item;
            }
        }
        long restEndAt = snapshot.optLong("restEndAt", 0);
        long remaining = restEndAt - System.currentTimeMillis();
        boolean resting = remaining > 0;
        String error = snapshot.optString("error", "");

        if (wasResting && !resting && restEndAt > 0 && buzzedForEndAt != restEndAt) {
            buzzedForEndAt = restEndAt;
            buzz();
        }
        wasResting = resting;

        if (total == 0) {
            showMessage("Rackd", "Workout in progress", "");
            return;
        }
        if (open == null) {
            showMessage(error.isEmpty() ? "Done" : error, "Finish on your phone", done + " sets");
            return;
        }

        JSONObject shown = setOnScreen(items);
        if (shown == null) shown = open;
        List<String> names = exerciseNames(items);
        boolean several = names.size() > 1;

        if (resting) {
            showStatus(error);
            nameRow.setVisibility(View.GONE);
            setLine.setVisibility(View.GONE);
            weightRow.setVisibility(View.GONE);
            repsRow.setVisibility(View.GONE);
            log.setVisibility(View.GONE);
            countdown.setVisibility(View.VISIBLE);
            countdown.setText(format(remaining));
            timerRow.setVisibility(View.VISIBLE);
            return;
        }

        showStatus(error);
        nameRow.setVisibility(View.VISIBLE);
        name.setVisibility(View.VISIBLE);
        setLine.setVisibility(View.VISIBLE);
        weightRow.setVisibility(View.VISIBLE);
        repsRow.setVisibility(View.VISIBLE);
        countdown.setVisibility(View.GONE);
        timerRow.setVisibility(View.GONE);
        prev.setVisibility(several ? View.VISIBLE : View.GONE);
        next.setVisibility(several ? View.VISIBLE : View.GONE);
        name.setText(shown.optString("name", "Exercise"));
        setLine.setText("Set " + shown.optInt("index") + " of " + shown.optInt("count"));
        weight.setText(shown.optString("weightLabel", ""));
        reps.setText(String.valueOf(shown.optInt("reps")));
        boolean logged = shown.optBoolean("completed");
        log.setVisibility(logged ? View.GONE : View.VISIBLE);
        log.setText("Log set");
        int index = names.indexOf(shown.optString("name"));
        prev.setEnabled(index > 0);
        next.setEnabled(index >= 0 && index < names.size() - 1);
        } finally {
            syncPresence();
            showUpdateOffer();
        }
    }

    private void showIdle() {
        snapshot = null;
        focusName = null;
        shownSession = "";
        showMessage("Rackd", "Start a workout on your phone", "");
        if (updateFailed) {
            status.setVisibility(View.VISIBLE);
            status.setText("Update failed");
        }
        syncPresence();
        showUpdateOffer();
    }

    private void showUpdateOffer() {
        if (updateButton == null) return;
        boolean show = snapshot == null && pendingUpdate != null;
        updateButton.setVisibility(show ? View.VISIBLE : View.GONE);
        if (!show) return;
        String name = pendingUpdate.versionName == null || pendingUpdate.versionName.isEmpty()
            ? ""
            : " " + pendingUpdate.versionName;
        updateButton.setText(updating ? "Downloading…" : "Update" + name);
        updateButton.setEnabled(!updating);
    }

    private void startUpdate() {
        if (pendingUpdate == null || updating) return;
        updateFailed = false;
        if (!WearUpdater.canInstall(this)) {
            WearUpdater.requestInstallPermission(this);
            return;
        }
        updating = true;
        showUpdateOffer();
        String apkUrl = pendingUpdate.apkUrl;
        new Thread(() -> {
            try {
                WearUpdater.install(this, apkUrl);
                runOnUiThread(() -> {
                    updating = false;
                    showUpdateOffer();
                });
            } catch (Exception e) {
                runOnUiThread(() -> {
                    updating = false;
                    updateFailed = true;
                    if (snapshot == null) showIdle();
                    else showUpdateOffer();
                });
            }
        }, "rackd-install").start();
    }

    /** Ongoing activity keeps the workout reachable after the display sleeps. */
    private void syncPresence() {
        boolean active = snapshot != null;
        if (!active) {
            if (!presenceOn) return;
            presenceOn = false;
            presenceLabel = "";
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.cancel(NOTE_ID);
            return;
        }
        String label = presenceText();
        if (presenceOn && label.equals(presenceLabel)) return;
        if (!canNotify()) return;
        postOngoing(label);
        presenceOn = true;
        presenceLabel = label;
    }

    private String presenceText() {
        if (snapshot == null) return "Workout";
        long remaining = snapshot.optLong("restEndAt", 0) - System.currentTimeMillis();
        if (remaining > 0) return "Rest";
        JSONObject shown = setOnScreen(snapshot.optJSONArray("items"));
        if (shown == null) return "Workout";
        String name = shown.optString("name", "Workout");
        return name.isEmpty() ? "Workout" : name;
    }

    private boolean canNotify() {
        if (Build.VERSION.SDK_INT < 33) return true;
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) {
            return true;
        }
        if (!askedNotification) {
            askedNotification = true;
            requestPermissions(new String[] {Manifest.permission.POST_NOTIFICATIONS}, NOTE_PERMISSION);
        }
        return false;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == NOTE_PERMISSION) syncPresence();
    }

    private void postOngoing(String label) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;
        if (manager.getNotificationChannel(CHANNEL) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Workout", NotificationManager.IMPORTANCE_LOW);
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        PendingIntent open = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_status)
            .setContentTitle("Rackd")
            .setContentText(label)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setContentIntent(open);
        OngoingActivity ongoing = new OngoingActivity.Builder(this, NOTE_ID, builder)
            .setStaticIcon(Icon.createWithResource(this, R.drawable.ic_status))
            .setTouchIntent(open)
            .build();
        ongoing.apply(this);
        Notification notification = builder.build();
        manager.notify(NOTE_ID, notification);
    }

    /** Snapshot errors stay visible. A failed phone lookup does too; the tick must not clear it. */
    private void showStatus(String snapshotError) {
        String text = phoneUnreachable ? "Phone not reachable" : snapshotError;
        boolean show = text != null && !text.isEmpty();
        status.setVisibility(show ? View.VISIBLE : View.GONE);
        if (show) status.setText(text);
    }

    private void showMessage(String title, String body, String detail) {
        status.setVisibility(View.VISIBLE);
        status.setText(title);
        nameRow.setVisibility(View.VISIBLE);
        prev.setVisibility(View.GONE);
        next.setVisibility(View.GONE);
        name.setVisibility(View.VISIBLE);
        name.setText(body);
        setLine.setVisibility(detail.isEmpty() ? View.GONE : View.VISIBLE);
        setLine.setText(detail);
        weightRow.setVisibility(View.GONE);
        repsRow.setVisibility(View.GONE);
        countdown.setVisibility(View.GONE);
        log.setVisibility(View.GONE);
        timerRow.setVisibility(View.GONE);
    }

    private void logFocused() {
        JSONArray items = snapshot == null ? null : snapshot.optJSONArray("items");
        JSONObject shown = setOnScreen(items);
        if (shown == null || shown.optBoolean("completed")) return;
        pendingAdvanceSet = shown.optString("setId");
        pendingAdvanceExercise = shown.optString("name", focusName);
        send("log:" + pendingAdvanceSet);
    }

    private static boolean setCompleted(JSONArray items, String setId) {
        if (items == null || setId == null) return false;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item != null && setId.equals(item.optString("setId")) && item.optBoolean("completed")) return true;
        }
        return false;
    }

    private static List<ExerciseFocus.Row> rows(JSONArray items) {
        List<ExerciseFocus.Row> rows = new ArrayList<>();
        if (items == null) return rows;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            rows.add(new ExerciseFocus.Row(item.optString("name", "Exercise"), item.optBoolean("completed")));
        }
        return rows;
    }

    private void stepWeight(int dir) {
        JSONObject shown = setOnScreen(snapshot == null ? null : snapshot.optJSONArray("items"));
        if (shown == null) return;
        String unit = snapshot.optString("unit", "kg");
        boolean lb = "lb".equals(unit);
        int stepTenths = lb ? 50 : 25;
        double kg = shown.optDouble("weight", 0);
        double display = lb ? kg / KG_PER_LB : kg;
        int tenths = (int) Math.round(display * 10.0);
        int nextTenths = Math.max(0, tenths + dir * stepTenths);
        if (nextTenths == tenths) return;
        double nextDisplay = nextTenths / 10.0;
        double nextKg = lb ? nextDisplay * KG_PER_LB : nextDisplay;
        try {
            shown.put("weight", nextKg);
            shown.put("weightLabel", weightLabel(nextKg, unit));
        } catch (Exception ignored) {
            return;
        }
        render();
        send("w:" + shown.optString("setId") + ":" + String.format(Locale.US, "%.4f", nextKg));
    }

    private void stepReps(int dir) {
        JSONObject shown = setOnScreen(snapshot == null ? null : snapshot.optJSONArray("items"));
        if (shown == null) return;
        int nextReps = Math.max(1, Math.min(99, shown.optInt("reps") + dir));
        if (nextReps == shown.optInt("reps")) return;
        try {
            shown.put("reps", nextReps);
        } catch (Exception ignored) {
            return;
        }
        render();
        send("r:" + shown.optString("setId") + ":" + nextReps);
    }

    private void move(int dir) {
        JSONArray items = snapshot == null ? null : snapshot.optJSONArray("items");
        List<String> names = exerciseNames(items);
        if (focusName == null) setOnScreen(items);
        int index = names.indexOf(focusName);
        int target = index + dir;
        if (target < 0 || target >= names.size()) return;
        focusName = names.get(target);
        render();
    }

    private JSONObject setOnScreen(JSONArray items) {
        List<String> names = exerciseNames(items);
        if (names.isEmpty()) return null;
        if (focusName == null || !names.contains(focusName)) {
            JSONObject open = null;
            if (items != null) {
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item != null && !item.optBoolean("completed")) {
                        open = item;
                        break;
                    }
                }
            }
            focusName = open != null ? open.optString("name") : names.get(0);
        }
        JSONObject open = null;
        JSONObject last = null;
        for (int i = 0; items != null && i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null || !focusName.equals(item.optString("name"))) continue;
            last = item;
            if (open == null && !item.optBoolean("completed")) open = item;
        }
        return open != null ? open : last;
    }

    private static List<String> exerciseNames(JSONArray items) {
        List<String> names = new ArrayList<>();
        if (items == null) return names;
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            String name = item.optString("name", "Exercise");
            if (names.isEmpty() || !names.get(names.size() - 1).equals(name)) names.add(name);
        }
        return names;
    }

    private void send(String action) {
        log.setEnabled(false);
        String cached = phoneNodeId;
        if (cached != null) post(cached, action, true);
        else lookupPhone(id -> deliverFound(id, action));
    }

    /**
     * Capability sync can stay empty on Wear OS 6 while the phone is connected.
     * The phone app still logs sets on its own; the watch has to use the
     * connected node or the tap never reaches it.
     */
    private void lookupPhone(NodeCallback callback) {
        Wearable.getCapabilityClient(this)
            .getCapability(PHONE_CAPABILITY, CapabilityClient.FILTER_ALL)
            .addOnCompleteListener(capTask -> {
                List<PhoneNode.Candidate> capable = new ArrayList<>();
                if (capTask.isSuccessful() && capTask.getResult() != null) {
                    capable = candidates(capTask.getResult().getNodes());
                }
                List<PhoneNode.Candidate> capableNodes = capable;
                if (PhoneNode.hasNearby(capableNodes)) {
                    callback.onNode(PhoneNode.pick(capableNodes, null));
                    return;
                }
                Wearable.getNodeClient(this)
                    .getConnectedNodes()
                    .addOnCompleteListener(nodeTask -> {
                        List<PhoneNode.Candidate> connected = new ArrayList<>();
                        if (nodeTask.isSuccessful() && nodeTask.getResult() != null) {
                            connected = candidates(nodeTask.getResult());
                        }
                        callback.onNode(PhoneNode.pick(capableNodes, connected));
                    });
            });
    }

    private void deliverFound(String id, String action) {
        runOnUiThread(() -> {
            if (id == null) {
                markUnreachable();
                return;
            }
            phoneNodeId = id;
            post(id, action, false);
        });
    }

    private void post(String nodeId, String action, boolean retry) {
        Wearable.getMessageClient(this)
            .sendMessage(nodeId, ACTION_PATH, action.getBytes(StandardCharsets.UTF_8))
            .addOnCompleteListener(task -> runOnUiThread(() -> {
                if (task.isSuccessful()) {
                    phoneUnreachable = false;
                    log.setEnabled(true);
                    render();
                    return;
                }
                if (nodeId.equals(phoneNodeId)) phoneNodeId = null;
                if (retry) lookupPhone(id -> deliverFound(id, action));
                else markUnreachable();
            }));
    }

    private void markUnreachable() {
        runOnUiThread(() -> {
            phoneUnreachable = true;
            log.setEnabled(true);
            render();
        });
    }

    private void warmPhoneNode() {
        lookupPhone(id -> {
            if (id == null) return;
            runOnUiThread(() -> {
                if (phoneNodeId == null) phoneNodeId = id;
            });
        });
    }

    @Override
    public void onCapabilityChanged(CapabilityInfo capabilityInfo) {
        if (capabilityInfo == null) return;
        String id = PhoneNode.pick(candidates(capabilityInfo.getNodes()), null);
        if (id == null) return;
        runOnUiThread(() -> phoneNodeId = id);
    }

    private static List<PhoneNode.Candidate> candidates(Iterable<Node> nodes) {
        List<PhoneNode.Candidate> list = new ArrayList<>();
        if (nodes == null) return list;
        for (Node node : nodes) {
            if (node == null) continue;
            list.add(new PhoneNode.Candidate(node.getId(), node.isNearby()));
        }
        return list;
    }

    private interface NodeCallback {
        void onNode(String id);
    }

    private void buzz() {
        VibrationEffect effect = VibrationEffect.createWaveform(new long[] {0, 400, 150, 400, 150, 600}, -1);
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager manager = (VibratorManager) getSystemService(VIBRATOR_MANAGER_SERVICE);
            if (manager != null) manager.getDefaultVibrator().vibrate(effect);
        } else {
            Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator != null) vibrator.vibrate(effect);
        }
    }

    private static String format(long ms) {
        int total = (int) Math.ceil(ms / 1000.0);
        int mins = total / 60;
        int secs = total % 60;
        return mins + ":" + (secs < 10 ? "0" : "") + secs;
    }

    /** Same rounding as the phone bridge: 1 decimal, drop a trailing .0. */
    private static String weightLabel(double kg, String unit) {
        boolean lb = "lb".equals(unit);
        double display = lb ? kg / KG_PER_LB : kg;
        double rounded = Math.round(display * 10.0) / 10.0;
        String text = Math.abs(rounded - Math.rint(rounded)) < 0.001
            ? String.valueOf((long) Math.rint(rounded))
            : String.format(Locale.US, "%.1f", rounded);
        return text + (lb ? " lb" : " kg");
    }

    private TextView label(int sp, boolean bold, int color) {
        TextView view = new TextView(this);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, 0, 0, 0);
        return view;
    }

    private Button button(String text, boolean filled, int minDp) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        button.setTextColor(filled ? Color.WHITE : CORAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(18));
        if (filled) bg.setColor(CORAL);
        else {
            bg.setColor(Color.TRANSPARENT);
            bg.setStroke(dp(1), CORAL);
        }
        button.setBackground(bg);
        button.setMinHeight(dp(minDp));
        button.setMinimumHeight(dp(minDp));
        button.setPadding(dp(6), 0, dp(6), 0);
        return button;
    }

    private Button stepButton(String text) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        button.setTextColor(CORAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(16));
        bg.setColor(0xFF1C2128);
        button.setBackground(bg);
        button.setMinWidth(dp(36));
        button.setMinimumWidth(dp(36));
        button.setMinHeight(dp(32));
        button.setMinimumHeight(dp(32));
        button.setPadding(0, 0, 0, 0);
        return button;
    }

    private LinearLayout stepperRow(Button minus, TextView value, Button plus) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams side = sideParams();
        LinearLayout.LayoutParams mid = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        row.addView(minus, side);
        row.addView(value, mid);
        row.addView(plus, side);
        return row;
    }

    private LinearLayout.LayoutParams fullWidth() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.topMargin = dp(4);
        return lp;
    }

    private LinearLayout.LayoutParams rowParams() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(3);
        lp.rightMargin = dp(3);
        lp.topMargin = dp(4);
        return lp;
    }

    private LinearLayout.LayoutParams sideParams() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(dp(36), dp(32));
        lp.leftMargin = dp(2);
        lp.rightMargin = dp(2);
        return lp;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
