"""Stored real-time Opus records, as transferred by AIZO RING 3.2.1."""
from dataclasses import asdict
import hashlib
import json
from pathlib import Path
import struct

from .ogg import OpusMetadata, mux_opus_frames
from .recordings import RecordingFile, TransferUpdate, _atomic_write


QUERY = bytes.fromhex("AC510101FFFFFFFF00000001")
RATES = {1: 8000, 2: 16000, 3: 32000, 4: 48000}


class RealtimeRecordingTransfer:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.completed_files = 0
        self.session_bytes = 0
        self.accepted_end = None
        self.packets = {}
        self.size = 0
        self.timestamp = None
        self.audio_format = None

    def feed(self, payload: bytes) -> TransferUpdate:
        if payload.startswith(b"\xAC\x52"):
            self._receive_data(payload)
            return TransferUpdate()
        if len(payload) != 11 or payload[:3] != b"\xAC\x54\x01":
            raise ValueError("Invalid AC54 audio transfer end")
        timestamp, total = struct.unpack_from(">II", payload, 3)
        ack = b"\xAC\x55" + payload[2:7] + b"\x01"
        if total == 0 and timestamp == 0xFFFFFFFF and self.timestamp is None:
            return TransferUpdate(commands=[ack], finished=True)
        if self.accepted_end == (timestamp, total) and self.timestamp is None:
            return TransferUpdate(commands=[ack])
        if not total or self.timestamp != timestamp or len(self.packets) != total or max(self.packets) != total:
            raise ValueError("Real-time recording is incomplete. Its download was not acknowledged.")
        version, mode, duration, frame_size, bitrate, rate, channels = self.audio_format
        frames = b"".join(self.packets[n] for n in range(1, total + 1))
        metadata = OpusMetadata(version, RATES[rate], channels, duration, frame_size,
                                bitrate * 1000, len(frames) // frame_size, 0)
        digest = hashlib.sha256(frames).hexdigest()
        # Include the format so differently encoded records cannot share a basename.
        fmt_id = f"{rate}-{channels}-{duration}-{frame_size}-{bitrate}-{mode}"
        base = self.output_dir / f"ring-{timestamp}-rt-{fmt_id}-{digest[:12]}"
        raw_path, audio_path, info_path = (base.with_suffix(s) for s in (".opus-frames", ".ogg", ".json"))
        _atomic_write(raw_path, frames)
        _atomic_write(audio_path, mux_opus_frames(memoryview(frames), metadata))
        info = dict(audio=asdict(metadata), sha256=digest, timestamp=timestamp,
                    record_mode=mode, transfer_packets=total)
        _atomic_write(info_path, json.dumps(info, indent=2).encode())
        result = RecordingFile(timestamp, raw_path, audio_path, len(frames), metadata, info_path)
        self.completed_files += 1
        self.session_bytes += self.size
        self.accepted_end = (timestamp, total)
        self.timestamp = None
        self.size = 0
        self.packets.clear()
        return TransferUpdate(commands=[ack, QUERY], completed=[result])

    def _receive_data(self, payload: bytes):
        if len(payload) < 24 or payload[2] != 1:
            raise ValueError("Invalid AC52 audio header")
        timestamp, sequence, length = struct.unpack_from(">IIH", payload, 3)
        fmt = struct.unpack_from("<BBHHHBB", payload, 13)
        version, _, duration, frame_size, bitrate, rate, channels = fmt
        if (version != 1 or duration not in (5, 10, 20, 40, 60, 80, 100, 120)
                or not frame_size or not bitrate or rate not in RATES or channels not in (1, 2)):
            raise ValueError("Unsupported AC52 Opus format")
        if len(payload) != 24 + length or not length or length % frame_size or not 1 <= sequence <= 100_000:
            raise ValueError("Invalid AC52 sequence or audio length")
        if self.timestamp is not None and (timestamp != self.timestamp or self.audio_format != fmt):
            raise ValueError("AC52 recording changed before completion")
        frames = payload[24:]
        if sequence in self.packets:
            if self.packets[sequence] != frames:
                raise ValueError("Conflicting AC52 packets")
            return
        if (self.size + length > 64 * 1024**2 or self.session_bytes + self.size + length > 256 * 1024**2
                or self.completed_files >= 4096 or (self.size + length) // frame_size > 250_000):
            raise ValueError("Real-time recording exceeds the desktop transfer limit")
        self.timestamp, self.audio_format = timestamp, fmt
        self.packets[sequence] = frames
        self.size += length
