package com.spur.recordingring.yanqiang;

import android.Manifest;
import android.app.Application;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.eiot.aizo.sdk.callback.AizoDeviceConnectCallback;
import com.eiot.ringsdk.ServiceSdkCommandV2;
import com.eiot.ringsdk.bean.ExBluetoothDevice;
import com.eiot.ringsdk.bean.FileUploadStateBean;
import com.eiot.ringsdk.bean.OpusFileBean;
import com.eiot.ringsdk.bean.SmartTouchEventModel;
import com.eiot.ringsdk.bean.VoiceRecordResultBean;
import com.eiot.ringsdk.bean.callback.DeviceStorageCallbackBean;
import com.eiot.ringsdk.bean.device.DeviceStorageState;
import com.eiot.ringsdk.bean.device.DeviceWorkingState;
import com.eiot.ringsdk.bean.devicesetting.VoiceRecordParam;
import com.eiot.ringsdk.bean.devicesetting.VoiceRecordSettingResult;
import com.eiot.ringsdk.callback.BCallback;
import com.eiot.ringsdk.callback.DeviceStorageStateCallback;
import com.eiot.ringsdk.callback.DeviceWorkingStateCallback;
import com.eiot.ringsdk.callback.OggFileCallback;
import com.eiot.ringsdk.callback.OnBluetoothSearchListener;
import com.eiot.ringsdk.callback.ICallback;
import com.eiot.ringsdk.callback.SmartTouchEventCallback;
import com.eiot.ringsdk.callback.VoiceRecordCallback;
import com.eiot.ringsdk.callback.VoiceRecordParamCallback;
import com.eiot.ringsdk.callback.VoiceRecordSettingCallback;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.spur.recordingring.BuildConfig;
import com.tencent.mmkv.MMKV;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.lang.ref.WeakReference;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

public class YanqiangVoiceModule extends ReactContextBaseJavaModule {
  private static final String TAG = "YanqiangVoiceModule";
  private static final int VOICE_FILE_FUNCTION = 1;
  private static final String RECORDING_DIR = "voice-recordings";
  private static final long CONNECT_AFTER_SCAN_DELAY_MS = 800L;
  private static final long RECORDING_SYNC_TIMEOUT_MS = 180_000L;
  private static final long STALE_SYNC_LOCK_MS = 15_000L;
  private static final long BACKGROUND_RECONNECT_THROTTLE_MS = 15_000L;
  private static final String PREFS_NAME = "spur-ring-background-sync";
  private static final String PREF_RING_MAC = "ring-mac";
  private static final String PREF_ELEVENLABS_API_KEY = "elevenlabs-api-key";
  private static WeakReference<YanqiangVoiceModule> activeModule = new WeakReference<>(null);

  private boolean sdkInitialized = false;
  private boolean syncInProgress = false;
  private volatile int currentWorkingState = -1;
  private volatile long syncLastActivityAt = 0L;
  private volatile long syncGeneration = 0L;
  private String currentMacAddress = null;
  private int listenerCount = 0;
  private volatile boolean vendorConnected = false;
  private volatile boolean connectionInProgress = false;
  private volatile long lastBackgroundReconnectAt = 0L;
  private volatile long lastDoubleClickAt = 0L;

  private final DeviceWorkingStateCallback workingStateCallback = new DeviceWorkingStateCallback() {
    @Override
    public void onState(@NonNull DeviceWorkingState state) {
      currentWorkingState = state.getState();
      // Some firmware reports hold/release only as recording-state transitions. Do not treat the
      // state=2 transition caused by a double-click as dictation; double-click keeps its original
      // record-toggle behavior.
      if (state.getState() == 2 && System.currentTimeMillis() - lastDoubleClickAt > 900L) {
        RingDictationAccessibilityService.startFromRing();
      } else if (state.getState() == 4 && RingDictationAccessibilityService.isListening()) {
        RingDictationAccessibilityService.stopFromRing();
      }
      WritableMap body = Arguments.createMap();
      body.putInt("function", state.getFunction());
      body.putInt("state", state.getState());
      body.putInt("remainingTime", state.getRemainingTime());
      body.putString("status", mapWorkingState(state.getState()));
      sendEvent("yanqiangVoiceStatusUpdate", body);
    }
  };

