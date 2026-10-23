package dev.rackd.wear;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.RectF;
import android.view.View;

/** Orange rest arc around the circular display, the same mark as the Rackd logo. */
final class RestRing extends View {
    private static final int TRACK = 0x33FF5A3C;
    private static final int ARC = 0xFFFF5A3C;

    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF oval = new RectF();
    private float fraction;

    RestRing(Context context) {
        super(context);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
    }

    void setFraction(float value) {
        float next = Math.max(0f, Math.min(1f, value));
        if (next == fraction && (next > 0f) == (getVisibility() == VISIBLE)) return;
        fraction = next;
        setVisibility(next > 0f ? VISIBLE : GONE);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float density = getResources().getDisplayMetrics().density;
        float stroke = 7f * density;
        paint.setStrokeWidth(stroke);
        float pad = stroke / 2f + density;
        oval.set(pad, pad, getWidth() - pad, getHeight() - pad);
        paint.setColor(TRACK);
        canvas.drawArc(oval, -90f, 360f, false, paint);
        paint.setColor(ARC);
        canvas.drawArc(oval, -90f, 360f * fraction, false, paint);
    }
}
