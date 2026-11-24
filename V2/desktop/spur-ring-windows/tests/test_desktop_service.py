"""Desktop IPC dispatch checks without Bluetooth or native input side effects."""

import asyncio
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

from spur_ring.desktop_service import DesktopService, MAX_LINE_BYTES, default_data_dir
from spur_ring.protocol import AuthenticationError
from spur_ring.transport import RingDisconnectedError


class FakeClient:
    def __init__(self, data_dir, on_event):
        self.data_dir = data_dir
        self.on_event = on_event
        self.calls = []
        self.scan_started = asyncio.Event()
        self.finish_scan = asyncio.Event()

    async def scan(self):
        self.calls.append("scan")
        self.scan_started.set()
        await self.finish_scan.wait()
        self.on_event({"type": "log", "message": "Scan complete"})
        return [{"id": "AA:BB", "name": "AIZO-RING"}]

    async def connect(self, address):
        self.calls.append(("connect", address))

    async def disconnect(self):
        self.calls.append("disconnect")

    async def sync(self):
        self.calls.append("sync")
        return {"reported": 1, "received": 1}

    async def arm_dictation(self, *, live_ring_audio=False):
        self.calls.append("arm-live" if live_ring_audio else "arm")

    async def disarm_dictation(self):
        self.calls.append("disarm")

    def list_recordings(self):
        return [{"name": "voice.ogg", "path": "C:/owned/voice.ogg"}]


class DesktopServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.output = []
        self.service = DesktopService(Path(self.temporary.name), self.output.append, FakeClient)

    async def asyncTearDown(self):
        await self.service.close()

    async def request(self, method, params=None, request_id="one"):
        self.service.accept(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        task = self.service._pending.get(request_id)
        if task:
            await task
        return next(record for record in reversed(self.output) if record.get("id") == request_id)

    async def test_info_does_not_start_bluetooth(self):
        response = await self.request("getInfo")
        self.assertIn("version", response["result"])
        self.assertEqual(self.service.client.calls, [])

    async def test_desktop_live_arm_explicitly_enables_ring_audio(self):
        for platform in ("win32", "darwin"):
            with self.subTest(platform=platform), patch("spur_ring.desktop_service.sys.platform", platform):
                result = await self.request("armDictation", {"liveRingAudio": True})
                self.assertTrue(result["result"]["armed"])
        self.assertEqual(self.service.client.calls, ["arm-live", "arm-live"])

    async def test_explicit_connection_and_sync(self):
        self.assertEqual((await self.request("connect", {"address": "AA:BB"}))["result"], {"connected": True})
        result = await self.request("sync")
        self.assertEqual(result["result"][0]["name"], "voice.ogg")
        self.assertEqual(self.service.client.calls, [("connect", "AA:BB"), "sync"])

    async def test_reconnect_catchup_is_opt_in_and_does_not_change_manual_sync(self):
        with patch.object(self.service.client, 'sync', AsyncMock(return_value={'received': 0})) as sync:
            await self.request('syncRecordings', {'storedOnlyIfReported': True})
            sync.assert_awaited_once_with(stored_only_if_reported=True)
            sync.reset_mock()
            await self.request('syncRecordings')
            sync.assert_awaited_once_with()

    async def test_connect_and_sync_immediately_pulls_from_the_selected_ring(self):
        result = await self.request("connectAndSync", {"address": "AA:BB"})
        self.assertEqual(result["result"], {"reported": 1, "received": 1})
        self.assertEqual(self.service.client.calls, [("connect", "AA:BB"), "sync"])

    async def test_restore_authenticates_only_the_exact_address(self):
        address = "AA:BB:CC:DD:EE:01"
        client = self.service.client
        results = [{"id": "AA:BB:CC:DD:EE:02", "name": "Spur Ring"}, {"id": address.lower(), "name": "Spur Ring"}]
        with patch("spur_ring.desktop_service.sys.platform", "win32"), \
                patch.object(client, "scan", AsyncMock(return_value=results)) as scan:
            response = await self.request("reconnectSavedRing", {"address": address.lower()})
        scan.assert_awaited_once_with(address, preserve_devices=True)
        self.assertEqual(response["result"], {"connected": True})
        self.assertEqual(client.calls, [("connect", address.lower())])
        self.assertEqual(self.service._selected_address, address.lower())

    async def test_generic_windows_scan_accepts_only_explicit_labelled_addresses(self):
        address = "AA:BB:CC:DD:EE:02"
        with patch("spur_ring.desktop_service.sys.platform", "win32"), \
                patch.object(self.service.client, "scan", AsyncMock(return_value=[])) as scan:
            await self.request("scan", {"knownAddresses": [address.lower(), address]})
            scan.assert_awaited_once_with(known_addresses=frozenset({address}))
            for invalid in (address, ["wrong"], [1]):
                self.assertIn("error", await self.request("scan", {"knownAddresses": invalid}))
            self.assertEqual(scan.await_count, 1)
            await self.request("scan", {"address": address, "knownAddresses": [address]})
            scan.assert_awaited_with(address)
        with patch("spur_ring.desktop_service.sys.platform", "darwin"), \
                patch.object(self.service.client, "scan", AsyncMock(return_value=[])) as scan:
            await self.request("scan", {"knownAddresses": [address]})
            scan.assert_awaited_once_with()

    async def test_restore_finds_the_mac_selected_corebluetooth_identifier(self):
        address = "b84172e1-85c2-42ad-8345-9493302ec18a"
        with patch("spur_ring.desktop_service.sys.platform", "darwin"), \
                patch.object(self.service.client, "scan", AsyncMock(return_value=[{"id": address}])) as scan:
            result = await self.request("reconnectSavedRing", {"address": address})
        scan.assert_awaited_once_with(address.upper(), preserve_devices=True)
        self.assertEqual(result["result"], {"connected": True})
        self.assertEqual(self.service.client.calls, [("connect", address)])

    async def test_restore_requires_a_valid_platform_identifier_before_scanning(self):
        with patch.object(self.service.client, "scan", AsyncMock()) as scan:
            for platform, address in (("darwin", "AA:BB:CC:DD:EE:01"), ("win32", None), ("win32", "not a MAC")):
                with self.subTest(platform=platform, address=address), patch("spur_ring.desktop_service.sys.platform", platform):
                    self.assertIn("error", await self.request("reconnectSavedRing", {"address": address}))
            scan.assert_not_awaited()

    async def test_restore_reports_offline_or_rejected_without_connecting_to_another_ring(self):
        address = "AA:BB:CC:DD:EE:01"
        client = self.service.client
        with patch("spur_ring.desktop_service.sys.platform", "win32"), \
                patch.object(client, "scan", AsyncMock(side_effect=[[{"id": "AA:BB:CC:DD:EE:02"}], [{"id": address}]])), \
                patch.object(client, "connect", AsyncMock(side_effect=AuthenticationError("binding rejected"))) as connect:
            offline = await self.request("reconnectSavedRing", {"address": address})
            self.assertEqual(offline["result"], {"connected": False, "reason": "not-found"})
            connect.assert_not_awaited()
            refused = await self.request("reconnectSavedRing", {"address": address})
            self.assertEqual(refused["result"], {"connected": False, "reason": "authentication-rejected", "message": "binding rejected"})
            connect.assert_awaited_once_with(address)
            self.assertIsNone(self.service._selected_address)

    async def test_manual_disconnect_cancels_background_restore_and_sync_cannot_overlap(self):
        address = "AA:BB:CC:DD:EE:01"
        client = self.service.client
        scanning = asyncio.Event()
        async def scan(*args, **kwargs):
            scanning.set()
            await asyncio.Future()
        with patch("spur_ring.desktop_service.sys.platform", "win32"), patch.object(client, "scan", scan):
            self.service.accept(json.dumps({"id": "restore", "method": "reconnectSavedRing", "params": {"address": address}}))
            await asyncio.wait_for(scanning.wait(), 2)
            self.assertIn("already running", (await self.request("syncRecordings"))["error"])
            self.assertIn("already running", (await self.request("connectAndSync", {"address": address}))["error"])
            await self.request("disconnect")
        self.assertIn({"kind": "result", "id": "restore", "error": "The operation was cancelled."}, self.output)
        self.assertEqual(client.calls, ["disconnect"])

    async def test_link_loss_reconnects_to_same_ring_once_and_counts_distinct_files(self):
        client = self.service.client
        await self.request("connect", {"address": "AA:BB"})
        async def sync():
            client.calls.append("sync")
            if client.calls.count("sync") == 1:
                client.on_event({"type": "recording", "file": {"path": "a.ogg"}})
                raise RingDisconnectedError()
            for path in ("a.ogg", "b.ogg"):
                client.on_event({"type": "recording", "file": {"path": path}})
            return {"reported": 2, "received": 2}
        with patch.object(client, "sync", sync):
            result = await self.request("syncRecordings")
        self.assertEqual(result["result"]["received"], 2)
        self.assertEqual(client.calls, [("connect", "AA:BB"), "sync", "disconnect", ("connect", "AA:BB"), "sync"])

    async def test_repeated_drop_stops_and_protocol_errors_do_not_retry(self):
        client = self.service.client
        with patch.object(client, "sync", AsyncMock(side_effect=RingDisconnectedError())) as sync:
            result = await self.request("connectAndSync", {"address": "AA:BB"})
        self.assertIn("disconnected", result["error"])
        self.assertEqual(sync.await_count, 2)
        client.calls.clear()
        with patch.object(client, "sync", AsyncMock(side_effect=RuntimeError("No file reply"))) as sync:
            result = await self.request("syncRecordings")
        self.assertIn("No file reply", result["error"])
        sync.assert_awaited_once()
        self.assertEqual(client.calls, [])

    async def test_explicit_disconnect_cancels_transfer_without_reconnecting(self):
        client = self.service.client
        started = asyncio.Event()
        async def sync():
            started.set()
            await asyncio.Future()
        with patch.object(client, "sync", sync):
            self.service.accept(json.dumps({"id": "transfer", "method": "connectAndSync", "params": {"address": "AA:BB"}}))
            await asyncio.wait_for(started.wait(), 2)
            blocked = await self.request("connectAndSync", {"address": "CC:DD"})
            self.assertIn("already running", blocked["error"])
            self.assertIn("already running", (await self.request("reconnectSavedRing", {"address": "AA:BB:CC:DD:EE:01"}))["error"])
            await self.request("disconnect")
        self.assertIn({"kind": "result", "id": "transfer", "error": "The operation was cancelled."}, self.output)
        self.assertEqual(client.calls, [("connect", "AA:BB"), "disconnect"])

    async def test_disconnect_cancels_an_inflight_scan(self):
        self.service.accept(json.dumps({"id": "scan", "method": "scan"}))
        await self.service.client.scan_started.wait()
        await self.request("disconnect")
        self.assertIn("disconnect", self.service.client.calls)
        self.assertIn({"kind": "result", "id": "scan", "error": "The operation was cancelled."}, self.output)
        self.assertNotIn("scan", self.service._pending)

    async def test_disconnect_cancels_manual_connect_and_blocks_reconnect_during_release(self):
        connecting = asyncio.Event()
        releasing = asyncio.Event()
        finish_release = asyncio.Event()

        async def blocked_connect(address):
            connecting.set()
            await asyncio.Future()

        async def release():
            releasing.set()
            await finish_release.wait()

        with patch.object(self.service.client, "connect", side_effect=blocked_connect), \
                patch.object(self.service.client, "disconnect", side_effect=release):
            self.service.accept(json.dumps({"id": "connecting", "method": "connect", "params": {"address": "AA:BB"}}))
            await asyncio.wait_for(connecting.wait(), 2)
            stopped = asyncio.create_task(self.request("disconnect", request_id="stop"))
            await asyncio.wait_for(releasing.wait(), 2)
            self.assertIn({"kind": "result", "id": "connecting", "error": "The operation was cancelled."}, self.output)
            self.assertIn("already running", (await self.request("connect", {"address": "AA:CC"}))["error"])
            finish_release.set()
            self.assertEqual((await stopped)["result"], {"connected": False})
        self.assertIsNone(self.service._selected_address)
        self.assertTrue((await self.request("connect", {"address": "AA:CC"}))["result"]["connected"])

    async def test_native_input_delegated_with_exact_target(self):
        target = {"handle": 123, "processId": 999, "label": "Editor"}
        with patch("spur_ring.desktop_service.sys.platform", "win32"), patch("spur_ring.desktop_service.windows_input.capture_target", return_value=target) as capture:
            self.assertEqual((await self.request("captureTarget", {"excludedProcessIds": [1234]}))["result"], target)
            capture.assert_called_once_with([1234])
        with patch("spur_ring.desktop_service.sys.platform", "win32"), patch("spur_ring.desktop_service.windows_input.insert_text", return_value={"inserted": True, "count": 2}) as insert:
            result = await self.request("insertText", {"target": target, "text": "你好"})
            self.assertTrue(result["result"]["inserted"])
            insert.assert_called_once_with(target, "你好")

    async def test_ring_dictation_arm_and_disarm_are_explicit(self):
        self.assertEqual((await self.request("armDictation"))["result"], {"armed": True})
        self.assertEqual((await self.request("disarmDictation"))["result"], {"armed": False})
        self.assertEqual(self.service.client.calls, ["arm", "disarm"])

    async def test_owned_native_self_test_only_runs_when_requested(self):
        with patch("spur_ring.desktop_service.sys.platform", "win32"), patch("spur_ring.desktop_service.windows_input.input_self_test", return_value={"verified": True}) as check:
            await self.request("getInfo")
            check.assert_not_called()
            self.assertEqual((await self.request("inputSelfTest"))["result"], {"verified": True})
            check.assert_called_once_with()

    async def test_macos_info_reports_supported_cursor_and_permission_without_prompt(self):
        permission = {"supported": True, "available": True, "required": True, "granted": False}
        with patch("spur_ring.desktop_service.sys.platform", "darwin"), patch("spur_ring.desktop_service.macos_input.permission_status", return_value=permission) as check:
            result = (await self.request("getInfo"))["result"]
            self.assertTrue(result["capabilities"]["cursorInsertion"])
            self.assertEqual(result["permissions"]["accessibility"], permission)
            check.assert_called_once_with(prompt=False)

    async def test_macos_explicit_permission_request_and_capture_use_mac_adapter(self):
        target = {"handle": 123, "processId": 123, "bundleIdentifier": "com.example.Editor", "label": "Editor"}
        with patch("spur_ring.desktop_service.sys.platform", "darwin"), patch("spur_ring.desktop_service.macos_input.permission_status", return_value={"granted": False}) as permissions, patch("spur_ring.desktop_service.macos_input.capture_target", return_value=target) as capture:
            await self.request("getInputPermissions")
            await self.request("requestInputPermissions")
            self.assertEqual([call.kwargs["prompt"] for call in permissions.call_args_list], [False, True])
            self.assertEqual((await self.request("captureTarget", {"excludedProcessIds": [999]}))["result"], target)
            capture.assert_called_once_with([999])

    async def test_macos_service_profile_uses_application_support(self):
        with patch("spur_ring.desktop_service.sys.platform", "darwin"), patch("spur_ring.desktop_service.Path.home", return_value=Path(self.temporary.name)):
            self.assertEqual(default_data_dir(), Path(self.temporary.name) / "Library" / "Application Support" / "Spur" / "RingDesktop")

    async def test_unsafe_or_unknown_method_is_not_evaluated(self):
        for method in ("__dict__", "eval", "__import__('os').system('anything')"):
            response = await self.request(method)
            self.assertIn("Unknown", response["error"])
        self.assertEqual(self.service.client.calls, [])

    async def test_invalid_native_parameters_rejected(self):
        self.assertIn("error", await self.request("captureTarget", {"excludedProcessIds": [True]}))
        self.assertIn("error", await self.request("insertText", {"target": {}, "text": 123}))
        self.assertIn("error", await self.request("connect", {"address": []}))

    async def test_duplicate_request_id_does_not_replace_running_request(self):
        self.service.accept(json.dumps({"id": "running", "method": "scan"}))
        running = self.service._pending["running"]
        self.service.accept(json.dumps({"id": "running", "method": "disconnect"}))
        self.assertIs(self.service._pending["running"], running)
        self.assertIn("already running", self.output[-1]["error"])
        self.assertEqual(self.service.client.calls, [])

    async def test_malformed_and_oversized_lines_report_structured_errors(self):
        for raw in (b"not json", b"[]", b"\xff", b"x" * (MAX_LINE_BYTES + 1)):
            self.service.accept(raw)
            self.assertEqual(self.output[-1]["kind"], "result")
            self.assertIn("error", self.output[-1])

    async def test_eof_processes_immediate_request_and_disconnects(self):
        raw = b'{"id":"info","method":"getInfo"}\n'
        await self.service.run(io.BytesIO(raw))
        self.assertTrue(any(record.get("id") == "info" and "result" in record for record in self.output))
        self.assertIn("disconnect", self.service.client.calls)

    async def test_shutdown_does_not_require_stdin_eof(self):
        raw = b'{"id":"stop","method":"shutdown"}\n'
        await asyncio.wait_for(self.service.run(io.BytesIO(raw)), timeout=2)
        self.assertIn({"kind": "result", "id": "stop", "result": {"stopping": True}}, self.output)


if __name__ == "__main__":
    unittest.main()
