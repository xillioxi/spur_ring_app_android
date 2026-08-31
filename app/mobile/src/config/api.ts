/**
 * Audio-agent origin used by the App.
 *
 * App Store / Release builds MUST use HTTPS on a real domain (TLS certs
 * need a hostname; bare IP cleartext will be rejected by ATS + review).
 *
 * Override anytime with:
 *   EXPO_PUBLIC_AUDIO_AGENT_BASE_URL=https://api.your-domain.com
 *
 * Dev and Release both use the public HTTPS origin once DNS/TLS is live.
 */
const DEV_AUDIO_AGENT_BASE_URL = 'https://api.hispurring.com';

/** Production HTTPS origin (DNS + Nginx on the audio-agent host). */
const PRODUCTION_AUDIO_AGENT_BASE_URL = 'https://api.hispurring.com';

const fromEnv = process.env.EXPO_PUBLIC_AUDIO_AGENT_BASE_URL?.trim();

export const AUDIO_AGENT_BASE_URL = (
  fromEnv || (__DEV__ ? DEV_AUDIO_AGENT_BASE_URL : PRODUCTION_AUDIO_AGENT_BASE_URL)
).replace(/\/$/, '');

export function assertAudioAgentHttpsForRelease() {
  if (__DEV__) return;
  if (!AUDIO_AGENT_BASE_URL.startsWith('https://')) {
    throw new Error(
      `Release builds require HTTPS audio-agent URL. Current: ${AUDIO_AGENT_BASE_URL}`
    );
  }
  if (AUDIO_AGENT_BASE_URL.includes('your-domain.com')) {
    throw new Error(
      'Set PRODUCTION_AUDIO_AGENT_BASE_URL or EXPO_PUBLIC_AUDIO_AGENT_BASE_URL to your real HTTPS domain before release.'
    );
  }
}
