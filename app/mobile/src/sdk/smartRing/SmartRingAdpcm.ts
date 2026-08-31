/**
 * Yamaha ADPCM 4-bit decoder.
 *
 * 板端当前调用：
 *   yma_encode(pcm_int16_200_samples, adpcm_out_100_bytes, 200)
 *
 * 所以 APP 侧按：
 *   100 bytes ADPCM -> 200 samples PCM16
 *
 * 注意：板端仓库只有 bc_alg_adpcm.h 和 .o，没有 C 源码。
 * 这里实现的是常见 Yamaha ADPCM 状态机；如果首测声音异常，优先检查 nibble 顺序。
 */

const YAMAHA_INDEX_SCALE = [230, 230, 230, 230, 307, 409, 512, 614, 230, 230, 230, 230, 307, 409, 512, 614];
const MIN_STEP = 127;
const MAX_STEP = 24567;
const MIN_SAMPLE = -32768;
const MAX_SAMPLE = 32767;

export interface SmartRingAdpcmDecodeOptions {
  /**
   * 板端每个 byte 打包两个 nibble。
   * 常见 Yamaha ADPCM 实现是 high nibble first。
   */
  nibbleOrder?: 'high-first' | 'low-first';
}

export class SmartRingAdpcmDecoder {
  private predictor = 0;
  private step = MIN_STEP;
  private readonly nibbleOrder: 'high-first' | 'low-first';

  constructor(options: SmartRingAdpcmDecodeOptions = {}) {
    this.nibbleOrder = options.nibbleOrder ?? 'high-first';
  }

  reset() {
    this.predictor = 0;
    this.step = MIN_STEP;
  }

  decode(adpcmBytes: Uint8Array): Int16Array {
    const pcm = new Int16Array(adpcmBytes.length * 2);
    let offset = 0;

    for (const byte of adpcmBytes) {
      const high = (byte >> 4) & 0x0f;
      const low = byte & 0x0f;

      if (this.nibbleOrder === 'high-first') {
        pcm[offset++] = this.decodeNibble(high);
        pcm[offset++] = this.decodeNibble(low);
      } else {
        pcm[offset++] = this.decodeNibble(low);
        pcm[offset++] = this.decodeNibble(high);
      }
    }

    return pcm;
  }

  private decodeNibble(nibble: number): number {
    const magnitude = nibble & 0x07;
    let diff = ((magnitude * 2 + 1) * this.step) >> 3;

    if (nibble & 0x08) {
      diff = -diff;
    }

    this.predictor = clamp(this.predictor + diff, MIN_SAMPLE, MAX_SAMPLE);
    this.step = clamp((this.step * YAMAHA_INDEX_SCALE[nibble]) >> 8, MIN_STEP, MAX_STEP);

    return this.predictor;
  }
}

export function decodeAdpcm(adpcmBytes: Uint8Array, options?: SmartRingAdpcmDecodeOptions): Int16Array {
  const decoder = new SmartRingAdpcmDecoder(options);
  return decoder.decode(adpcmBytes);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
