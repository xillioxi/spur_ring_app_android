package com.spur.recordingring.yanqiang;

import androidx.annotation.NonNull;

import org.json.JSONObject;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

/** Native realtime Scribe client used while the React Native app is backgrounded. */
final class ElevenLabsRealtimeTranscriber {
  interface Listener {
    void onPartial(@NonNull String text);
    void onFinal(@NonNull String text);
    void onError(@NonNull String message);
  }

  private static final OkHttpClient HTTP = new OkHttpClient.Builder()
      .connectTimeout(12, TimeUnit.SECONDS)
      .readTimeout(0, TimeUnit.MILLISECONDS)
      .pingInterval(15, TimeUnit.SECONDS)
      .build();

  private final Listener listener;
  private final Deque<String> audioQueue = new ArrayDeque<>();
  private Call tokenCall;
  private WebSocket webSocket;
  private boolean socketReady;
  private boolean commitRequested;
  private boolean closed;

  ElevenLabsRealtimeTranscriber(@NonNull Listener listener) {
    this.listener = listener;
  }

  void start(@NonNull String apiKey) {
    Request request = new Request.Builder()
        .url("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe")
        .header("xi-api-key", apiKey)
        .post(RequestBody.create(new byte[0], null))
        .build();
    tokenCall = HTTP.newCall(request);
    tokenCall.enqueue(new Callback() {
      @Override
      public void onFailure(@NonNull Call call, @NonNull IOException error) {
        fail("Unable to connect to ElevenLabs");
      }

      @Override
      public void onResponse(@NonNull Call call, @NonNull Response response) {
        try (Response closeable = response) {
          String body = closeable.body() == null ? "" : closeable.body().string();
          JSONObject payload = body.isEmpty() ? new JSONObject() : new JSONObject(body);
          if (!closeable.isSuccessful()) {
            String detail = payload.optString("error", "");
            fail(detail.isEmpty() ? "ElevenLabs rejected transcription (" + closeable.code() + ")" : detail);
            return;
          }
          String token = payload.optString("token", "");
          if (token.isEmpty()) {
            fail("ElevenLabs did not return a realtime token");
            return;
          }
          openSocket(token);
        } catch (Throwable error) {
          fail("Invalid response from ElevenLabs");
        }
      }
    });
  }

  synchronized void sendAudio(@NonNull String audioBase64) {
    if (closed || audioBase64.isEmpty()) return;
    audioQueue.addLast(audioBase64);
    flushLocked();
  }

  synchronized void commit() {
    if (closed) return;
    commitRequested = true;
    flushLocked();
  }

  synchronized void close() {
    if (closed) return;
    closed = true;
    if (tokenCall != null) tokenCall.cancel();
    if (webSocket != null) webSocket.close(1000, "complete");
    audioQueue.clear();
  }

  private void openSocket(@NonNull String token) {
    HttpUrl url = new HttpUrl.Builder()
        .scheme("https")
        .host("api.elevenlabs.io")
        .addPathSegments("v1/speech-to-text/realtime")
        .addQueryParameter("token", token)
        .addQueryParameter("model_id", "scribe_v2_realtime")
        .addQueryParameter("audio_format", "pcm_16000")
        .addQueryParameter("commit_strategy", "manual")
        .addQueryParameter("no_verbatim", "true")
        .addQueryParameter("filter_background_audio", "true")
        .addQueryParameter("keyterms", "Spur")
        .build();
    Request request = new Request.Builder().url(url).build();
    synchronized (this) {
      if (closed) return;
      webSocket = HTTP.newWebSocket(request, new WebSocketListener() {
        @Override
        public void onOpen(@NonNull WebSocket socket, @NonNull Response response) {
          synchronized (ElevenLabsRealtimeTranscriber.this) {
            if (closed) {
              socket.close(1000, "cancelled");
              return;
            }
            socketReady = true;
            flushLocked();
          }
        }

        @Override
        public void onMessage(@NonNull WebSocket socket, @NonNull String text) {
          handleMessage(text);
        }

        @Override
        public void onFailure(@NonNull WebSocket socket, @NonNull Throwable error, Response response) {
          fail("Realtime transcription connection failed");
        }
      });
    }
  }

  private synchronized void flushLocked() {
    if (!socketReady || webSocket == null || closed) return;
    // Keep the newest audio block so release can commit a block containing audio.
    while (audioQueue.size() > 1) sendChunkLocked(audioQueue.removeFirst(), false);
    if (commitRequested) {
      String finalChunk = audioQueue.isEmpty() ? "" : audioQueue.removeFirst();
      sendChunkLocked(finalChunk, true);
      commitRequested = false;
    }
  }

  private void sendChunkLocked(@NonNull String audioBase64, boolean commit) {
    try {
      JSONObject message = new JSONObject();
      message.put("message_type", "input_audio_chunk");
      message.put("audio_base_64", audioBase64);
      if (commit) message.put("commit", true);
      webSocket.send(message.toString());
    } catch (Throwable error) {
      fail("Unable to stream microphone audio");
    }
  }

  private void handleMessage(@NonNull String raw) {
    try {
      JSONObject message = new JSONObject(raw);
      String type = message.optString("message_type", "");
      String text = message.optString("text", "");
      if ("partial_transcript".equals(type)) {
        listener.onPartial(text);
      } else if ("committed_transcript".equals(type)) {
        listener.onFinal(text);
      } else if (message.has("error")) {
        fail(message.optString("error", "Realtime transcription failed"));
      }
    } catch (Throwable ignored) {
      // Ignore non-transcript informational events such as session_started.
    }
  }

  private void fail(@NonNull String message) {
    synchronized (this) {
      if (closed) return;
      closed = true;
      audioQueue.clear();
      if (webSocket != null) webSocket.cancel();
    }
    listener.onError(message);
  }
}
