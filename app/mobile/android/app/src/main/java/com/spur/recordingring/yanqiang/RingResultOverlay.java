package com.spur.recordingring.yanqiang;

import android.animation.ArgbEvaluator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.AccelerateInterpolator;
import android.view.animation.OvershootInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;

/** A brief, non-interactive confirmation above other apps. */
final class RingResultOverlay {
  private static final String TAG = "RingResultOverlay";
  private static final Handler MAIN = new Handler(Looper.getMainLooper());
  private static FrameLayout active;
  private static WindowManager activeManager;
  private static ValueAnimator collapseAnimator;
  private static Runnable scheduledCollapse;

  private RingResultOverlay() {}

  static boolean canShow(@NonNull Context context) {
    return RingDictationAccessibilityService.getActiveService() != null ||
        Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context);
  }

  static boolean show(@NonNull Context context, @NonNull String kind) {
    return showForDuration(context, kind, 1700L);
  }

  /** Used by the debug emulator probe so WindowManager can be inspected. */
  static boolean showForTest(@NonNull Context context, @NonNull String kind) {
    return showForDuration(context, kind, 10_000L);
  }

  private static boolean showForDuration(
      @NonNull Context context, @NonNull String kind, long collapseDelayMs) {
    if (!canShow(context) || (!"note".equals(kind) && !"process".equals(kind) &&
        !"capture".equals(kind) && !"command".equals(kind))) return false;
    RingDictationAccessibilityService service = RingDictationAccessibilityService.getActiveService();
    Context windowContext = service != null ? service : context.getApplicationContext();
    int type = service != null ? WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY :
        Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
            WindowManager.LayoutParams.TYPE_PHONE;
    MAIN.post(() -> showOnMain(windowContext, kind, type, collapseDelayMs));
    return true;
  }

  private static void showOnMain(Context context, String kind, int type, long collapseDelayMs) {
    clear();
    boolean note = "note".equals(kind);
    int accent = note ? 0xFF36BD80 : 0xFFE85D9E;
    String title = note ? "Note captured" : "Process started";
    WindowManager manager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
    if (manager == null) return;

    FrameLayout root = new FrameLayout(context);
    root.setClipChildren(false);
    root.setClipToPadding(false);

    FrameLayout card = new FrameLayout(context);
    card.setClipChildren(true);
    GradientDrawable cardBackground = new GradientDrawable();
    cardBackground.setColor(0xF21C2225);
    cardBackground.setCornerRadius(dp(context, 28));
    cardBackground.setStroke(dp(context, 1), accent);
    card.setBackground(cardBackground);
    FrameLayout.LayoutParams cardParams = new FrameLayout.LayoutParams(
        dp(context, 280), dp(context, 56), Gravity.TOP | Gravity.CENTER_HORIZONTAL);
    cardParams.topMargin = dp(context, 6);
    root.addView(card, cardParams);

    TextView ball = new TextView(context);
    ball.setText(note ? "✓" : "↗");
    ball.setTextColor(Color.WHITE);
    ball.setTextSize(19);
    ball.setGravity(Gravity.CENTER);
    GradientDrawable ballBackground = new GradientDrawable();
    ballBackground.setColor(accent);
    ballBackground.setCornerRadius(dp(context, 18));
    ball.setBackground(ballBackground);
    FrameLayout.LayoutParams ballParams = new FrameLayout.LayoutParams(
        dp(context, 32), dp(context, 32), Gravity.START | Gravity.CENTER_VERTICAL);
    ballParams.leftMargin = dp(context, 12);
    card.addView(ball, ballParams);

    TextView label = new TextView(context);
    label.setText(title);
    label.setTextColor(Color.WHITE);
    label.setTextSize(15);
    label.setTypeface(null, 1);
    label.setSingleLine(true);
    FrameLayout.LayoutParams labelParams = new FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.START | Gravity.CENTER_VERTICAL);
    labelParams.leftMargin = dp(context, 58);
    card.addView(label, labelParams);

    WindowManager.LayoutParams windowParams = new WindowManager.LayoutParams(
        dp(context, 300), dp(context, 68), type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
        PixelFormat.TRANSLUCENT);
    windowParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
    windowParams.y = dp(context, 12);
    try {
      manager.addView(root, windowParams);
    } catch (RuntimeException error) {
      Log.w(TAG, "unable to show floating confirmation", error);
      return;
    }
    active = root;
    activeManager = manager;

    root.setTranslationY(-dp(context, 100));
    root.setAlpha(0f);
    root.animate().translationY(0f).alpha(1f).setDuration(320)
        .setInterpolator(new OvershootInterpolator(0.7f)).start();

    scheduledCollapse = () -> {
      if (active != root) return;
      label.animate().alpha(0f).setDuration(120).start();
      int startWidth = dp(context, 280);
      int startHeight = dp(context, 56);
      int endSize = dp(context, 48);
      collapseAnimator = ValueAnimator.ofFloat(0f, 1f);
      collapseAnimator.setDuration(260);
      collapseAnimator.addUpdateListener(animation -> {
        float value = (float) animation.getAnimatedValue();
        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) card.getLayoutParams();
        params.width = Math.round(startWidth + (endSize - startWidth) * value);
        params.height = Math.round(startHeight + (endSize - startHeight) * value);
        card.setLayoutParams(params);
        cardBackground.setColor((int) new ArgbEvaluator().evaluate(
            value, 0xF21C2225, accent));
        ball.setAlpha(1f - value);
      });
      collapseAnimator.addListener(new android.animation.AnimatorListenerAdapter() {
        @Override public void onAnimationEnd(android.animation.Animator animation) {
          if (active != root) return;
          root.animate().translationY(-dp(context, 105)).scaleX(0.45f)
              .scaleY(0.45f).alpha(0f).setDuration(390)
              .setInterpolator(new AccelerateInterpolator(1.4f))
              .withEndAction(() -> { if (active == root) clear(); }).start();
        }
      });
      collapseAnimator.start();
    };
    MAIN.postDelayed(scheduledCollapse, collapseDelayMs);
  }

  private static void clear() {
    if (scheduledCollapse != null) MAIN.removeCallbacks(scheduledCollapse);
    scheduledCollapse = null;
    if (collapseAnimator != null) collapseAnimator.cancel();
    collapseAnimator = null;
    if (active != null) {
      active.animate().cancel();
      try { activeManager.removeView(active); }
      catch (RuntimeException error) { Log.w(TAG, "unable to remove confirmation", error); }
    }
    active = null;
    activeManager = null;
  }

  private static int dp(Context context, int value) {
    return Math.round(value * context.getResources().getDisplayMetrics().density);
  }
}
