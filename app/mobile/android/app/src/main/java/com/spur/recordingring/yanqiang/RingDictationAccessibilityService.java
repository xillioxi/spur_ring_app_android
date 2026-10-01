package com.spur.recordingring.yanqiang;

import android.Manifest;
import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.util.Base64;
import android.view.Gravity;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import java.lang.ref.WeakReference;
import java.util.Arrays;
import java.util.List;

/** Push-to-talk dictation into the editable field that had focus when the ring was held. */
public final class RingDictationAccessibilityService extends AccessibilityService {
  private static final String TAG = "RingDictation";
  private static WeakReference<RingDictationAccessibilityService> activeService =
      new WeakReference<>(null);

  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private static final int DICTATION_SAMPLE_RATE = 16000;
  private static final long FINISH_TIMEOUT_MS = 12_000L;
  private AudioRecord audioRecord;
  private ElevenLabsRealtimeTranscriber transcriber;
  private Thread captureThread;
  private TextView overlay;
  private WindowManager windowManager;
  private AccessibilityNodeInfo dictationTarget;
  private volatile boolean listening;
  private volatile boolean cancelCapture;
  private boolean processing;
  private String lastPartialText = "";
  private final Runnable finishingTimeout = () -> {
    if (!processing) return;
    String fallback = lastPartialText == null ? "" : lastPartialText.trim();
    if (!fallback.isEmpty()) {
      commitRecognizedText(fallback);
    } else {
      failTranscription("Realtime transcription timed out");
    }
  };

