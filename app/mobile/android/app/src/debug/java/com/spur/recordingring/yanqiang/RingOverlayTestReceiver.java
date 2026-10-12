package com.spur.recordingring.yanqiang;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Debug-build hook used to verify the real Android OS overlay on an emulator. */
public final class RingOverlayTestReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String requested = intent == null ? null : intent.getStringExtra("kind");
    String kind = "process".equals(requested) ? "process" : "note";
    RingResultOverlay.showForTest(context, kind);
  }
}
