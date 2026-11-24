"""Bleak Bluetooth transport for Windows and macOS.

Protocol work is derived from the embedded Android SDK. Each host platform
needs its own real-device acceptance run; diagnostics never scan or connect.
"""
from __future__ import annotations

import asyncio
from contextlib import suppress
from datetime import datetime
import importlib.metadata
from pathlib import Path
import platform
import re
import sys
import time
from typing import Callable

from . import __version__
from .live_audio import STATE_NAMES, dictation_capability, parse_touch_events
from .protocol import (
    ACK_UUID, ADVERTISED_SERVICE_UUID, COMMAND_UUID, RESPONSE_UUID, SECOND_COMMAND_UUID, SERVICE_UUID,
    Packet, PacketCodec, ProtocolError, binding_confirmation, build_binding_request,
    encode_packet, make_ack, next_sequence, parse_binding_response,
    validate_binding_response,
)
from .recordings import RecordingTransfer
from .realtime_recordings import QUERY as REALTIME_QUERY, LiveRingRecording, RealtimeRecordingTransfer
from .storage import DesktopStorage

SECOND_RESPONSE_UUID = '0000013a-0000-1000-8000-00805f9b34fb'
AUTHENTICATION_TIMEOUT = 60
TOUCH_REPORT_TIMEOUT = 8
SUMMARY_TIMEOUT = 3
FIRST_PACKET_TIMEOUT = 10
LIVE_END_GRACE = 5


class RingDisconnectedError(RuntimeError):
    """An established Bluetooth link was lost unexpectedly."""

    def __init__(self):
        super().__init__('The ring disconnected. Saved recordings are retained.')


def normalize_bluetooth_mac(address: str) -> str:
    if not isinstance(address, str) or not re.fullmatch(r'(?:[0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}', address):
        raise ValueError('Enter the Bluetooth MAC address shown in the ring app.')
    return address.upper()


def normalize_ring_identifier(address: str) -> str:
    if sys.platform != 'darwin':
        return normalize_bluetooth_mac(address)
    if not isinstance(address, str) or not re.fullmatch(r'[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}', address):
        raise ValueError('Select a ring identified by macOS Bluetooth.')
    return address.upper()


async def diagnose() -> dict:
    """Inspect host support without scanning, connecting, or requesting consent."""
    system = platform.system()
    result = {'app_version': __version__, 'platform': platform.platform(),
              'architecture': platform.machine(), 'hardware_validated': False,
              'backend': {'Windows': 'Windows WinRT via Bleak',
                          'Darwin': 'macOS CoreBluetooth via Bleak'}.get(system, 'unsupported'),
              'radios': []}
    try:
        result['bleak_version'] = importlib.metadata.version('bleak')
        if system == 'Darwin':
            # Query the class authorization property only. Creating a central
            # manager here would request permission before the user chose Scan.
            from CoreBluetooth import CBManager
            authorization = int(CBManager.authorization())
            result['bluetooth_authorization'] = {
                0: 'not-determined', 1: 'restricted', 2: 'denied', 3: 'allowed',
            }.get(authorization, 'unknown')
            result['radio_state'] = 'not-checked'
            result['message'] = 'Bluetooth power and availability are checked when you scan for a ring.'
            if authorization in (1, 2):
                result['error'] = 'Bluetooth access is restricted or denied. Allow Spur Ring in System Settings → Privacy & Security → Bluetooth.'
            elif authorization == 0:
                result['message'] = 'Choose Scan to request Bluetooth access. The app must include NSBluetoothAlwaysUsageDescription.'
            return result
        if system != 'Windows':
            result['error'] = 'This desktop build supports Windows and macOS.'
            return result
        from winrt.windows.devices.radios import Radio, RadioKind
        radios = await asyncio.wait_for(Radio.get_radios_async(), timeout=6)
        result['radios'] = [{'name': radio.name, 'kind': str(radio.kind),
                             'state': str(radio.state)} for radio in radios
                            if radio.kind == RadioKind.BLUETOOTH]
        if not result['radios']:
            result['error'] = 'No Bluetooth radio was reported by Windows.'
    except Exception as error:
        result['error'] = f'{type(error).__name__}: {error}' or 'Bluetooth query failed.'
    return result


def _scan_options() -> dict:
    """CoreBluetooth on macOS 12.0–12.2 requires an advertised-service filter."""
    if platform.system() == 'Darwin' and platform.mac_ver()[0].split('.')[:2] in (
            ['12', '0'], ['12', '1'], ['12', '2']):
        return {'service_uuids': [ADVERTISED_SERVICE_UUID, SERVICE_UUID]}
    return {}