  public static boolean isServiceEnabled(@NonNull Context context) {
    AccessibilityManager manager =
        (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
    if (manager == null || !manager.isEnabled()) return false;
    List<AccessibilityServiceInfo> services =
        manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
    String className = RingDictationAccessibilityService.class.getName();
    for (AccessibilityServiceInfo info : services) {
      if (info.getResolveInfo() != null && info.getResolveInfo().serviceInfo != null &&
          className.equals(info.getResolveInfo().serviceInfo.name)) return true;
    }
    return false;
  }

  public static boolean isListening() {
    RingDictationAccessibilityService service = activeService.get();
    return service != null && service.listening;
  }

  public static boolean startFromRing() {
    RingDictationAccessibilityService service = activeService.get();
    if (service == null) return false;
    service.mainHandler.post(service::startPushToTalk);
    return true;
  }

  public static boolean stopFromRing() {
    RingDictationAccessibilityService service = activeService.get();
    if (service == null) return false;
    service.mainHandler.post(service::finishPushToTalk);
    return true;
  }

  public static boolean completeFromSpur(@NonNull String text) {
    RingDictationAccessibilityService service = activeService.get();
    if (service == null) return false;
    service.mainHandler.post(() -> service.commitRecognizedText(text));
    return true;
  }

  public static boolean failFromSpur(@Nullable String message) {
    RingDictationAccessibilityService service = activeService.get();
    if (service == null) return false;
    service.mainHandler.post(() -> service.failTranscription(message));
    return true;
  }

  public static boolean updatePartialFromSpur(@Nullable String text) {
    RingDictationAccessibilityService service = activeService.get();
    if (service == null) return false;
    service.mainHandler.post(() -> {
      String value = text == null ? "" : text.trim();
      service.lastPartialText = value;
      service.showOverlay(value.isEmpty() ? "Listening… release to insert" : value);
    });
    return true;
  }

  @Override
  protected void onServiceConnected() {
    super.onServiceConnected();
    activeService = new WeakReference<>(this);
    windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
    Log.i(TAG, "Accessibility dictation service connected");
  }

  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event == null || listening) return;
    int type = event.getEventType();
    if (type != AccessibilityEvent.TYPE_VIEW_FOCUSED &&
        type != AccessibilityEvent.TYPE_VIEW_CLICKED &&
        type != AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED &&
        type != AccessibilityEvent.TYPE_VIEW_TEXT_SELECTION_CHANGED) return;
    AccessibilityNodeInfo source = event.getSource();
    if (source != null) rememberClosestTextTarget(source);
  }

  @Override public void onInterrupt() { cancelRecognition(); }

  @Override
  public void onDestroy() {
    cancelRecognition();
    clearTarget();
    hideOverlay();
    activeService = new WeakReference<>(null);
    super.onDestroy();
  }

  private void startPushToTalk() {
    if (listening || processing) return;
    mainHandler.removeCallbacks(finishingTimeout);
    lastPartialText = "";
    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      transientOverlay("Allow microphone access in Spur Ring", 2500L);
      return;
    }
    AccessibilityNodeInfo focused = validTarget(dictationTarget)
        ? AccessibilityNodeInfo.obtain(dictationTarget)
        : findFocusedEditable();
    if (focused == null) {
      transientOverlay("Place the cursor in a text field first", 2200L);
      return;
    }
    rememberTarget(focused);
    focused.recycle();

    String apiKey = getSharedPreferences("spur-ring-background-sync", MODE_PRIVATE)
        .getString("elevenlabs-api-key", "");
    if (apiKey == null || apiKey.trim().isEmpty()) {
      transientOverlay("Open Spur once to initialize transcription", 2500L);
      return;
    }

    try {
      cancelCapture = false;
      listening = true;
      transcriber = new ElevenLabsRealtimeTranscriber(
          new ElevenLabsRealtimeTranscriber.Listener() {
            @Override public void onPartial(@NonNull String text) {
              mainHandler.post(() -> {
                if (!listening && !processing) return;
                lastPartialText = text.trim();
                showOverlay(lastPartialText.isEmpty() ? "Listening… release to insert" : lastPartialText);
              });
            }

            @Override public void onFinal(@NonNull String text) {
              mainHandler.post(() -> commitRecognizedText(text));
            }

            @Override public void onError(@NonNull String message) {
              mainHandler.post(() -> failTranscription(message));
            }
          });
      transcriber.start(apiKey.trim());
      startRealtimeAudioCapture();
      showOverlay("Listening… release to insert");
    } catch (Throwable error) {
      listening = false;
      Log.e(TAG, "Unable to start Spur dictation capture", error);
      releaseAudioRecord();
      transientOverlay("Unable to start microphone", 2000L);
    }
  }

  private void finishPushToTalk() {
    if (!listening || audioRecord == null) return;
    listening = false;
    processing = true;
    showOverlay("Finishing transcription…");
    mainHandler.removeCallbacks(finishingTimeout);
    mainHandler.postDelayed(finishingTimeout, FINISH_TIMEOUT_MS);
    try { audioRecord.stop(); }
    catch (RuntimeException error) { Log.w(TAG, "Unable to stop realtime microphone", error); }
  }

  private void commitRecognizedText(@Nullable String value) {
    String text = value == null ? "" : value.trim();
    listening = false;
    processing = false;
    mainHandler.removeCallbacks(finishingTimeout);
    closeTranscriber();
    if (text.isEmpty()) {
      transientOverlay("No speech detected", 1200L);
      return;
    }
    boolean inserted = insertAtSelection(text);
    transientOverlay(inserted ? "Inserted" : "Select a text field and try again",
        inserted ? 700L : 1800L);
  }

  private void failTranscription(@Nullable String message) {
    listening = false;
    processing = false;
    mainHandler.removeCallbacks(finishingTimeout);
    closeTranscriber();
    String detail = message == null ? "" : message.trim();
    transientOverlay(detail.isEmpty() ? "Spur transcription failed" : detail, 2500L);
  }

  private void startRealtimeAudioCapture() {
    int minBuffer = AudioRecord.getMinBufferSize(
        DICTATION_SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT);
    if (minBuffer <= 0) throw new IllegalStateException("Microphone format unavailable");
    int bufferSize = Math.max(minBuffer, DICTATION_SAMPLE_RATE / 5);
    audioRecord = new AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        DICTATION_SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        bufferSize * 2);
    if (audioRecord.getState() != AudioRecord.STATE_INITIALIZED) {
      releaseAudioRecord();
      throw new IllegalStateException("Microphone initialization failed");
    }
    audioRecord.startRecording();
    captureThread = new Thread(() -> captureRealtimePcm(bufferSize), "SpurRealtimeDictation");
    captureThread.start();
  }

  private void captureRealtimePcm(int bufferSize) {
    byte[] buffer = new byte[bufferSize];
    try {
      while (listening && audioRecord != null) {
        int count = audioRecord.read(buffer, 0, buffer.length);
        if (count > 0) {
          String chunk = Base64.encodeToString(Arrays.copyOf(buffer, count), Base64.NO_WRAP);
          ElevenLabsRealtimeTranscriber current = transcriber;
          if (current == null) break;
          current.sendAudio(chunk);
        } else if (count < 0 && listening) {
          throw new IllegalStateException("Microphone read failed: " + count);
        }
      }
      if (!cancelCapture) {
        ElevenLabsRealtimeTranscriber current = transcriber;
        if (current != null) current.commit();
      }
    } catch (Throwable error) {
      Log.e(TAG, "Realtime dictation capture failed", error);
      if (!cancelCapture) {
        mainHandler.post(() -> failTranscription("Microphone capture failed"));
      }
    } finally {
      releaseAudioRecord();
      captureThread = null;
    }
  }

  private void releaseAudioRecord() {
    AudioRecord current = audioRecord;
    audioRecord = null;
    if (current == null) return;
    try { current.release(); }
    catch (RuntimeException error) { Log.w(TAG, "Unable to release microphone", error); }
  }

  private boolean insertAtSelection(@NonNull String spokenText) {
    AccessibilityNodeInfo node = validTarget(dictationTarget) ? dictationTarget : findFocusedEditable();
    if (node == null) return false;
    String current = node.getText() == null ? "" : node.getText().toString();
    int start = node.getTextSelectionStart();
    int end = node.getTextSelectionEnd();
    if (start < 0 || end < 0) start = end = current.length();
    start = Math.max(0, Math.min(start, current.length()));
    end = Math.max(start, Math.min(end, current.length()));

    String insertion = spokenText;
    if (start > 0 && end == start && !Character.isWhitespace(current.charAt(start - 1)) &&
        Character.isLetterOrDigit(spokenText.charAt(0))) insertion = " " + insertion;
    String updated = current.substring(0, start) + insertion + current.substring(end);
    Bundle arguments = new Bundle();
    arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, updated);
    boolean changed = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments);
    if (changed) {
      Bundle selection = new Bundle();
      int cursor = start + insertion.length();
      selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_START_INT, cursor);
      selection.putInt(AccessibilityNodeInfo.ACTION_ARGUMENT_SELECTION_END_INT, cursor);
      node.performAction(AccessibilityNodeInfo.ACTION_SET_SELECTION, selection);
    }
    if (node != dictationTarget) node.recycle();
    return changed;
  }

  @Nullable
  private AccessibilityNodeInfo findFocusedEditable() {
    AccessibilityNodeInfo root = getRootInActiveWindow();
    if (root == null) return null;
    AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
    if (isTextTarget(focused)) {
      root.recycle();
      return focused;
    }
    if (focused != null) focused.recycle();
    AccessibilityNodeInfo discovered = findFocusedTextTarget(root);
    root.recycle();
    return discovered;
  }

  private boolean validTarget(@Nullable AccessibilityNodeInfo node) {
    return node != null && node.refresh() && isTextTarget(node);
  }

  private boolean isTextTarget(@Nullable AccessibilityNodeInfo node) {
    if (node == null) return false;
    if (node.isEditable()) return true;
    if ((node.getActions() & AccessibilityNodeInfo.ACTION_SET_TEXT) != 0) return true;
    CharSequence className = node.getClassName();
    return className != null && className.toString().contains("EditText");
  }

  private void rememberClosestTextTarget(@NonNull AccessibilityNodeInfo source) {
    AccessibilityNodeInfo candidate = AccessibilityNodeInfo.obtain(source);
    while (candidate != null) {
      if (isTextTarget(candidate)) {
        rememberTarget(candidate);
        candidate.recycle();
        return;
      }
      AccessibilityNodeInfo parent = candidate.getParent();
      candidate.recycle();
      candidate = parent;
    }
  }

  @Nullable
  private AccessibilityNodeInfo findFocusedTextTarget(@NonNull AccessibilityNodeInfo node) {
    if (node.isFocused() && isTextTarget(node)) return AccessibilityNodeInfo.obtain(node);
    for (int index = 0; index < node.getChildCount(); index += 1) {
      AccessibilityNodeInfo child = node.getChild(index);
      if (child == null) continue;
      AccessibilityNodeInfo match = findFocusedTextTarget(child);
      child.recycle();
      if (match != null) return match;
    }
    return null;
  }

  private void rememberTarget(@NonNull AccessibilityNodeInfo node) {
    clearTarget();
    dictationTarget = AccessibilityNodeInfo.obtain(node);
  }

  private void clearTarget() {
    if (dictationTarget != null) dictationTarget.recycle();
    dictationTarget = null;
  }

  private void transientOverlay(String text, long durationMs) {
    showOverlay(text);
    mainHandler.postDelayed(this::hideOverlay, durationMs);
  }

  private void showOverlay(@NonNull String text) {
    if (windowManager == null) return;
    if (overlay == null) {
      overlay = new TextView(this);
      overlay.setTextColor(Color.WHITE);
      overlay.setTextSize(15f);
      overlay.setGravity(Gravity.CENTER);
      overlay.setPadding(dp(18), dp(11), dp(18), dp(11));
      GradientDrawable background = new GradientDrawable();
      background.setColor(Color.argb(235, 20, 20, 22));
      background.setCornerRadius(dp(24));
      overlay.setBackground(background);
      WindowManager.LayoutParams params = new WindowManager.LayoutParams(
          WindowManager.LayoutParams.WRAP_CONTENT,
          WindowManager.LayoutParams.WRAP_CONTENT,
          WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
          WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
              WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
              WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
          PixelFormat.TRANSLUCENT);
      params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
      params.y = dp(72);
      windowManager.addView(overlay, params);
    }
    overlay.setText(text);
  }

  private void hideOverlay() {
    if (overlay == null || windowManager == null) return;
    try { windowManager.removeView(overlay); }
    catch (RuntimeException error) { Log.w(TAG, "Unable to remove overlay", error); }
    overlay = null;
  }

  private void cancelRecognition() {
    cancelCapture = true;
    listening = false;
    processing = false;
    mainHandler.removeCallbacks(finishingTimeout);
    closeTranscriber();
    if (audioRecord != null) {
      try { audioRecord.stop(); }
      catch (RuntimeException ignored) {}
    }
    releaseAudioRecord();
  }

  private void closeTranscriber() {
    ElevenLabsRealtimeTranscriber current = transcriber;
    transcriber = null;
    if (current != null) current.close();
  }

  private int dp(int value) {
    return Math.round(value * getResources().getDisplayMetrics().density);
  }

}
