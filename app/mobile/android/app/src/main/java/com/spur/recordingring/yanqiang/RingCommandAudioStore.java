package com.spur.recordingring.yanqiang;

import android.content.Context;

import androidx.annotation.NonNull;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** Keeps long-press audio on disk so the Processes pipeline can handle it later. */
final class RingCommandAudioStore {
  private final File pending;
  private final File finished;
  private final FileOutputStream output;
  private long audioBytes;
  private boolean closed;

  RingCommandAudioStore(@NonNull Context context) throws Exception {
    File directory = new File(context.getFilesDir(), "voice-recordings");
    if (!directory.exists() && !directory.mkdirs()) {
      throw new IllegalStateException("Unable to create recording directory");
    }
    String name = "command-" + System.currentTimeMillis() + "-" +
        UUID.randomUUID().toString().substring(0, 8);
    pending = new File(directory, name + ".pending");
    finished = new File(directory, name + ".wav");
    output = new FileOutputStream(pending);
    output.write(new byte[44]);
  }

  synchronized void append(@NonNull byte[] bytes, int count) throws Exception {
    if (closed) return;
    output.write(bytes, 0, count);
    audioBytes += count;
  }

  synchronized void finish(int sampleRate, @NonNull String transcript) throws Exception {
    if (closed) throw new IllegalStateException("Recording is already closed");
    closed = true;
    output.getFD().sync();
    output.close();
    if (audioBytes == 0 || audioBytes > Integer.MAX_VALUE - 44L) {
      pending.delete();
      throw new IllegalStateException("Empty or oversized voice command");
    }
    try (RandomAccessFile wav = new RandomAccessFile(pending, "rw")) {
      wav.seek(0);
      wav.writeBytes("RIFF");
      writeLittleEndian(wav, (int) audioBytes + 36, 4);
      wav.writeBytes("WAVEfmt ");
      writeLittleEndian(wav, 16, 4);
      writeLittleEndian(wav, 1, 2);
      writeLittleEndian(wav, 1, 2);
      writeLittleEndian(wav, sampleRate, 4);
      writeLittleEndian(wav, sampleRate * 2, 4);
      writeLittleEndian(wav, 2, 2);
      writeLittleEndian(wav, 16, 2);
      wav.writeBytes("data");
      writeLittleEndian(wav, (int) audioBytes, 4);
      wav.getFD().sync();
    }
    if (!pending.renameTo(finished)) {
      pending.delete();
      throw new IllegalStateException("Unable to finish voice command recording");
    }
    try {
      JSONObject metadata = new JSONObject();
      metadata.put("transcript", transcript);
      File sidecar = new File(finished.getParentFile(), finished.getName() + ".json");
      try (FileOutputStream sidecarOutput = new FileOutputStream(sidecar)) {
        sidecarOutput.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
        sidecarOutput.getFD().sync();
      }
    } catch (Exception ignored) {
      // The WAV is already durable and can still be processed without a cached transcript.
    }
  }

  synchronized void discard() {
    if (!closed) {
      closed = true;
      try { output.close(); } catch (Exception ignored) { }
    }
    pending.delete();
  }

  private static void writeLittleEndian(RandomAccessFile file, int value, int count) throws Exception {
    for (int index = 0; index < count; index++) file.write((value >>> (8 * index)) & 0xff);
  }
}
