package com.spur.recordingring.yanqiang;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import com.spur.recordingring.MainActivity;
import com.spur.recordingring.R;

/**
 * Keeps the vendor BLE process alive and polls for ring recordings while the UI is backgrounded.
 * Android displays an ongoing notification for the lifetime of this connected-device service.
 */
public final class RingBackgroundSyncService extends Service {
  private static final String TAG = "RingBackgroundSync";
  private static final String CHANNEL_ID = "spur-ring-background-sync";
  private static final int NOTIFICATION_ID = 4107;
  private static final long POLL_INTERVAL_MS = 18_000L;
  private static final long INITIAL_POLL_DELAY_MS = 1_500L;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable pollTask = new Runnable() {
    @Override
    public void run() {
      YanqiangVoiceModule.requestBackgroundPoll();
      handler.postDelayed(this, POLL_INTERVAL_MS);
    }
  };

  public static void start(Context context) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
        && context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)
            != PackageManager.PERMISSION_GRANTED) {
      Log.w(TAG, "background sync not started: Bluetooth connect permission is missing");
      return;
    }
    Intent intent = new Intent(context, RingBackgroundSyncService.class);
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent);
      } else {
        context.startService(intent);
      }
    } catch (RuntimeException error) {
      Log.e(TAG, "unable to start background sync service", error);
    }
  }

  public static void stop(Context context) {
    context.stopService(new Intent(context, RingBackgroundSyncService.class));
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createNotificationChannel();
    startForeground(NOTIFICATION_ID, buildNotification());
    handler.postDelayed(pollTask, INITIAL_POLL_DELAY_MS);
    Log.i(TAG, "background ring sync started");
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    handler.removeCallbacks(pollTask);
    Log.i(TAG, "background ring sync stopped");
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
        CHANNEL_ID,
        "Ring background sync",
        NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Keeps Spur Ring connected and imports completed recordings");
    NotificationManager manager = getSystemService(NotificationManager.class);
    if (manager != null) manager.createNotificationChannel(channel);
  }

  private Notification buildNotification() {
    Intent openApp = new Intent(this, MainActivity.class);
    openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
    }
    PendingIntent contentIntent = PendingIntent.getActivity(this, 0, openApp, pendingFlags);

    return new NotificationCompat.Builder(this, CHANNEL_ID)
        .setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle("Spur Ring connected")
        .setContentText("Syncing new recordings in the background")
        .setContentIntent(contentIntent)
        .setCategory(NotificationCompat.CATEGORY_SERVICE)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .setOngoing(true)
        .setOnlyAlertOnce(true)
        .build();
  }
}