  private final SmartTouchEventCallback smartTouchEventCallback = new SmartTouchEventCallback() {
    @Override
    public void onSmartTouchEvent(@NonNull List<SmartTouchEventModel> events) {
      for (SmartTouchEventModel event : events) {
        String action = mapSmartTouchEvent(event.getEvent());
        if ("double_click".equals(action)) {
          lastDoubleClickAt = System.currentTimeMillis();
        } else if ("long_press".equals(action)) {
          RingDictationAccessibilityService.startFromRing();
        } else if ("release_press".equals(action)) {
          RingDictationAccessibilityService.stopFromRing();
        }
        WritableMap body = Arguments.createMap();
        body.putDouble("timestamp", event.getTime());
        body.putInt("event", event.getEvent());
        body.putString("action", action);
        sendEvent("yanqiangSmartTouchEvent", body);
      }
    }
  };

  private final AizoDeviceConnectCallback connectCallback = new AizoDeviceConnectCallback() {
    @Override
    public void connect() {
      connectionInProgress = false;
      // Match the old DreameRing integration: finalize the vendor-side binding before exposing
      // the connection as ready. File transfer commands may fail if this step is skipped.
      ServiceSdkCommandV2.INSTANCE.notifyBoundDevice("DREAME RING", currentMacAddress, new BCallback() {
        @Override
        public void result(boolean success) {
          Log.i(TAG, "notifyBoundDevice result=" + success + " mac=" + currentMacAddress);
          WritableMap body = Arguments.createMap();
          body.putString("macAddress", currentMacAddress);
          body.putBoolean("vendorReady", success);
          if (success) {
            vendorConnected = true;
            ServiceSdkCommandV2.INSTANCE.requestConnectionPriority();
            enableTouchReportingForRingControls();
            body.putString("status", "connected");
          } else {
            vendorConnected = false;
            body.putString("status", "error");
            body.putString("message", "Vendor notifyBoundDevice failed");
          }
          sendEvent("yanqiangVoiceConnectionChanged", body);
        }
      });
    }

    @Override
    public void disconnect() {
      connectionInProgress = false;
      vendorConnected = false;
      WritableMap body = Arguments.createMap();
      body.putString("status", "disconnected");
      body.putString("macAddress", currentMacAddress);
      sendEvent("yanqiangVoiceConnectionChanged", body);
    }

    @Override
    public void connectError(@NonNull Throwable throwable, int state) {
      connectionInProgress = false;
      vendorConnected = false;
      WritableMap body = Arguments.createMap();
      body.putString("status", "error");
      body.putString("macAddress", currentMacAddress);
      body.putInt("state", state);
      body.putString("message", throwable.getMessage());
      sendEvent("yanqiangVoiceConnectionChanged", body);
    }
  };

  public YanqiangVoiceModule(ReactApplicationContext reactContext) {
    super(reactContext);
    activeModule = new WeakReference<>(this);
  }

  public static boolean hasSavedRing(@NonNull Context context) {
    return !context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .getString(PREF_RING_MAC, "").isEmpty();
  }

  public static void requestBackgroundPoll() {
    YanqiangVoiceModule module = activeModule.get();
    if (module == null) {
      Log.w(TAG, "background poll skipped: React Native module is not ready");
      return;
    }
    new Handler(Looper.getMainLooper()).post(module::runBackgroundPoll);
  }

  public static boolean emitRingDictationAudio(@NonNull File file) {
    YanqiangVoiceModule module = activeModule.get();
    if (module == null) {
      Log.w(TAG, "dictation audio skipped: React Native module is not ready");
      return false;
    }
    try {
      WritableMap body = Arguments.createMap();
      body.putString("uri", "file://" + file.getAbsolutePath());
      body.putString("name", file.getName());
      body.putDouble("size", file.length());
      module.sendEvent("yanqiangDictationAudioReady", body);
      return true;
    } catch (Throwable error) {
      Log.e(TAG, "unable to send dictation audio to Spur transcription", error);
      return false;
    }
  }

  public static boolean emitRingDictationStream(
      @NonNull String type, @Nullable String audioBase64, int sampleRate) {
    YanqiangVoiceModule module = activeModule.get();
    if (module == null) {
      Log.w(TAG, "dictation stream skipped: React Native module is not ready");
      return false;
    }
    try {
      WritableMap body = Arguments.createMap();
      body.putString("type", type);
      body.putInt("sampleRate", sampleRate);
      if (audioBase64 != null) body.putString("audioBase64", audioBase64);
      module.sendEvent("yanqiangDictationStream", body);
      return true;
    } catch (Throwable error) {
      Log.e(TAG, "unable to send realtime dictation event", error);
      return false;
    }
  }

