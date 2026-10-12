package com.spur.recordingring.yanqiang;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.spur.recordingring.MainActivity;
import com.spur.recordingring.R;

import java.util.concurrent.atomic.AtomicInteger;

/** System notifications for outcomes that have already been saved in the app. */
final class RingStatusNotifications {
  private static final String CHANNEL_ID = "spur-ring-outcomes";
  private static final AtomicInteger NEXT_ID = new AtomicInteger(4200);

  private RingStatusNotifications() {}

  static boolean show(@NonNull Context context, @NonNull String kind, @NonNull String detail) {
    if (Build.VERSION.SDK_INT >= 33 &&
        context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED) return false;

    NotificationManager manager = context.getSystemService(NotificationManager.class);
    if (manager == null) return false;
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel channel = new NotificationChannel(
          CHANNEL_ID, "Ring results", NotificationManager.IMPORTANCE_DEFAULT);
      channel.setDescription("Shows when a Spur Ring note or command is ready");
      manager.createNotificationChannel(channel);
    }

    boolean note = "note".equals(kind);
    boolean capture = "capture".equals(kind);
    if (!note && !capture && !"command".equals(kind)) return false;
    int id = NEXT_ID.getAndIncrement();
    Intent openApp = new Intent(context, MainActivity.class);
    openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    PendingIntent contentIntent = PendingIntent.getActivity(context, id, openApp, pendingFlags);
    String title = note ? "🟢 Note saved" : capture ? "🔴 Command captured" : "🔴 Command ready";
    String body = detail.trim().isEmpty() ?
        (note ? "Your note is available in Spur Ring" : "Your result is available in Spur Ring") :
        detail.trim();

    NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
        .setSmallIcon(R.drawable.ic_spur_notification)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
        .setColor(note ? 0xFF248A58 : 0xFFD94D8C)
        .setContentIntent(contentIntent)
        .setAutoCancel(true)
        .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setCategory(NotificationCompat.CATEGORY_STATUS);
    NotificationManagerCompat.from(context).notify(id, notification.build());
    return true;
  }
}
