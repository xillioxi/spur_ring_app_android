from pathlib import Path
import tempfile
import unittest

from spur_ring.realtime_recordings import RealtimeRecordingTransfer


class RealtimeTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(temp.cleanup)
        self.transfer = RealtimeRecordingTransfer(Path(temp.name))
        self.packet = bytes.fromhex("AC52016553F1000000000100030100140003000C00020100F8FFFE")
        self.end = bytes.fromhex("AC54016553F10000000001")

    def test_duplicate_does_not_count_as_another_packet(self):
        self.transfer.feed(self.packet)
        self.transfer.feed(self.packet)
        self.assertEqual(len(self.transfer.feed(self.end).completed), 1)
        duplicate = self.transfer.feed(self.end)
        self.assertEqual(duplicate.commands, [bytes.fromhex("AC55016553F10001")])
        self.assertEqual(self.transfer.completed_files, 1)

    def test_missing_packet_or_changed_format_never_gets_a_success_ack(self):
        self.transfer.feed(self.packet)
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.transfer.feed(self.end[:-1] + b'\x02')
        changed = bytearray(self.packet)
        changed[15] = 40
        with self.assertRaisesRegex(ValueError, 'changed'):
            self.transfer.feed(bytes(changed))
        self.assertFalse(list(self.transfer.output_dir.glob('*.ogg')))

    def test_empty_end_during_partial_download_is_an_error(self):
        self.transfer.feed(self.packet)
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            self.transfer.feed(bytes.fromhex("AC5401FFFFFFFF00000000"))
