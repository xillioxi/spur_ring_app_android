package com.spur.recordingring.yanqiang;

import android.content.Context;

import androidx.annotation.NonNull;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Saves a voice note without depending on the React Native UI process. */
final class RingQuickNoteStore {
  private RingQuickNoteStore() {}

  static void save(@NonNull Context context, @NonNull String text) throws Exception {
    File directory = new File(context.getFilesDir(), "quick-notes");
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IllegalStateException("Unable to create quick-notes directory");
    }
    long createdAt = System.currentTimeMillis();
    String id = "quick-note-" + createdAt + "-" + UUID.randomUUID().toString().substring(0, 8);
    JSONObject note = new JSONObject();
    note.put("id", id);
    note.put("text", text);
    note.put("createdAt", createdAt);
    File pending = new File(directory, id + ".tmp");
    File finished = new File(directory, id + ".json");
    try (FileOutputStream output = new FileOutputStream(pending)) {
      output.write(note.toString().getBytes(StandardCharsets.UTF_8));
      output.getFD().sync();
    }
    if (!pending.renameTo(finished)) {
      pending.delete();
      throw new IllegalStateException("Unable to finish saving quick note");
    }
  }
}