  @NonNull
  @Override
  public String getName() {
    return "YanqiangVoiceModule";
  }

  @ReactMethod
  public void addListener(String eventName) {
    listenerCount += 1;
  }

  @ReactMethod
  public void removeListeners(double count) {
    listenerCount = Math.max(0, listenerCount - (int) count);
  }

  @ReactMethod
  public void initSdk(Promise promise) {
    try {
      initializeSdk();
      promise.resolve(true);
    } catch (Throwable error) {
      Log.e(TAG, "initSdk failed", error);
      Throwable root = error;
      while (root.getCause() != null && root.getCause() != root) {
        root = root.getCause();
      }
      String message = root.getMessage() != null ? root.getMessage() : root.toString();
      if (error.getMessage() != null && !error.getMessage().equals(message)) {
        message = error.getMessage() + " | cause=" + message;
      }
      promise.reject("YANQIANG_INIT_FAILED", message, error);
    }
  }

  @ReactMethod
  public void startScan(Promise promise) {
    try {
      initializeSdk();
      String bluetoothError = ensureBluetoothScannerReady(true);
      if (bluetoothError != null) {
        // When adapter is enabled but scanner is briefly null, retry once after a short delay.
        if ("RETRY".equals(bluetoothError)) {
          new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
              String retryError = ensureBluetoothScannerReady(false);
              if (retryError != null && !"RETRY".equals(retryError)) {
                promise.reject("YANQIANG_BT_NOT_READY", retryError);
                return;
              }
              if (retryError != null) {
                promise.reject(
                  "YANQIANG_BT_NOT_READY",
                  "Bluetooth scanner not ready. Toggle Bluetooth off/on and try again."
                );
                return;
              }
              beginVendorScan(promise);
            } catch (Throwable error) {
              Log.e(TAG, "startScan retry failed", error);
              promise.reject("YANQIANG_SCAN_FAILED", rootErrorMessage(error), error);
            }
          }, 400L);
          return;
        }
        promise.reject("YANQIANG_BT_NOT_READY", bluetoothError);
        return;
      }
      beginVendorScan(promise);
    } catch (Throwable error) {
      Log.e(TAG, "startScan failed", error);
      promise.reject("YANQIANG_SCAN_FAILED", rootErrorMessage(error), error);
    }
  }

  /**
   * Vendor searchBtDevice NPEs when BluetoothLeScanner is null (BT off / not ready).
   * Returns null when ready, "RETRY" when a short wait may help, otherwise an error message.
   */
  @Nullable
  private String ensureBluetoothScannerReady(boolean requestEnable) {
    Context context = getReactApplicationContext();
    BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
    BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
    if (adapter == null) {
      return "Bluetooth adapter unavailable on this device";
    }
    if (!adapter.isEnabled()) {
      if (requestEnable) {
        try {
          Intent enableBtIntent = new Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE);
          if (getCurrentActivity() != null) {
            getCurrentActivity().startActivity(enableBtIntent);
          } else {
            enableBtIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(enableBtIntent);
          }
        } catch (Throwable error) {
          Log.w(TAG, "Unable to request Bluetooth enable", error);
        }
      }
      return "Bluetooth is turned off. Enable Bluetooth and try again.";
    }
    BluetoothLeScanner scanner = adapter.getBluetoothLeScanner();
    if (scanner == null) {
      return "RETRY";
    }
    return null;
  }

  private void beginVendorScan(Promise promise) {
    ServiceSdkCommandV2.INSTANCE.searchBtDevice(null, null, new java.util.ArrayList<>(), true,
      new OnBluetoothSearchListener() {
        @Override
        public void start() {
          sendSimpleScanEvent("start", null);
        }

        @Override
        public void end() {
          sendSimpleScanEvent("end", null);
        }

        @Override
        public void search(@NonNull ExBluetoothDevice device) {
          WritableMap body = Arguments.createMap();
          body.putString("type", "device");
          body.putString("name", safeString(device.getName()));
          body.putString("macAddress", safeString(device.getAddress()));
          body.putString("address", safeString(device.getAddress()));
          sendEvent("yanqiangVoiceScanEvent", body);
        }
      });
    promise.resolve(true);
  }

  @ReactMethod
  public void stopScan() {
    ServiceSdkCommandV2.INSTANCE.stopSearchBtDevice();
  }

  @ReactMethod
  public void connect(String macAddress, Promise promise) {
    try {
      ensureInitialized();
      currentMacAddress = macAddress;
      connectionInProgress = true;
      persistRingMac(macAddress);
      RingBackgroundSyncService.start(getReactApplicationContext());
      // The vendor scanner releases Bluetooth asynchronously. Connecting before its end callback
      // can be reported by the SDK as the generic bind error 1001.
      ServiceSdkCommandV2.INSTANCE.stopSearchBtDevice();
      ServiceSdkCommandV2.INSTANCE.removeCallback(connectCallback);
      ServiceSdkCommandV2.INSTANCE.addCallback(connectCallback);
      new Handler(Looper.getMainLooper()).postDelayed(() -> {
        try {
          Log.i(TAG, "connect after scan release mac=" + macAddress);
          ServiceSdkCommandV2.INSTANCE.connect(macAddress);
          promise.resolve(true);
        } catch (Throwable error) {
          connectionInProgress = false;
          Log.e(TAG, "connect failed", error);
          promise.reject("YANQIANG_CONNECT_FAILED", rootErrorMessage(error), error);
        }
      }, CONNECT_AFTER_SCAN_DELAY_MS);
    } catch (Exception error) {
      connectionInProgress = false;
      promise.reject("YANQIANG_CONNECT_FAILED", error);
    }
  }

  @ReactMethod
  public void disconnect(Promise promise) {
    try {
      ServiceSdkCommandV2.INSTANCE.disconnect(new BCallback() {
        @Override
        public void result(boolean success) {
          if (success) {
            vendorConnected = false;
            connectionInProgress = false;
            clearPersistedRingMac();
            RingBackgroundSyncService.stop(getReactApplicationContext());
          }
          promise.resolve(success);
        }
      });
    } catch (Exception error) {
      promise.reject("YANQIANG_DISCONNECT_FAILED", error);
    }
  }

  @ReactMethod
  public void setTouchEventReporting(boolean enabled, Promise promise) {
    try {
      ensureInitialized();
      ServiceSdkCommandV2.INSTANCE.setTouchEventReportSwitch(enabled ? 1 : 0, new ICallback() {
        @Override
        public void result(int result) {
          WritableMap body = Arguments.createMap();
          body.putBoolean("enabled", enabled);
          body.putInt("result", result);
          promise.resolve(body);
        }
      });
    } catch (Exception error) {
      promise.reject("YANQIANG_TOUCH_REPORT_FAILED", error);
    }
  }

  @ReactMethod
  public void queryVoiceRecordingSummary(Promise promise) {
    try {
      ensureInitialized();
      ServiceSdkCommandV2.INSTANCE.getDeviceStorageState(VOICE_FILE_FUNCTION, new DeviceStorageStateCallback() {
        @Override
        public void onResult(@NonNull DeviceStorageCallbackBean result) {
          WritableMap body = Arguments.createMap();
          body.putInt("code", result.getCode());
          body.putString("message", result.getMessage());

          DeviceStorageState data = result.getData();
          if (data != null) {
            body.putBoolean("supported", true);
            body.putInt("function", data.getFunction());
            body.putInt("fileCount", data.getDataNumber());
            body.putInt("totalBytes", data.getDataTotalBytes());
          } else {
            body.putBoolean("supported", false);
            body.putInt("fileCount", 0);
            body.putInt("totalBytes", 0);
          }

          body.putArray("files", listLocalRecordingFiles());
          promise.resolve(body);
        }
      });
    } catch (Exception error) {
      promise.reject("YANQIANG_QUERY_RECORDING_FAILED", error);
    }
  }

  @ReactMethod
  public void syncVoiceRecordings(Promise promise) {
    syncVoiceRecordingsInternal(promise);
  }

  @ReactMethod
  public void getRingDictationStatus(Promise promise) {
    Context context = getReactApplicationContext();
    WritableMap body = Arguments.createMap();
    body.putBoolean("accessibilityEnabled",
        RingDictationAccessibilityService.isServiceEnabled(context));
    body.putBoolean("microphoneGranted",
        context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED);
    body.putBoolean("listening", RingDictationAccessibilityService.isListening());
    promise.resolve(body);
  }

  @ReactMethod
  public void openRingDictationSettings(Promise promise) {
    try {
      Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
      getReactApplicationContext().startActivity(intent);
      promise.resolve(true);
    } catch (Throwable error) {
      promise.reject("RING_DICTATION_SETTINGS_FAILED", rootErrorMessage(error), error);
    }
  }

  @ReactMethod
  public void startRingDictationTest(Promise promise) {
    promise.resolve(RingDictationAccessibilityService.startFromRing());
  }

  @ReactMethod
  public void stopRingDictationTest(Promise promise) {
    promise.resolve(RingDictationAccessibilityService.stopFromRing());
  }

  @ReactMethod
  public void completeRingDictation(String text, Promise promise) {
    promise.resolve(RingDictationAccessibilityService.completeFromSpur(text));
  }

  @ReactMethod
  public void failRingDictation(String message, Promise promise) {
    promise.resolve(RingDictationAccessibilityService.failFromSpur(message));
  }

  @ReactMethod
  public void updateRingDictationPartial(String text, Promise promise) {
    promise.resolve(RingDictationAccessibilityService.updatePartialFromSpur(text));
  }

  @ReactMethod
  public void getElevenLabsApiKey(String packagedKey, Promise promise) {
    String seed = packagedKey == null ? "" : packagedKey.trim();
    SharedPreferences preferences = getPreferences();
    String stored = preferences.getString(PREF_ELEVENLABS_API_KEY, "");
    if (!seed.isEmpty() && !seed.equals(stored)) {
      preferences.edit().putString(PREF_ELEVENLABS_API_KEY, seed).apply();
      stored = seed;
    }
    promise.resolve(stored == null ? "" : stored);
  }

  @ReactMethod
  public void resumeBackgroundSync(Promise promise) {
    try {
      initializeSdk();
      boolean hasRing = hasSavedRing(getReactApplicationContext());
      if (hasRing) RingBackgroundSyncService.start(getReactApplicationContext());
      promise.resolve(hasRing);
    } catch (Throwable error) {
      Log.e(TAG, "resumeBackgroundSync failed", error);
      promise.reject("YANQIANG_BACKGROUND_SYNC_FAILED", rootErrorMessage(error), error);
    }
  }

  private synchronized void syncVoiceRecordingsInternal(@Nullable Promise promise) {
    if (syncInProgress) {
      long inactiveMs = System.currentTimeMillis() - syncLastActivityAt;
      if (syncLastActivityAt > 0 && inactiveMs >= STALE_SYNC_LOCK_MS) {
        Log.w(TAG, "recovering stale recording sync lock inactiveMs=" + inactiveMs);
        syncInProgress = false;
      } else {
        rejectSync(promise, "YANQIANG_RECORDING_SYNC_BUSY",
            "Voice recording sync is already running (inactive " + inactiveMs + "ms)", null);
        return;
      }
    }

    // Vendor state 4 means that recording data is ready and waiting for the App to upload it.
    // Allow both idle (1) and data-pending (4); block recording/paused/already-uploading states.
    if (currentWorkingState != -1 && currentWorkingState != 1 && currentWorkingState != 4) {
      rejectSync(promise, "YANQIANG_DEVICE_NOT_READY_FOR_SYNC",
          "Ring cannot sync in workingState=" + currentWorkingState + ". Wait for state=1 or state=4.", null);
      return;
    }

    try {
      ensureInitialized();
      syncInProgress = true;
      syncLastActivityAt = System.currentTimeMillis();
      long generation = ++syncGeneration;

      AtomicInteger pendingConversions = new AtomicInteger(0);
      AtomicBoolean finishSeen = new AtomicBoolean(false);
      AtomicBoolean resolved = new AtomicBoolean(false);
      Handler timeoutHandler = new Handler(Looper.getMainLooper());
      Runnable[] timeoutTask = new Runnable[1];

      Runnable tryResolve = new Runnable() {
        @Override
        public void run() {
          if (finishSeen.get() && pendingConversions.get() == 0 && resolved.compareAndSet(false, true)) {
            timeoutHandler.removeCallbacks(timeoutTask[0]);
            if (generation == syncGeneration) {
              syncInProgress = false;
              syncLastActivityAt = 0L;
            }
            WritableMap body = Arguments.createMap();
            body.putArray("files", listLocalRecordingFiles());
            resolveSync(promise, body);
          }
        }
      };

      timeoutTask[0] = () -> {
        if (generation == syncGeneration && resolved.compareAndSet(false, true)) {
          syncInProgress = false;
          syncLastActivityAt = 0L;
          Log.e(TAG, "voice recording sync timed out after " + RECORDING_SYNC_TIMEOUT_MS + "ms");
          rejectSync(promise, "YANQIANG_SYNC_TIMEOUT", "Voice recording sync timed out after 180 seconds", null);
        }
      };
      timeoutHandler.postDelayed(timeoutTask[0], RECORDING_SYNC_TIMEOUT_MS);

      // Vendor SDK semantics are counter-intuitive (confirmed from bytecode):
      // true only resumes a matching cached/incomplete transfer and fails when no cache exists;
      // false performs the normal flow: resume if needed, otherwise query and start a new upload.
      ServiceSdkCommandV2.INSTANCE.getVoiceRecordFile(false, new VoiceRecordCallback() {
        @Override
        public void onStart(@NonNull VoiceRecordResultBean result) {
          if (generation != syncGeneration) return;
          syncLastActivityAt = System.currentTimeMillis();
          WritableMap body = Arguments.createMap();
          body.putString("phase", "start");
          body.putInt("code", result.getCode());
          body.putString("message", result.getMessage());
          sendEvent("yanqiangVoiceSyncState", body);
          if (result.getCode() != 1 && resolved.compareAndSet(false, true)) {
            timeoutHandler.removeCallbacks(timeoutTask[0]);
            syncInProgress = false;
            syncLastActivityAt = 0L;
            rejectSync(promise, "YANQIANG_SYNC_START_FAILED",
                "Vendor failed to start voice file transfer: code=" + result.getCode()
                    + " message=" + result.getMessage(), null);
          }
        }

        @Override
        public void onProgress(@NonNull FileUploadStateBean state) {
          if (generation != syncGeneration) return;
          syncLastActivityAt = System.currentTimeMillis();
          WritableMap body = Arguments.createMap();
          body.putString("fileName", state.getCurFileName());
          body.putDouble("fileTime", state.getCurFileTime());
          body.putInt("progress", state.getCurFileProgress());
          body.putInt("currentFile", state.getCurFileNum());
          body.putInt("totalFiles", state.getTotalFiles());
          sendEvent("yanqiangVoiceSyncProgress", body);
        }

        @Override
        public void onReceive(@NonNull OpusFileBean opusFile) {
          if (generation != syncGeneration) return;
          syncLastActivityAt = System.currentTimeMillis();
          pendingConversions.incrementAndGet();
          ServiceSdkCommandV2.INSTANCE.opusToOgg(opusFile, new OggFileCallback() {
            @Override
            public void onResult(@Nullable byte[] oggBytes) {
              try {
                if (oggBytes == null || oggBytes.length == 0) {
                  Log.w(TAG, "opusToOgg returned empty bytes for " + opusFile.getFileName());
                  return;
                }
                WritableMap file = saveOggFile(opusFile, oggBytes);
                sendEvent("yanqiangVoiceFileReady", file);
              } catch (Exception error) {
                Log.e(TAG, "save ogg failed", error);
                WritableMap body = Arguments.createMap();
                body.putString("message", error.getMessage());
                body.putString("fileName", opusFile.getFileName());
                sendEvent("yanqiangVoiceError", body);
              } finally {
                pendingConversions.decrementAndGet();
                tryResolve.run();
              }
            }
          });
        }

        @Override
        public void onFinish(@NonNull VoiceRecordResultBean result) {
          if (generation != syncGeneration) return;
          syncLastActivityAt = System.currentTimeMillis();
          WritableMap body = Arguments.createMap();
          body.putString("phase", "finish");
          body.putInt("code", result.getCode());
          body.putString("message", result.getMessage());
          sendEvent("yanqiangVoiceSyncState", body);
          finishSeen.set(true);
          tryResolve.run();
        }
      });
    } catch (Exception error) {
      syncInProgress = false;
      syncLastActivityAt = 0L;
      rejectSync(promise, "YANQIANG_SYNC_RECORDING_FAILED", rootErrorMessage(error), error);
    }
  }

  @ReactMethod
  public void getVoiceRecordParam(Promise promise) {
    try {
      ensureInitialized();
      ServiceSdkCommandV2.INSTANCE.getVoiceRecordParam(new VoiceRecordParamCallback() {
        @Override
        public void onResult(@NonNull VoiceRecordSettingResult result) {
          promise.resolve(voiceRecordSettingToMap(result));
        }
      });
    } catch (Exception error) {
      promise.reject("YANQIANG_GET_RECORD_PARAM_FAILED", error);
    }
  }

  @ReactMethod
  public void setVoiceRecordParam(int bitrate, int volume, int lightBrightness, Promise promise) {
    try {
      ensureInitialized();
      ServiceSdkCommandV2.INSTANCE.setVoiceRecordParam(bitrate, volume, lightBrightness,
          new VoiceRecordSettingCallback() {
            @Override
            public void onResult(@NonNull VoiceRecordSettingResult result) {
              promise.resolve(voiceRecordSettingToMap(result));
            }
          });
    } catch (Exception error) {
      promise.reject("YANQIANG_SET_RECORD_PARAM_FAILED", error);
    }
  }

  private void ensureInitialized() {
    if (!sdkInitialized) {
      throw new IllegalStateException("Call initSdk() before using YanqiangVoiceModule");
    }
  }

  private void runBackgroundPoll() {
    try {
      initializeSdk();
      if (!vendorConnected) {
        String savedMac = getPreferences().getString(PREF_RING_MAC, "");
        if (savedMac == null || savedMac.isEmpty()) {
          Log.i(TAG, "background poll stopped: no saved ring");
          RingBackgroundSyncService.stop(getReactApplicationContext());
          return;
        }

        long now = System.currentTimeMillis();
        if (connectionInProgress || now - lastBackgroundReconnectAt < BACKGROUND_RECONNECT_THROTTLE_MS) {
          return;
        }
        currentMacAddress = savedMac;
        connectionInProgress = true;
        lastBackgroundReconnectAt = now;
        ServiceSdkCommandV2.INSTANCE.removeCallback(connectCallback);
        ServiceSdkCommandV2.INSTANCE.addCallback(connectCallback);
        Log.i(TAG, "background reconnect mac=" + savedMac);
        ServiceSdkCommandV2.INSTANCE.connect(savedMac);
        return;
      }

      syncVoiceRecordingsInternal(null);
    } catch (Throwable error) {
      connectionInProgress = false;
      Log.e(TAG, "background poll failed", error);
    }
  }

  private SharedPreferences getPreferences() {
    return getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
  }

  private void persistRingMac(@NonNull String macAddress) {
    getPreferences().edit().putString(PREF_RING_MAC, macAddress).apply();
  }

  private void clearPersistedRingMac() {
    getPreferences().edit().remove(PREF_RING_MAC).apply();
  }

  private void resolveSync(@Nullable Promise promise, @NonNull WritableMap result) {
    if (promise != null) {
      promise.resolve(result);
    } else {
      Log.i(TAG, "background recording sync completed");
    }
  }

  private void rejectSync(
      @Nullable Promise promise,
      @NonNull String code,
      @NonNull String message,
      @Nullable Throwable error
  ) {
    if (promise == null) {
      Log.w(TAG, "background recording sync skipped/failed: " + code + " " + message, error);
      return;
    }
    if (error != null) {
      promise.reject(code, message, error);
    } else {
      promise.reject(code, message);
    }
  }

  private synchronized void initializeSdk() {
    if (sdkInitialized) return;

    // DreameRing 原注释："Dreame Ring" 与官方 applicationId 参数不可随意更改。
    Application application = (Application) getReactApplicationContext().getApplicationContext();
    String versionName = BuildConfig.VERSION_NAME != null ? BuildConfig.VERSION_NAME : "0.1.0";
    String vendorAppId = "com.aierdream.dreamering";
    Log.i(TAG, "initSdk begin version=" + versionName + " vendorAppId=" + vendorAppId
        + " actualPackage=" + application.getPackageName());

    String mmkvRoot = MMKV.initialize(application);
    Log.i(TAG, "MMKV.initialize root=" + mmkvRoot);
    ServiceSdkCommandV2.INSTANCE.init(application, 1, versionName, "Dreame Ring",
        vendorAppId, "CN", "ZH", "", true);
    ServiceSdkCommandV2.INSTANCE.registerDeviceWorkingStateListener(workingStateCallback);
    ServiceSdkCommandV2.INSTANCE.addSmartTouchEventListener(smartTouchEventCallback);
    sdkInitialized = true;
    Log.i(TAG, "initSdk success");
  }

  private void enableTouchReportingForRingControls() {
    try {
      ServiceSdkCommandV2.INSTANCE.setTouchEventReportSwitch(1, new ICallback() {
        @Override public void result(int result) {
          Log.i(TAG, "ring control touch reporting result=" + result);
        }
      });
    } catch (Throwable error) {
      Log.w(TAG, "unable to enable ring control touch reporting", error);
    }
  }

  private String rootErrorMessage(Throwable error) {
    Throwable root = error;
    while (root.getCause() != null && root.getCause() != root) root = root.getCause();
    return root.getMessage() != null ? root.getMessage() : root.toString();
  }

  private void sendSimpleScanEvent(String type, @Nullable String message) {
    WritableMap body = Arguments.createMap();
    body.putString("type", type);
    if (message != null) body.putString("message", message);
    sendEvent("yanqiangVoiceScanEvent", body);
  }

  private void sendEvent(String eventName, @Nullable WritableMap body) {
    if (listenerCount <= 0 && !eventName.equals("yanqiangVoiceFileReady")) {
      // RN may still receive after listener registration; skip noisy background events before JS subscribes.
    }
    getReactApplicationContext()
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
        .emit(eventName, body);
  }

  private WritableArray listLocalRecordingFiles() {
    WritableArray files = Arguments.createArray();
    File dir = getRecordingDir();
    File[] list = dir.listFiles();
    if (list == null) return files;

    java.util.Arrays.sort(list, (a, b) -> Long.compare(b.lastModified(), a.lastModified()));
    for (File file : list) {
      if (!file.isFile() || !file.getName().toLowerCase().endsWith(".ogg")) continue;
      WritableMap item = Arguments.createMap();
      item.putString("name", file.getName());
      item.putString("uri", "file://" + file.getAbsolutePath());
      item.putDouble("timestamp", file.lastModified());
      item.putDouble("size", file.length());
      files.pushMap(item);
    }
    return files;
  }

  private WritableMap saveOggFile(OpusFileBean opusFile, byte[] oggBytes) throws IOException {
    File dir = getRecordingDir();
    if (!dir.exists() && !dir.mkdirs()) {
      throw new IOException("Unable to create recording dir: " + dir.getAbsolutePath());
    }

    String baseName = opusFile.getFileName();
    if (baseName == null || baseName.trim().isEmpty()) {
      baseName = "voice-" + opusFile.getFileTime();
    }
    baseName = sanitizeFileName(baseName);
    if (!baseName.toLowerCase().endsWith(".ogg")) {
      baseName += ".ogg";
    }

    File out = new File(dir, baseName);
    try (FileOutputStream stream = new FileOutputStream(out)) {
      stream.write(oggBytes);
    }

    long rawFileTime = opusFile.getFileTime();
    long timestamp = normalizeFileTimestamp(rawFileTime);
    out.setLastModified(timestamp);

    WritableMap item = Arguments.createMap();
    item.putString("name", out.getName());
    item.putString("uri", "file://" + out.getAbsolutePath());
    item.putDouble("timestamp", out.lastModified());
    item.putDouble("size", out.length());
    item.putDouble("rawFileTime", rawFileTime);
    return item;
  }

  private long normalizeFileTimestamp(long rawFileTime) {
    // Accept Unix milliseconds or Unix seconds. Other positive values may be a duration/vendor value.
    if (rawFileTime >= 946684800000L) return rawFileTime;
    if (rawFileTime >= 946684800L && rawFileTime <= 4102444800L) return rawFileTime * 1000L;
    return System.currentTimeMillis();
  }

  private File getRecordingDir() {
    return new File(getReactApplicationContext().getFilesDir(), RECORDING_DIR);
  }

  private WritableMap voiceRecordSettingToMap(VoiceRecordSettingResult result) {
    WritableMap body = Arguments.createMap();
    body.putInt("code", result.getCode());
    body.putString("message", result.getMessage());
    VoiceRecordParam data = result.getData();
    if (data != null) {
      WritableMap param = Arguments.createMap();
      param.putInt("volume", data.getVolume());
      param.putInt("bitrate", data.getCurBitrate());
      param.putInt("lightBrightness", data.getLightBrightness());
      body.putMap("data", param);
    }
    return body;
  }

  private String mapWorkingState(int state) {
    switch (state) {
      case 1:
        return "idle";
      case 2:
        return "recording";
      case 3:
        return "paused";
      case 4:
        return "ready_to_sync";
      case 5:
        return "syncing";
      default:
        return "unknown";
    }
  }

  private String mapSmartTouchEvent(int event) {
    switch (event) {
      case 257:
      case 4353:
        return "single_click";
      case 258:
      case 4354:
        return "double_click";
      case 259:
        return "long_press";
      case 262:
        return "release_press";
      case 4355:
        return "volume_up";
      case 4356:
        return "volume_down";
      case 4357:
        return "swipe_up";
      case 4358:
        return "swipe_down";
      case 4359:
        return "swipe_left";
      case 4360:
        return "swipe_right";
      default:
        return "unknown";
    }
  }

  private String sanitizeFileName(String value) {
    return value.replaceAll("[\\\\/:*?\"<>|\\s]+", "_");
  }

  private String safeString(@Nullable String value) {
    return value == null ? "" : value;
  }
}