async def test_connection(address: str, data_dir: Path) -> dict:
    """Explicit diagnostic: authenticate and read counts, without downloading."""
    from bleak import BleakScanner
    report = {'app_version': __version__, 'authenticated': False, 'events': []}
    client = RingClient(data_dir, report['events'].append)
    try:
        device = await BleakScanner.find_device_by_address(address, timeout=25, **_scan_options())
        if device is None:
            raise RuntimeError('The selected ring was not advertising during the scan.')
        client._devices[device.address] = device
        await client.connect(device.address)
        report['authenticated'] = client._authenticated
        report['mtu'] = client._ble.mtu_size
        client._summary_future = asyncio.get_running_loop().create_future()
        await client._send(bytes.fromhex('AA1301'))
        report['recording_summary'] = await asyncio.wait_for(client._summary_future, 10)
        client._summary_future = None
    except Exception as error:
        report['error'] = f'{type(error).__name__}: {error}'
    finally:
        await client.disconnect()
    return report


class RingClient:
    def __init__(self, data_dir: Path, on_event: Callable[[dict], None]):
        self.storage = DesktopStorage(data_dir)
        self.on_event = on_event
        self._ble = None
        self._devices = {}
        self._codec = PacketCodec()
        self._sequence = 0
        self._generation = 0
        self._unexpected_disconnect = False
        self._releasing_link = False
        self._authenticated = False
        self._working_state: int | None = None
        self._recording_in_progress = False
        self._ready_reported = False
        self._binding = None
        self._auth_future = None
        self._sync_future = None
        self._summary_future = None
        self._transfer = None
        self._realtime = None
        self._transfer_protocol = None
        self._legacy_empty = False
        self._file_channel = COMMAND_UUID
        self._reader = None
        self._queue = None
        self._write_lock = asyncio.Lock()
        self._lifecycle_lock = asyncio.Lock()
        self._status = 'disconnected'
        self._last_sync_activity = 0.0
        self._missing_ack_logged = False
        self._dictation_armed = False
        self._live_requested = False
        self._live: LiveRingRecording | None = None
        self._live_end_timer = None
        self._live_done = asyncio.Event()
        self._last_live_stamp = None
        self._live_stop_sent = True
        self._dictation_intent = 0
        self._touch_reporting_requested = False
        self._touch_future = None

    def _emit(self, event_type: str, **values):
        self.on_event({'type': event_type, **values})

    def _log(self, message: str):
        self._emit('log', message=message)

    def _state(self, status: str, message: str = '', **details):
        self._status = status
        self._emit('status', status=status, message=message, **details)

    def list_recordings(self):
        return self.storage.list_recordings()

    def live_audio_capability(self) -> dict:
        """Describe AIZO controls separately from the source of live audio."""
        return dictation_capability()

    async def arm_dictation(self, *, live_ring_audio=False):
        """Arm physical controls, optionally requesting ring audio during a take."""
        self._dictation_intent += 1
        intent = self._dictation_intent
        async with self._lifecycle_lock:
            if intent != self._dictation_intent:
                return
            if not self._authenticated or self._ble is None or not self._ble.is_connected:
                raise RuntimeError('Connect and authenticate the ring before arming dictation.')
            if self._dictation_armed:
                if self._live_requested != live_ring_audio:
                    self._reset_live()
                self._live_requested = live_ring_audio
                return
            await self._set_touch_reporting(True)
            if intent != self._dictation_intent:
                return
            self._dictation_armed = True
            self._live_requested = live_ring_audio
            self._emit('dictation-state', armed=True)

    async def disarm_dictation(self):
        """Stop emitting capture triggers, then disable ring touch reporting."""
        self._dictation_intent += 1
        self._dictation_armed = False
        self._live_requested = False
        self._reset_live()
        self._emit('dictation-state', armed=False)
        async with self._lifecycle_lock:
            self._dictation_armed = False
            if (self._touch_reporting_requested and self._authenticated and
                    self._ble is not None and self._ble.is_connected):
                await self._set_touch_reporting(False)

    async def _set_touch_reporting(self, enabled: bool):
        future = asyncio.get_running_loop().create_future()
        self._touch_future = future
        # If the reply is lost, disconnect still attempts the disable command.
        if enabled:
            self._touch_reporting_requested = True
        try:
            await self._send(b'\x81\x63' + bytes([enabled]))
            await asyncio.wait_for(future, timeout=TOUCH_REPORT_TIMEOUT)
            self._touch_reporting_requested = enabled
        except asyncio.TimeoutError as error:
            raise RuntimeError('The ring did not confirm touch reporting (8164). This firmware may not support ring dictation controls; retry or use the computer microphone button.') from error
        finally:
            if future.done() and not future.cancelled():
                future.exception()
            elif not future.done():
                future.cancel()
            self._touch_future = None

    async def scan(self, address: str | None = None, *, preserve_devices: bool = False,
                   known_addresses: frozenset[str] = frozenset()) -> list[dict]:
        from bleak import BleakScanner
        if self._ble is not None:
            raise RuntimeError('Disconnect the ring before scanning again.')
        if address is not None:
            address = normalize_ring_identifier(address)
        self._log(f'Scanning for {address}…' if address else 'Scanning nearby Bluetooth advertisements for 8 seconds…')
        try:
            if address is None:
                discovered = await asyncio.wait_for(
                    BleakScanner.discover(timeout=8, return_adv=True, **_scan_options()), timeout=15)
                results = discovered.values()
            else:
                results = []

                def match(device, advertisement):
                    if device.address.upper() != address:
                        return False
                    results.append((device, advertisement))
                    return True

                await asyncio.wait_for(
                    BleakScanner.find_device_by_filter(match, timeout=8, **_scan_options()), timeout=15)
        except Exception as error:
            guidance = ('Allow Spur Ring in System Settings → Privacy & Security → Bluetooth, and check Bluetooth is enabled.'
                        if platform.system() == 'Darwin' else
                        'Check Bluetooth is enabled and a BLE adapter is available.')
            raise RuntimeError(f'Bluetooth scan failed: {error}. {guidance}') from error
        found = []
        if not preserve_devices:
            self._devices.clear()
        for device, advertisement in results:
            name = advertisement.local_name or device.name or 'Unnamed Bluetooth device'
            services = {value.lower() for value in advertisement.service_uuids}
            # A selected ring can advertise without a name. Connect verifies FE02
            # and the binding reply before allowing any recording request.
            compatible = (address is not None or device.address.upper() in known_addresses or
                          ADVERTISED_SERVICE_UUID.lower() in services or
                          SERVICE_UUID.lower() in services or
                          ('RING' in name.upper() and any(word in name.upper() for word in ('AIZO', 'DREAME', 'SPUR'))))
            if not compatible:
                continue
            self._devices[device.address] = device
            found.append({'id': device.address, 'name': name,
                          'rssi': advertisement.rssi, 'compatible': True})
        found.sort(key=lambda item: item['rssi'], reverse=True)
        self._log(f'Found {len(found)} possible Spur/AIZO ring(s).')
        return found

    async def connect(self, address: str):
        async with self._lifecycle_lock:
            await self._connect(address)

    async def _connect(self, address: str):
        from bleak import BleakClient
        if self._ble is not None:
            raise RuntimeError('A connection is already open or in progress.')
        device = self._devices.get(address)
        if device is None:
            raise RuntimeError('Scan and select a compatible ring first.')
        self._generation += 1
        generation = self._generation
        self._unexpected_disconnect = False
        self._codec.reset()
        self._working_state = None
        self._recording_in_progress = False
        self._ready_reported = False
        self._last_live_stamp = None
        self._live_stop_sent = True
        self._authenticated = False
        self._binding = None
        self._missing_ack_logged = False
        loop = asyncio.get_running_loop()
        self._queue = asyncio.Queue(maxsize=2048)
        self._auth_future = loop.create_future()
        backend_options = {'winrt': {'use_cached_services': False}} if platform.system() == 'Windows' else {}
        client = BleakClient(device, disconnected_callback=lambda closed: loop.call_soon_threadsafe(
            self._connection_lost, generation), timeout=20, **backend_options)
        self._ble = client
        self._state('connecting', 'Opening the ring’s Bluetooth service…')
        link_opened = False
        try:
            await asyncio.wait_for(client.connect(), timeout=25)
            link_opened = True
            service = client.services.get_service(SERVICE_UUID)
            if service is None:
                raise RuntimeError('This device does not expose the expected AIZO FE02 service.')
            # The original SDK's addGattHelper silently skips an absent 010B.
            # Some AIZO firmware exposes only the command/notification pair.
            for required in (COMMAND_UUID, RESPONSE_UUID):
                if client.services.get_characteristic(required) is None:
                    raise RuntimeError(f'Required AIZO characteristic is missing: {required}')
            self._reader = asyncio.create_task(self._read_notifications(generation))
            for channel in (RESPONSE_UUID, SECOND_RESPONSE_UUID):
                characteristic = client.services.get_characteristic(channel)
                if characteristic is None:
                    continue
                if not any(flag in characteristic.properties for flag in ('notify', 'indicate')):
                    raise RuntimeError(f'Response characteristic is not notifiable: {channel}')
                await asyncio.wait_for(client.start_notify(characteristic,
                    lambda sender, data, channel=channel: self._enqueue(loop, generation, channel, data)), timeout=10)
            self._state('authenticating', 'Authenticating with the ring…')
            # Match the original SDK's GATT-settle delay and auth timeout.
            await asyncio.sleep(0.5)
            now = datetime.now().astimezone()
            self._binding = build_binding_request(self.storage.app_id, now,
                int(now.utcoffset().total_seconds() // 60))
            await self._send(self._binding.payload)
            await asyncio.wait_for(self._auth_future, timeout=AUTHENTICATION_TIMEOUT)
            self._require_link(client, generation)
            self._authenticated = True
            self._state('connected', f'Authenticated ring {device.address}. Ready to sync.', address=device.address)
            self._log('Authenticated directly over Bluetooth. No phone or cloud connection is used.')
        except asyncio.TimeoutError as error:
            phase = self._status
            lost = self._unexpected_disconnect or (link_opened and not client.is_connected)
            await self._disconnect()
            if lost:
                raise RingDisconnectedError() from error
            if phase == 'authenticating':
                raise RuntimeError('The ring did not complete authentication. Keep it awake and near the PC, and make sure its mobile connection is closed.') from error
            raise RuntimeError('The Bluetooth connection timed out. Keep the ring awake and near the PC, then try again.') from error
        except BaseException as error:
            # A backend can report a GATT failure before its disconnect callback.
            lost = self._unexpected_disconnect or (link_opened and not client.is_connected)
            await self._disconnect()
            if lost and isinstance(error, Exception) and not isinstance(error, (ProtocolError, RuntimeError)):
                raise RingDisconnectedError() from error
            raise
        finally:
            if self._auth_future is not None and self._auth_future.done() and not self._auth_future.cancelled():
                self._auth_future.exception()
            self._auth_future = None

    def _enqueue(self, loop, generation, channel, data):
        def enqueue():
            if generation != self._generation or self._queue is None:
                return
            try:
                self._queue.put_nowait((channel, bytes(data)))
            except asyncio.QueueFull:
                self._abort(RuntimeError('Bluetooth receive queue overflowed; sync was stopped.'))
                asyncio.create_task(self._disconnect_generation(generation))
        loop.call_soon_threadsafe(enqueue)

    def _connection_lost(self, generation):
        if generation != self._generation or self._unexpected_disconnect or self._releasing_link:
            return
        self._unexpected_disconnect = True
        self._authenticated = False
        self._dictation_intent += 1
        self._dictation_armed = False
        self._live_requested = False
        self._reset_live()
        self._emit('dictation-state', armed=False)
        self._abort(RingDisconnectedError())
        self._state('disconnected', 'The ring disconnected.')
        # Clear this connection before permitting another explicit Connect action.
        asyncio.create_task(self._disconnect_generation(generation))

    def _abort(self, error: Exception):
        for future in (self._auth_future, self._summary_future, self._sync_future, self._touch_future):
            if future is not None and not future.done():
                future.set_exception(error)

    async def _read_notifications(self, generation):
        try:
            while generation == self._generation:
                channel, data = await self._queue.get()
                packets = self._codec.feed(channel, data)
                for packet in packets:
                    if not packet.crc_valid:
                        if packet.ack_required:
                            await self._write_packet(make_ack(packet, 1), ACK_UUID)
                        self._log('Discarded a corrupt Bluetooth frame; waiting for retransmission.')
                        continue
                    # The vendor retains sender/destination/version as metadata;
                    # it dispatches hex responses regardless of those fields.
                    if packet.payload_type != 1:
                        self._log('Ignored a non-hex protocol message.')
                        continue
                    if packet.command_type == 2 and len(packet.payload) == 1:
                        # The manufacturer decoder does not interpret this byte
                        # as an authentication result. This firmware sends FF;
                        # keep waiting for the validated 70 70 binding reply.
                        self._log(f'Ring transport ACK 0x{packet.payload[0]:02X} (sequence {packet.sequence}, protocol {packet.version}).')
                        continue
                    if packet.ack_required:
                        await self._write_packet(make_ack(packet), ACK_UUID)
                    await self._handle_payload(packet.payload)
        except asyncio.CancelledError:
            raise
        except Exception as error:
            if generation != self._generation:
                return
            self._log(f'Protocol receive failed: {error}')
            self._emit('error', message=str(error))
            self._abort(error)
            # Framing errors must not leave the UI claiming a usable connection.
            asyncio.create_task(self._disconnect_generation(generation))

    async def _handle_payload(self, payload: bytes):
        if payload.startswith(b'\x70\x70'):
            if self._binding is None or self._auth_future is None or self._auth_future.done():
                return
            response = parse_binding_response(payload)
            validate_binding_response(self._binding, response)
            confirmation = binding_confirmation(self._binding, response)
            if confirmation is not None:
                await self._send(confirmation)
            if self._auth_future is not None and not self._auth_future.done():
                self._auth_future.set_result(None)
            return
        if payload.startswith(b'\x81\x64'):
            if self._touch_future is not None and not self._touch_future.done():
                if len(payload) >= 3 and payload[2] == 1:
                    self._touch_future.set_result(None)
                else:
                    self._touch_future.set_exception(RuntimeError('The ring rejected touch reporting (8164).'))
            return
        if payload.startswith(b'\x81\x61'):
            try:
                events = parse_touch_events(payload)
            except ValueError:
                await self._send(b'\x81\x62\x02')
                self._log('Ignored an incomplete ring touch-event notification.')
                return
            await self._send(b'\x81\x62\x01')
            if self._authenticated:
                for event in events:
                    self._emit('ring-touch', event=event.event, action=event.action,
                               time_bytes=event.time_bytes.hex())
                    if self._dictation_armed and event.dictation_action:
                        await self._physical_trigger(event.dictation_action, 'touch')
                    if event.dictation_action == 'start':
                        self._recording_in_progress = True
                        self._ready_reported = False
                    elif event.dictation_action == 'stop' and self._recording_in_progress:
                        # Some rings report release without a following ready state.
                        self._working_state = 4
                        self._recording_ready('touch')
            return
        if payload.startswith(b'\xaa\x11'):
            if len(payload) < 4:
                await self._send(b'\xaa\x12\x00')
                return
            await self._send(b'\xaa\x12\x01')
            if payload[2] == 1:
                last_state = self._working_state
                self._working_state = payload[3]
                name = STATE_NAMES.get(payload[3], f'unknown ({payload[3]})')
                self._log('Ring state: ' + name)
                if self._authenticated:
                    self._emit('ring-state', state=payload[3], name=name,
                               remaining_time=int.from_bytes(payload[4:6], 'big') if len(payload) >= 6 else None)
                    if self._dictation_armed and payload[3] in (2, 4):
                        await self._physical_trigger('start' if payload[3] == 2 else 'stop', 'state')
                    elif self._dictation_armed and self._live_requested and payload[3] == 1 and last_state != 1:
                        # AIZO 3.2.1 begins the real-time upload here. Older SDK
                        # versions call this idle. Wait for dated audio to confirm.
                        await self._physical_trigger('start', 'state', probe=True)
                    if payload[3] in (2, 3):
                        self._recording_in_progress = True
                        self._ready_reported = False
                    elif payload[3] == 4:
                        self._recording_ready('state')
                    elif payload[3] in (0, 1) and self._sync_future is None and last_state != 5:
                        # State 1 is the only start cue on some firmware. State 0
                        # during an inventory query is housekeeping, not a new take.
                        self._ready_reported = False
                if payload[3] in (2, 3) and self._sync_future is not None:
                    self._abort(RuntimeError('The ring is recording or paused; stop recording before syncing.'))
            return
        if payload.startswith(b'\xaa\x14'):
            if self._summary_future is not None and not self._summary_future.done():
                if len(payload) < 9 or payload[2] != 1:
                    self._summary_future.set_exception(RuntimeError('Invalid ring recording-storage response.'))
                else:
                    self._summary_future.set_result({'count': int.from_bytes(payload[3:5], 'big'),
                                                     'bytes': int.from_bytes(payload[5:9], 'big')})
            return
        if payload[:2] in (b'\xac\x22', b'\xac\x24', b'\xac\x52', b'\xac\x54'):
            if self._live is not None and payload[1] in (0x52, 0x54):
                await self._receive_live(payload)
                return
            if self._sync_future is None or self._sync_future.done() or self._transfer is None:
                return
            realtime = payload[1] in (0x52, 0x54)
            if self._legacy_empty and not realtime:
                return
            transfer = self._realtime if realtime else self._transfer
            if transfer is None or (self._transfer_protocol is not None and self._transfer_protocol is not transfer):
                return
            if payload[1] in (0x22, 0x52):
                self._transfer_protocol = transfer
            generation, future = self._generation, self._sync_future
            # The transfer layer persists bytes before emitting a successful end ACK.
            try:
                update = await asyncio.to_thread(transfer.feed, payload)
            except (ValueError, OSError) as error:
                if not future.done():
                    future.set_exception(error)
                return
            if generation != self._generation or future is not self._sync_future or future.done():
                return
            if update.error:
                future.set_exception(RuntimeError(update.error))
                return
            for warning in update.warnings:
                self._log(warning)
            self._last_sync_activity = asyncio.get_running_loop().time()
            # Completed files are already durable. Publish them even if the link
            # drops during the end acknowledgement or the next-file request.
            for file in update.completed:
                if file.ogg_path is not None:
                    self._emit('recording', file={'name': file.ogg_path.name,
                        'path': str(file.ogg_path), 'size': file.ogg_path.stat().st_size,
                        'timestamp': file.timestamp})
                self._log(f'Saved recording {file.raw_path.name}.')
                if file.metadata and file.metadata.trailing_bytes:
                    self._log(f'The vendor audio container included {file.metadata.trailing_bytes} trailing bytes; they remain in the saved raw file.')
            for command in update.commands:
                if command[:2] == b'\xac\x21' and update.completed:
                    await asyncio.sleep(0.5)
                if future.done() or generation != self._generation:
                    return
                await self._send(command, self._file_channel)
            if future.done() or generation != self._generation:
                return
            if update.progress:
                self._emit('progress', progress=update.progress.percent)
            if update.finished and not realtime and not transfer.completed_files:
                self._legacy_empty = True
                await self._query_realtime()
            elif update.finished:
                if realtime and not transfer.completed_files and not self._legacy_empty:
                    future.set_exception(RuntimeError('The real-time queue is empty, but the ring did not confirm its stored recording queue.'))
                else:
                    future.set_result(None)
            return
        self._log(f'Received ring message {payload[:2].hex().upper()} ({len(payload)} bytes).')

    def _reset_live(self):
        if self._live_end_timer is not None:
            self._live_end_timer.cancel()
            self._live_end_timer = None
        self._live = None
        self._live_done.set()

    def _expire_live(self, take):
        if self._live is take:
            if take.announced:
                self._emit('ring-live-error', timestamp=take.transfer.timestamp,
                           message='The ring did not finish the live audio transfer. Its saved recording can still be synced.')
            self._reset_live()

    def _file_endpoint(self):
        dedicated = self._ble.services.get_characteristic(SECOND_COMMAND_UUID)
        return (SECOND_COMMAND_UUID if dedicated and
                {'write', 'write-without-response'}.intersection(dedicated.properties) else COMMAND_UUID)

    def _recording_ready(self, source):
        if self._ready_reported or not self._authenticated or self._ble is None:
            return
        observed_take = self._recording_in_progress
        self._ready_reported = True
        self._recording_in_progress = False
        # Ignore inventory/transfer echoes unless an actual new take intervened.
        if self._sync_future is None or observed_take:
            self._emit('recording-ready', address=self._ble.address, source=source)

    async def _physical_trigger(self, action, source, *, probe=False):
        if not self._live_requested:
            self._emit('dictation-trigger', action=action, source=source)
            return
        if action == 'stop':
            if not self._live_stop_sent:
                self._live_stop_sent = True
                self._emit('dictation-trigger', action=action, source=source)
            if self._live is not None and not self._live.stopped:
                if self._live_end_timer is not None:
                    self._live_end_timer.cancel()
                self._live.stopped = True
                self._live_end_timer = asyncio.get_running_loop().call_later(LIVE_END_GRACE, self._expire_live, self._live)
            return
        if self._sync_future is not None:
            return
        if self._live is not None and self._live.stopped:
            if probe:
                return
            self._expire_live(self._live)
        take = self._live
        if take is not None and not take.announced and not probe and time.time() - take.started > 3:
            self._reset_live()  # A previous idle-state probe produced no audio.
            take = None
        first = take is None
        if first:
            address = ''.join(char for char in self._ble.address if char.isalnum())
            take = self._live = LiveRingRecording(self.storage.recordings / address, time.time())
            self._live_done.clear()
            if probe:
                self._live_end_timer = asyncio.get_running_loop().call_later(
                    FIRST_PACKET_TIMEOUT, self._expire_live, take)
        if not probe and not take.announced:
            if self._live_end_timer is not None:
                self._live_end_timer.cancel()
                self._live_end_timer = None
            take.announced = True
            self._live_stop_sent = False
            self._emit('dictation-trigger', action='start', source=source)
        if first:
            try:
                await self._send(REALTIME_QUERY, self._file_endpoint())
            except Exception as error:
                if self._live is take:
                    self._reset_live()
                    if take.announced:
                        self._emit('ring-live-error', message=str(error))

    async def _receive_live(self, payload):
        take = self._live
        if not take.accepts(payload):
            return
        stamp = int.from_bytes(payload[3:7], 'big')
        if stamp == self._last_live_stamp or (take.stopped and not take.announced):
            return
        try:
            if payload[1] == 0x52:
                take.transfer.feed(payload)
                if not take.announced:
                    if self._live_end_timer is not None:
                        self._live_end_timer.cancel()
                        self._live_end_timer = None
                    take.announced = True
                    self._live_stop_sent = False
                    self._emit('dictation-trigger', action='start', source='state')
                for packet in take.ready_packets():
                    self._emit('ring-opus', **packet)
                return
            # A successful end ACK permits the ring to discard the recording.
            # Persist and verify the entire file first, as in ordinary sync.
            update = await asyncio.to_thread(take.transfer.feed, payload)
            if self._live is not take or not self._authenticated:
                return
            for file in update.completed:
                self._emit('recording', file={'name': file.ogg_path.name, 'path': str(file.ogg_path),
                           'size': file.ogg_path.stat().st_size, 'timestamp': file.timestamp})
            await self._send(update.commands[0], self._file_endpoint())
            if self._live is take:
                self._last_live_stamp = stamp
                self._recording_in_progress = False
                self._ready_reported = True
                if take.announced:
                    self._emit('ring-live-end', timestamp=stamp)
                    # Firmware can finish the stream without a separate release
                    # notification. AC54 has verified the same physical take.
                    if not self._live_stop_sent:
                        self._live_stop_sent = True
                        self._working_state = 4
                        self._emit('dictation-trigger', action='stop', source='audio-end')
                self._reset_live()  # Do not request another take from the queue.
        except Exception as error:
            if self._live is take:
                self._reset_live()
                if take.announced:
                    self._emit('ring-live-error', timestamp=stamp, message=str(error))

    def _require_link(self, client, generation):
        if self._unexpected_disconnect:
            raise RingDisconnectedError()
        if client is None or generation != self._generation or client is not self._ble:
            raise RuntimeError('The ring is not connected.')
        if not client.is_connected:
            self._connection_lost(generation)
            raise RingDisconnectedError()

    async def _write_packet(self, packet: Packet, channel=COMMAND_UUID):
        client, generation = self._ble, self._generation
        self._require_link(client, generation)
        characteristic = client.services.get_characteristic(channel)
        if characteristic is None:
            if channel == ACK_UUID:
                if not self._missing_ack_logged:
                    self._log('This ring omits the optional 010B ACK channel; using the manufacturer SDK behavior.')
                    self._missing_ack_logged = True
                return
            raise RuntimeError(f'Required AIZO write characteristic is missing: {channel}')
        response = 'write-without-response' not in characteristic.properties
        wire = encode_packet(packet)
        async with self._write_lock:
            self._require_link(client, generation)
            def write_limit():
                return (client.mtu_size - 3 if response else
                        characteristic.max_write_without_response_size)

            # The host negotiates the ATT size. The working mobile SDK requests
            # MTU 247 and sends this ring's 76-byte binding frame in one write.
            # Arbitrary 20-byte slicing provokes ACK FF and no binding response.
            deadline = asyncio.get_running_loop().time() + 2
            limit = write_limit()
            while len(wire) > limit and asyncio.get_running_loop().time() < deadline:
                await asyncio.sleep(0.05)
                self._require_link(client, generation)
                limit = write_limit()
            if len(wire) > limit:
                raise RuntimeError(f'The Bluetooth write size is too small ({limit} bytes; this command needs {len(wire)}). Reconnect the ring to renegotiate its packet size.')
            try:
                await asyncio.wait_for(client.write_gatt_char(characteristic, wire, response=response), timeout=8)
            except Exception:
                self._require_link(client, generation)
                raise
            await asyncio.sleep(0.1)

    async def _send(self, payload: bytes, channel=COMMAND_UUID):
        sequence = self._sequence
        self._sequence = next_sequence(sequence)
        await self._write_packet(Packet(payload=payload, sequence=sequence), channel)

    async def _query_realtime(self):
        if self._realtime is None:
            self._realtime = RealtimeRecordingTransfer(self._transfer.output_dir)
            self._last_sync_activity = asyncio.get_running_loop().time()
            self._log('Checking the AIZO real-time recording queue (AC51).')
            await self._send(REALTIME_QUERY, self._file_channel)

    async def sync(self, *, stored_only_if_reported=False):
        client, generation = self._ble, self._generation
        if not self._authenticated and not self._unexpected_disconnect:
            raise RuntimeError('Connect and authenticate the ring first.')
        self._require_link(client, generation)
        if self._sync_future is not None:
            raise RuntimeError('A recording sync is already running.')
        while self._live is not None:
            if self._live.stopped:
                await self._live_done.wait()  # Physical release starts a bounded grace timer.
                self._require_link(client, generation)
            elif self._live.announced:
                raise RuntimeError('Stop recording before syncing.')
            else:
                self._reset_live()  # An unconfirmed idle-state probe yields to explicit sync.
        # This firmware also emits state 0 during an authenticated inventory
        # check. Like a missing state, it supplies no recording/paused signal.
        if self._working_state not in (None, 0, 1, 4):
            raise RuntimeError('Stop recording and wait until the ring is idle before syncing.')
        loop = asyncio.get_running_loop()
        self._sync_future = loop.create_future()
        self._summary_future = loop.create_future()
        self._legacy_empty = False
        self._transfer_protocol = None
        self._state('syncing', 'Checking ring recordings…')
        self._emit('progress', progress=0)
        try:
            ready_before_query = self._working_state == 4 or self._ready_reported
            await self._send(b'\xaa\x13\x01')
            try:
                summary = await asyncio.wait_for(self._summary_future, timeout=SUMMARY_TIMEOUT)
                self._log(f'Ring reports {summary["count"]} recording(s), {summary["bytes"]} bytes.')
            except asyncio.TimeoutError:
                summary = None
                self._log('No storage summary received. Requesting recordings directly.')
            # Isolate transfer caches by device; do not mix cached data from two rings.
            if self._sync_future.done():
                await self._sync_future
            self._require_link(client, generation)
            if (stored_only_if_reported and summary == {'count': 0, 'bytes': 0}
                    and not ready_before_query and not self._ready_reported and self._working_state != 4):
                self._emit('progress', progress=100)
                return {'reported': 0, 'received': 0, 'inventoryOnly': True,
                        'notice': 'The ring reported no stored recordings.'}
            address = ''.join(character for character in client.address if character.isalnum())
            output = self.storage.recordings / address
            # Vendor BtHelper.requestHex(bytes, "") routes AC21/23/25 through HEX_WRITE_ECG.
            self._file_channel = self._file_endpoint()
            self._log(f'Recording transfer write channel: {self._file_channel[4:8]}.')
            self._transfer = RecordingTransfer(output, padded_request=False)
            self._log('Requesting stored recordings (AIZO 3.2.1, 12-byte AC21).')
            self._last_sync_activity = loop.time()
            for command in self._transfer.start(resume=False):
                await self._send(command, self._file_channel)
            realtime_unconfirmed = False
            while not self._sync_future.done():
                await asyncio.wait((self._sync_future,), timeout=1)
                if self._sync_future.done():
                    break
                self._require_link(client, generation)
                if (self._transfer_protocol is None
                        and loop.time() - self._last_sync_activity > FIRST_PACKET_TIMEOUT):
                    if not self._transfer.padded_request and not self._legacy_empty:
                        self._log('No file reply to 12-byte AC21. Trying the older 16-byte AC21.')
                        self._transfer.padded_request = True
                        self._last_sync_activity = loop.time()
                        for command in self._transfer.start(resume=False):
                            await self._send(command, self._file_channel)
                    elif self._realtime is None:
                        await self._query_realtime()
                    elif self._legacy_empty:
                        realtime_unconfirmed = True
                        self._log('The legacy queue confirmed empty. The real-time query received no reply.')
                        self._sync_future.set_result(None)
                    else:
                        inventory = (f'The ring reported {summary["count"]} recording(s) and {summary["bytes"]} bytes.'
                                     if summary is not None else 'The ring did not return a storage count.')
                        raise RuntimeError(f'Ring {client.address} authenticated. {inventory} No file reply arrived on either recording protocol. The recording queue is unverified.')
                if loop.time() - self._last_sync_activity > 180:
                    raise asyncio.TimeoutError()
            await self._sync_future
            received = self._transfer.completed_files + (self._realtime.completed_files if self._realtime else 0)
            if summary and (received < summary['count'] or (received == 0 and summary['bytes'] > 0)):
                raise RuntimeError(f'The ring reported {summary["count"]} recording(s) ({summary["bytes"]} bytes) but delivered {received}. Completed files are saved. Retry sync for missing recordings.')
            self._emit('progress', progress=100)
            self._log('Recording sync completed.')
            result = {'reported': summary['count'] if summary else None, 'received': received}
            if realtime_unconfirmed:
                result['notice'] = 'The stored recording queue is empty. The ring did not answer the real-time recording query.'
            return result
        except asyncio.TimeoutError as error:
            raise RuntimeError('The ring stopped responding during sync. Completed recordings are retained; retry sync to download again.') from error
        finally:
            # Consume a failure that may have arrived while awaiting the summary.
            if self._sync_future is not None and self._sync_future.done() and not self._sync_future.cancelled():
                self._sync_future.exception()
            elif self._sync_future is not None:
                self._sync_future.cancel()
            if self._summary_future is not None and self._summary_future.done() and not self._summary_future.cancelled():
                self._summary_future.exception()
            self._sync_future = None
            self._summary_future = None
            if self._transfer is not None:
                self._transfer.stop()
            self._transfer = None
            self._realtime = None
            self._transfer_protocol = None
            if generation == self._generation and self._authenticated:
                self._state('connected', 'Ready to sync.')

    async def disconnect(self):
        # Do not wait out an outstanding 8164 acknowledgment before closing GATT.
        self._dictation_intent += 1
        if self._touch_future is not None and not self._touch_future.done():
            self._touch_future.set_exception(RuntimeError('Ring controls were stopped by disconnect.'))
        async with self._lifecycle_lock:
            self._unexpected_disconnect = False
            await self._disconnect()

    async def _disconnect_generation(self, generation):
        async with self._lifecycle_lock:
            if generation == self._generation:
                try:
                    await self._disconnect()
                except RuntimeError as error:
                    self._emit('error', message=str(error))

    async def _disconnect(self):
        self._dictation_intent += 1
        self._dictation_armed = False
        self._live_requested = False
        self._reset_live()
        self._emit('dictation-state', armed=False)
        # Disable only if this explicit dictation session requested reporting.
        # Do not wait on a reply while tearing down the notification reader.
        if self._touch_reporting_requested and self._ble is not None and self._ble.is_connected:
            with suppress(Exception):
                await asyncio.wait_for(self._send(b'\x81\x63\x00'), timeout=1)
        self._touch_reporting_requested = False
        self._authenticated = False
        self._abort(RuntimeError('Connection closed.'))
        client = self._ble
        reader, self._reader = self._reader, None
        if reader is not None and reader is not asyncio.current_task():
            reader.cancel()
            with suppress(asyncio.CancelledError, Exception):
                await reader
        self._queue = None
        self._binding = None
        self._codec.reset()
        if client is not None:
            # WinRT synthesizes its disconnect callback before GATT teardown
            # completes. Only report success once the client releases its session.
            self._releasing_link = True
            try:
                with suppress(Exception):
                    await asyncio.wait_for(client.disconnect(), timeout=5)
                if client.is_connected:
                    raise RuntimeError('Bluetooth still has the ring connection open. Select Disconnect to retry.')
            finally:
                self._releasing_link = False
        self._ble = None
        self._generation += 1
        self._state('disconnected', 'Ring disconnected.')
