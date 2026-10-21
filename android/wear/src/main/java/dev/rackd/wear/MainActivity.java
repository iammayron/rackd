package dev.rackd.wear;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
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
 * Glance screen for the set in progress. The phone owns the workout; this
 * activity only shows the latest snapshot and sends log / skip / +30s.
 */
public class MainActivity extends Activity implements DataClient.OnDataChangedListener {
    private static final int CORAL = 0xFFFF5A3C;
    private static final int INK = 0xFF0E1116;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private TextView status;
    private TextView name;
    private TextView setLine;
    private TextView weight;
    private TextView reps;
    private TextView countdown;
    private Button log;
    private Button skip;
    private Button add;
    private JSONObject snapshot;
    private long buzzedForEndAt = -1;
    private boolean wasResting = false;

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
        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        int pad = dp(8);
        col.setPadding(pad, pad, pad, dp(16));

        status = label(13, false, 0xFFB7B0AC);
        name = label(18, true, Color.WHITE);
        setLine = label(13, false, 0xFFB7B0AC);
        weight = label(28, true, Color.WHITE);
        reps = label(16, false, Color.WHITE);
        countdown = label(32, true, CORAL);

        log = button("Log set", true);
        skip = button("Skip", false);
        add = button("+30s", false);
        log.setOnClickListener(v -> send("log"));
        skip.setOnClickListener(v -> send("skip"));
        add.setOnClickListener(v -> send("add30"));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        row.addView(skip, rowParams());
        row.addView(add, rowParams());

        col.addView(status);
        col.addView(name);
        col.addView(setLine);
        col.addView(weight);
        col.addView(reps);
        col.addView(countdown);
        col.addView(log, fullWidth());
        col.addView(row);
        scroll.addView(col);

        BoxInsetLayout.LayoutParams lp = new BoxInsetLayout.LayoutParams(
            BoxInsetLayout.LayoutParams.MATCH_PARENT,
            BoxInsetLayout.LayoutParams.MATCH_PARENT
        );
        lp.setBoxedEdges(BoxInsetLayout.LayoutParams.BOX_ALL);
        box.addView(scroll, lp);
        setContentView(box);
        showIdle();
    }

    @Override
    protected void onResume() {
        super.onResume();
        Wearable.getDataClient(this).addListener(this);
        loadSnapshot();
        handler.post(tick);
    }

    @Override
    protected void onPause() {
        handler.removeCallbacks(tick);
        Wearable.getDataClient(this).removeListener(this);
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
            render();
        } catch (Exception e) {
            showIdle();
        }
    }

    private void render() {
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
            status.setText("Rackd");
            name.setText("Workout in progress");
            setLine.setText("");
            weight.setText("");
            reps.setText("");
            countdown.setVisibility(View.GONE);
            log.setVisibility(View.GONE);
            skip.setVisibility(View.GONE);
            add.setVisibility(View.GONE);
            return;
        }
        if (open == null) {
            status.setText(error.isEmpty() ? "Done" : error);
            name.setText("All sets logged");
            setLine.setText(done + " sets");
            weight.setText("");
            reps.setText("");
            countdown.setVisibility(View.GONE);
            log.setVisibility(View.GONE);
            skip.setVisibility(View.GONE);
            add.setVisibility(View.GONE);
            return;
        }

        status.setText(!error.isEmpty() ? error : resting ? "Rest" : "Next set");
        name.setText(open.optString("name", "Exercise"));
        setLine.setText("Set " + open.optInt("index") + " of " + open.optInt("count"));
        weight.setText(open.optString("weightLabel", ""));
        int repCount = open.optInt("reps");
        reps.setText(repCount > 0 ? repCount + " reps" : "");
        if (resting) {
            countdown.setVisibility(View.VISIBLE);
            countdown.setText(format(remaining));
            log.setVisibility(View.GONE);
            skip.setVisibility(View.VISIBLE);
            add.setVisibility(View.VISIBLE);
        } else {
            countdown.setVisibility(View.GONE);
            log.setVisibility(View.VISIBLE);
            skip.setVisibility(View.GONE);
            add.setVisibility(View.GONE);
        }
    }

    private void showIdle() {
        snapshot = null;
        status.setText("Rackd");
        name.setText("Start a workout on your phone");
        setLine.setText("");
        weight.setText("");
        reps.setText("");
        countdown.setVisibility(View.GONE);
        log.setVisibility(View.GONE);
        skip.setVisibility(View.GONE);
        add.setVisibility(View.GONE);
    }

    private void send(String action) {
        log.setEnabled(false);
        Wearable.getCapabilityClient(this)
            .getCapability("rackd_phone", CapabilityClient.FILTER_REACHABLE)
            .addOnSuccessListener(info -> deliver(info, action))
            .addOnFailureListener(e -> runOnUiThread(() -> {
                status.setText("Phone not reachable");
                log.setEnabled(true);
            }));
    }

    private void deliver(CapabilityInfo info, String action) {
        Node node = null;
        for (Node candidate : info.getNodes()) {
            node = candidate;
            if (candidate.isNearby()) break;
        }
        if (node == null) {
            runOnUiThread(() -> {
                status.setText("Phone not reachable");
                log.setEnabled(true);
            });
            return;
        }
        Wearable.getMessageClient(this)
            .sendMessage(node.getId(), "/rackd/action", action.getBytes(StandardCharsets.UTF_8))
            .addOnCompleteListener(task -> runOnUiThread(() -> log.setEnabled(true)));
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

    private TextView label(int sp, boolean bold, int color) {
        TextView view = new TextView(this);
        view.setTextColor(color);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        view.setPadding(0, dp(2), 0, dp(2));
        return view;
    }

    private Button button(String text, boolean filled) {
        Button button = new Button(this);
        button.setText(text);
        button.setAllCaps(false);
        button.setTextColor(filled ? Color.WHITE : CORAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(20));
        if (filled) bg.setColor(CORAL);
        else {
            bg.setColor(Color.TRANSPARENT);
            bg.setStroke(dp(1), CORAL);
        }
        button.setBackground(bg);
        button.setMinHeight(dp(40));
        return button;
    }

    private LinearLayout.LayoutParams fullWidth() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        lp.topMargin = dp(8);
        return lp;
    }

    private LinearLayout.LayoutParams rowParams() {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        lp.leftMargin = dp(4);
        lp.rightMargin = dp(4);
        lp.topMargin = dp(8);
        return lp;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
