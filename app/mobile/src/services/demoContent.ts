import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';

import type { LocalAgentCard } from '@/services/localAgentCards';
import type { LocalRecordingAnalysis } from '@/services/localRecordingAnalysis';

const RECORDING_DIR = `${FileSystem.documentDirectory}voice-recordings/`;
const ANALYSIS_PATH = `${FileSystem.documentDirectory}recording-analysis.json`;
const AGENT_CARDS_PATH = `${FileSystem.documentDirectory}agent-cards.json`;
const DEMO_SEED_MARKER = `${FileSystem.documentDirectory}demo-seed-v2.json`;

export const DEMO_BADGE_LABEL = 'SAMPLE';
export const DEMO_BADGE_COLOR = '#5B6C7A';

export const DEMO_RECORDING_NAME = 'demo_spur_ring_guide.m4a';
export const DEMO_WEEKLY_SYNC_NAME = 'demo_weekly_product_sync.m4a';
export const DEMO_CUSTOMER_DISCOVERY_NAME = 'demo_customer_discovery.m4a';
export const DEMO_AGENT_APPLE_NAME = 'demo_apple_report_command.m4a';
export const DEMO_AGENT_TRAVEL_NAME = 'demo_ny_la_travel_report.m4a';
export const DEMO_AGENT_IDEA_NAME = 'demo_zootopia_judy_idea.m4a';

/** @deprecated Prefer DEMO_AGENT_APPLE_NAME */
export const DEMO_AGENT_NAME = DEMO_AGENT_APPLE_NAME;

const DEMO_NAMES = new Set([
  DEMO_RECORDING_NAME,
  DEMO_WEEKLY_SYNC_NAME,
  DEMO_CUSTOMER_DISCOVERY_NAME,
  DEMO_AGENT_APPLE_NAME,
  DEMO_AGENT_TRAVEL_NAME,
  DEMO_AGENT_IDEA_NAME
]);
const DEMO_SEED_VERSION = 4;

/** Approximate durations of bundled TTS assets (ms). */
const DEMO_RECORDING_DURATION_MS = 76_100;
const DEMO_WEEKLY_SYNC_DURATION_MS = 55_500;
const DEMO_CUSTOMER_DISCOVERY_DURATION_MS = 50_600;
const DEMO_APPLE_DURATION_MS = 3_700;
const DEMO_TRAVEL_DURATION_MS = 6_700;
const DEMO_IDEA_DURATION_MS = 10_500;
const DEMO_RECORDING_MIN_BYTES = 200_000;
const DEMO_WEEKLY_SYNC_MIN_BYTES = 180_000;
const DEMO_CUSTOMER_DISCOVERY_MIN_BYTES = 160_000;
const DEMO_APPLE_MIN_BYTES = 20_000;
const DEMO_TRAVEL_MIN_BYTES = 50_000;
const DEMO_IDEA_MIN_BYTES = 80_000;

const GUIDE_TRANSCRIPT = `Welcome to Spur. This short guide explains how to use your Spur recording ring with the app.

First, put the ring on and make sure Bluetooth is enabled on your phone. Open the Spur app, go to the device page, scan for nearby rings, and connect. Wait until the app shows that the ring is ready. If pairing is interrupted, forget the ring in system Bluetooth settings and try again.

To start a recording, use the ring gesture your device supports. Speak clearly and keep your hand steady. When you finish, stop recording on the ring. Keep the ring near your phone so the audio can sync over Bluetooth. Syncing may take a moment, especially for longer recordings. You will see progress while files transfer.

After sync, longer recordings of fifteen seconds or more appear in the Recordings tab. You can play them back, generate meeting notes, and read the full transcript. Short voice commands under fifteen seconds appear in the AI Assistant tab, where Spur can turn them into actions, ideas, or reports.

Tips for better results: record in a quieter place when possible, wait for sync to finish before disconnecting, and keep the app open during transfer. That is the basic flow: connect, record, sync, then review notes or send a short command to the assistant. Enjoy capturing ideas with Spur.`;

const GUIDE_NOTES = `How to use the Spur recording ring

Overview
This sample recording walks through connecting the Spur ring, capturing audio, syncing to the phone, and reviewing results in the app.

Key steps
1. Enable Bluetooth and connect the ring from the Device page until the app shows ready.
2. Start and stop recording with the ring gesture; keep the ring near the phone while syncing.
3. Open Recordings for clips of 15 seconds or longer to play back, view meeting notes, and read the transcript.
4. Open AI Assistant for short commands under 15 seconds to generate actions, ideas, or reports.

Tips
Record in a quieter place when possible, wait for sync to finish before disconnecting, and keep the app open during transfer.`;

const WEEKLY_SYNC_TRANSCRIPT = `Okay everyone, this is our weekly product sync for the Spur ring launch. Let's keep it to ten minutes.

Alex here. Bluetooth sync reliability improved this week. Dropped transfers are down, but we still need better progress UI when the ring reconnects mid-sync. Decision: ship the reconnect banner in next build, Maya owns it, due Friday.

Priya on App Store readiness. Privacy policy URL is live, and support email is verified. Decision: freeze store listing copy tomorrow noon unless legal flags anything.

Chris on free transcription quota. Soft launch users are hitting the free limit faster than expected. Decision: keep the free quota for launch week, then revisit pricing after we see seven-day retention.

Action items. Maya: reconnect banner. Priya: final App Store screenshots. Chris: draft the quota FAQ for support. That's it for launch blockers. Thanks everyone.`;

const WEEKLY_SYNC_NOTES = `Weekly product sync: ring launch

Executive Summary
Team reviewed Spur ring launch blockers: BLE sync reconnect UX, App Store listing freeze, and free transcription quota policy for launch week.

Decisions
1. Ship a reconnect progress banner in the next build (owner: Maya, due Friday).
2. Freeze App Store listing copy by tomorrow noon unless Legal raises a blocker (owner: Priya).
3. Keep the free transcription quota through launch week; revisit pricing after 7-day retention data (owner: Chris).

Action Items
- Maya: implement reconnect banner and verify mid-sync recovery.
- Priya: finalize App Store screenshots and listing freeze checklist.
- Chris: draft quota FAQ for support before launch communications.

Risks / Follow-ups
Watch soft-launch quota burn rate; confirm Legal has no late copy changes.`;

const CUSTOMER_DISCOVERY_TRANSCRIPT = `Thanks for joining. This is a short customer discovery call about when people use Spur for ideas versus meeting notes.

Interviewer: When do you reach for the ring during a busy day?
User: If I just need a quick thought, I do a short capture for the assistant. But in real meetings, I want proper minutes. The key gesture for me is double tapping the ring button twice. That double tap twice starts meeting minutes recording, so I know I'm in the longer recordings flow, not a short command.

Interviewer: What happens after you stop?
User: I keep the ring near my phone until sync finishes, then I open Recordings for anything over fifteen seconds and check the notes and transcript.

Open questions we still have: do new users discover the double tap twice gesture without a tip, and should the app confirm when meeting minutes mode starts. Good insights for onboarding. Thanks again.`;

const CUSTOMER_DISCOVERY_NOTES = `Customer discovery: capture workflow

Executive Summary
Interviewed a power user on when Spur is used for short ideas versus meeting minutes. Clear preference: short captures go to AI Assistant; longer meetings use Recordings after a deliberate ring gesture.

Key Insight — Meeting minutes gesture
To enter meeting minutes recording, double-tap the ring button twice. That double-tap-twice gesture starts the longer Recordings flow (not a short assistant command).

Workflow Recap
1. Quick thought → short capture → AI Assistant.
2. Real meeting → double-tap the ring button twice → meeting minutes recording.
3. Keep the ring near the phone until sync finishes.
4. Open Recordings for clips of 15 seconds or longer to review notes and transcript.

Open Questions
1. Do new users discover the double-tap-twice gesture without an in-app tip?
2. Should the app show an explicit confirmation when meeting minutes mode starts?

Next Steps
Validate onboarding copy for the double-tap-twice gesture; consider a first-run toast when meeting minutes recording begins.`;

const APPLE_COMMAND_TRANSCRIPT =
  'Write one report to introduce Apple company in five hundred words.';

const APPLE_REPORT = `Apple Inc.: A Concise Company Introduction

Apple Inc. is one of the world’s most influential technology companies, known for designing consumer electronics, personal computers, software, and digital services that emphasize simplicity, craftsmanship, and tightly integrated experiences. Founded in 1976 by Steve Jobs, Steve Wozniak, and Ronald Wayne, Apple began as a maker of personal computers and later expanded into a broader ecosystem that reshapes how people communicate, create, and work.

Today Apple’s hardware lineup centers on the iPhone, which remains the company’s largest revenue driver, alongside the Mac, iPad, Apple Watch, and AirPods. These products are designed to work together through shared design language, continuity features, and secure cloud services. Apple’s software platforms—iOS, iPadOS, macOS, watchOS, and visionOS—provide the foundation for that ecosystem, while services such as the App Store, Apple Music, iCloud, Apple TV+, and Apple Pay create recurring value beyond device sales.

A defining trait of Apple’s strategy is vertical integration. By controlling silicon, hardware, operating systems, and key services, Apple can optimize performance, battery life, privacy controls, and user experience end to end. Its custom Apple silicon chips, introduced across Macs and continued in mobile devices, illustrate that approach: high performance with energy efficiency, enabling thinner designs and longer battery life without compromising everyday responsiveness.

Apple also positions privacy and security as product features. Features such as on-device processing, App Tracking Transparency, and encrypted messaging are marketed as trust differentiators in a data-driven industry. At the same time, Apple operates one of the largest retail and online distribution networks in consumer technology, combining product demonstration, support, and brand storytelling in physical stores and digital channels.

Financially and culturally, Apple has become a benchmark for premium consumer brands. It is regularly among the world’s most valuable public companies, with a loyal customer base and a developer community that builds millions of apps around its platforms. Critics sometimes note the closed nature of its ecosystem and dependence on iPhone cycles, yet Apple continues to diversify through services growth, wearables, and new categories such as spatial computing.

In short, Apple is not only a hardware manufacturer but an ecosystem company: it sells devices, platforms, and services that reinforce one another. Its lasting influence comes from pairing industrial design with software coherence, turning technology products into everyday tools that feel approachable, reliable, and distinctive.`;

const TRAVEL_COMMAND_TRANSCRIPT =
  'I plan to travel from New York to Los Angeles. Could you offer me some travel plans and organize them into a formal report?';

const TRAVEL_REPORT = `Formal Travel Report: New York to Los Angeles

Prepared for: Traveler planning a cross-country trip
Route: New York City (NYC) → Los Angeles (LA)
Purpose: Provide practical itinerary options and a clear recommendation

1. Executive Summary
Traveling from New York to Los Angeles can be completed by air in about six hours, or as a multi-day road or rail journey. For most travelers balancing time and experience, a direct flight plus a structured three-day LA stay offers the best value. Travelers seeking scenery may prefer a five-to-seven-day road trip along a southern interstate corridor.

2. Option A — Fast City Break (Recommended for most travelers)
- Transport: Nonstop flight JFK/EWR/LGA → LAX (approx. 5.5–6.5 hours)
- Duration: 3–4 days in Los Angeles
- Day 1: Arrive, check in near Downtown or Santa Monica; evening walk on the beach or Grand Central Market
- Day 2: Hollywood / Griffith Observatory in the morning; Getty Center or The Broad in the afternoon
- Day 3: Venice Beach and Abbot Kinney; optional studio tour; evening dinner in Koreatown or West Hollywood
- Budget focus: Mid-range hotel + rideshare/metro; reserve one signature meal
- Pros: Minimal transit fatigue, maximum free time in LA
- Cons: Limited “journey” experience

3. Option B — Scenic Road Trip
- Transport: Rental car via I-80 / I-70 / I-15 or a more leisurely southern route (I-40)
- Duration: 5–7 driving days plus 2–3 days in LA
- Highlights: Chicago or St. Louis layover cities (northern/central), or Albuquerque and Flagstaff (southern); Grand Canyon detour if schedule allows
- Pros: Flexible pacing, photography and local stops
- Cons: Higher fatigue, lodging/fuel cost, requires confident long-distance driving

4. Option C — Rail + Local Transit
- Transport: Amtrak or multi-leg rail/bus combinations into Southern California, then Metro/rideshare in LA
- Pros: Relaxed travel, workable laptop time on longer legs
- Cons: Longer total travel time; schedules less flexible than flights

5. Practical Recommendations
- Booking: Secure flights and lodging 2–4 weeks ahead for better fares
- Packing: Layers for NYC departure weather and milder LA evenings; comfortable walking shoes
- Local mobility in LA: Combine rideshare with Metro for Downtown–Santa Monica corridors; plan extra time for traffic
- Safety & pacing: Build buffer time on arrival day; avoid overpacking the first afternoon

6. Conclusion
If the primary goal is an efficient and enjoyable visit, choose Option A (nonstop flight + focused LA itinerary). Choose Option B when the journey itself is part of the experience. This report can be adapted for budget, travel companions, or specific interests such as food, film, or outdoor recreation.`;

const IDEA_COMMAND_TRANSCRIPT =
  "I'm a blogger. I capture good ideas in real time. For example, I need to finish filming a video, and the inspiration I'm recording right now is something like Zootopia's Judy Hopps.";

const IDEA_OUTPUT = `Idea: Film energy inspired by Judy Hopps

Capture
You are finishing a video shoot and want the on-camera presence to feel like Judy Hopps from Zootopia: optimistic, determined, and professionally cheerful under pressure.

Creative angle
- Lead with “small but unstoppable” energy: bright eyes, quick pacing, clear purpose
- Treat every obstacle in the shoot as a beat to solve, not a complaint
- Keep dialogue crisp and hopeful—even when the scene is chaotic

Shot / performance notes
1. Open cold: host steps into frame with confident posture and a short mission line
2. Mid-piece: show hustle (moving between setups) while staying warm with the camera
3. Close: a sincere, grounded takeaway—belief + preparation beat size

Working title options
- “Hopps Mode: Finish the Shoot”
- “Optimistic Hustle on Set”
- “Big City Energy, Small Crew Reality”

Next action
Lock one hook line, film three takes with Judy-like brightness, then pick the cut that feels most determined without sounding forced.`;

export function isDemoAudioName(name: string): boolean {
  return DEMO_NAMES.has(name) || name.toLowerCase().startsWith('demo_');
}

export function isDemoAudioUri(uri: string): boolean {
  try {
    const decoded = decodeURIComponent(uri);
    return [...DEMO_NAMES].some((name) => decoded.endsWith(`/${name}`) || decoded.endsWith(name));
  } catch {
    return [...DEMO_NAMES].some((name) => uri.includes(name));
  }
}

export function compareDemoFirst(aName: string, bName: string, fallback: number): number {
  const aDemo = isDemoAudioName(aName);
  const bDemo = isDemoAudioName(bName);
  if (aDemo && !bDemo) return -1;
  if (!aDemo && bDemo) return 1;
  return fallback;
}

/** Playable file:// URI matching on-disk path (do not encode path segments). */
export function demoFileUri(fileName: string): string {
  return `${RECORDING_DIR}${fileName}`;
}

function diskPathForName(fileName: string): string {
  return `${RECORDING_DIR}${fileName}`;
}

type DemoRecordingSeed = {
  fileName: string;
  moduleId: number;
  minBytes: number;
  durationMs: number;
  transcript: string;
  meetingNotes: string;
  remoteId: string;
  /** Higher = appears earlier among demos in modifiedAt ordering. */
  rank: number;
};

type DemoAgentSeed = {
  fileName: string;
  moduleId: number;
  minBytes: number;
  durationMs: number;
  title: string;
  category: LocalAgentCard['category'];
  transcript: string;
  output: string;
  summary: string;
  remoteId: string;
  rank: number;
};

/** Ensure demo audio + completed notes/cards exist (re-seed if missing/corrupt). */
export async function ensureDemoContent(): Promise<void> {
  await FileSystem.makeDirectoryAsync(RECORDING_DIR, { intermediates: true });

  const force = await shouldForceReseed();

  const recordingSeeds: DemoRecordingSeed[] = [
    {
      fileName: DEMO_RECORDING_NAME,
      moduleId: require('../../assets/demo/demo_spur_ring_guide.m4a'),
      minBytes: DEMO_RECORDING_MIN_BYTES,
      durationMs: DEMO_RECORDING_DURATION_MS,
      transcript: GUIDE_TRANSCRIPT,
      meetingNotes: GUIDE_NOTES,
      remoteId: 'demo-spur-ring-guide',
      rank: 6
    },
    {
      fileName: DEMO_WEEKLY_SYNC_NAME,
      moduleId: require('../../assets/demo/demo_weekly_product_sync.m4a'),
      minBytes: DEMO_WEEKLY_SYNC_MIN_BYTES,
      durationMs: DEMO_WEEKLY_SYNC_DURATION_MS,
      transcript: WEEKLY_SYNC_TRANSCRIPT,
      meetingNotes: WEEKLY_SYNC_NOTES,
      remoteId: 'demo-weekly-product-sync',
      rank: 5
    },
    {
      fileName: DEMO_CUSTOMER_DISCOVERY_NAME,
      moduleId: require('../../assets/demo/demo_customer_discovery.m4a'),
      minBytes: DEMO_CUSTOMER_DISCOVERY_MIN_BYTES,
      durationMs: DEMO_CUSTOMER_DISCOVERY_DURATION_MS,
      transcript: CUSTOMER_DISCOVERY_TRANSCRIPT,
      meetingNotes: CUSTOMER_DISCOVERY_NOTES,
      remoteId: 'demo-customer-discovery',
      rank: 4
    }
  ];

  const agentSeeds: DemoAgentSeed[] = [
    {
      fileName: DEMO_AGENT_TRAVEL_NAME,
      moduleId: require('../../assets/demo/demo_ny_la_travel_report.m4a'),
      minBytes: DEMO_TRAVEL_MIN_BYTES,
      durationMs: DEMO_TRAVEL_DURATION_MS,
      title: 'NYC to LA travel report',
      category: 'report',
      transcript: TRAVEL_COMMAND_TRANSCRIPT,
      output: TRAVEL_REPORT,
      summary: 'Sample voice command: travel plans from New York to Los Angeles as a formal report.',
      remoteId: 'demo-ny-la-travel-report',
      rank: 3
    },
    {
      fileName: DEMO_AGENT_IDEA_NAME,
      moduleId: require('../../assets/demo/demo_zootopia_judy_idea.m4a'),
      minBytes: DEMO_IDEA_MIN_BYTES,
      durationMs: DEMO_IDEA_DURATION_MS,
      title: 'Judy Hopps filming inspiration',
      category: 'idea',
      transcript: IDEA_COMMAND_TRANSCRIPT,
      output: IDEA_OUTPUT,
      summary: 'Sample voice idea: capture blogger inspiration inspired by Zootopia’s Judy Hopps.',
      remoteId: 'demo-zootopia-judy-idea',
      rank: 2
    },
    {
      fileName: DEMO_AGENT_APPLE_NAME,
      moduleId: require('../../assets/demo/demo_apple_report_command.m4a'),
      minBytes: DEMO_APPLE_MIN_BYTES,
      durationMs: DEMO_APPLE_DURATION_MS,
      title: 'Introduce Apple in 500 words',
      category: 'report',
      transcript: APPLE_COMMAND_TRANSCRIPT,
      output: APPLE_REPORT,
      summary: 'Sample voice command: write a ~500-word introduction to Apple Inc.',
      remoteId: 'demo-apple-report',
      rank: 1
    }
  ];

  for (const seed of recordingSeeds) {
    await copyDemoAsset(seed.moduleId, seed.fileName, seed.minBytes, force);
  }
  for (const seed of agentSeeds) {
    await copyDemoAsset(seed.moduleId, seed.fileName, seed.minBytes, force);
  }

  const now = Date.now();
  const analyses = await readJsonRecord<LocalRecordingAnalysis>(ANALYSIS_PATH);
  for (const seed of recordingSeeds) {
    const uri = demoFileUri(seed.fileName);
    const info = await FileSystem.getInfoAsync(diskPathForName(seed.fileName), { size: true });
    if (!info.exists) continue;
    analyses[uri] = {
      id: uri,
      fileUri: uri,
      fileName: seed.fileName,
      durationMs: seed.durationMs,
      size: 'size' in info ? Number(info.size || 0) : 0,
      modifiedAt: now + seed.rank,
      status: 'completed',
      transcript: seed.transcript,
      meetingNotes: seed.meetingNotes,
      remoteId: seed.remoteId,
      updatedAt: now
    };
  }
  await FileSystem.writeAsStringAsync(ANALYSIS_PATH, JSON.stringify(analyses));

  const cards = await readJsonRecord<LocalAgentCard>(AGENT_CARDS_PATH);
  for (const seed of agentSeeds) {
    const uri = demoFileUri(seed.fileName);
    const info = await FileSystem.getInfoAsync(diskPathForName(seed.fileName), { size: true });
    if (!info.exists) continue;
    cards[uri] = {
      id: uri,
      fileUri: uri,
      fileName: seed.fileName,
      durationMs: seed.durationMs,
      modifiedAt: now + seed.rank,
      status: 'completed',
      favorite: false,
      title: seed.title,
      category: seed.category,
      transcript: seed.transcript,
      output: seed.output,
      summary: seed.summary,
      remoteId: seed.remoteId,
      updatedAt: now
    };
  }
  await FileSystem.writeAsStringAsync(AGENT_CARDS_PATH, JSON.stringify(cards));
  await FileSystem.writeAsStringAsync(
    DEMO_SEED_MARKER,
    JSON.stringify({ version: DEMO_SEED_VERSION, at: now })
  );
}

async function shouldForceReseed(): Promise<boolean> {
  try {
    const raw = await FileSystem.readAsStringAsync(DEMO_SEED_MARKER);
    const parsed = JSON.parse(raw) as { version?: number };
    return parsed.version !== DEMO_SEED_VERSION;
  } catch {
    return true;
  }
}

async function copyDemoAsset(
  moduleId: number,
  fileName: string,
  minBytes: number,
  force: boolean
): Promise<void> {
  const destination = diskPathForName(fileName);
  const existing = await FileSystem.getInfoAsync(destination, { size: true });
  const size = existing.exists && 'size' in existing ? Number(existing.size || 0) : 0;
  // User-deleted demos must stay gone unless a seed-version bump forces reseed.
  if (!force && !existing.exists) return;
  if (existing.exists && !force && size >= minBytes) return;

  if (existing.exists) {
    await FileSystem.deleteAsync(destination, { idempotent: true });
  }

  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const source = asset.localUri || asset.uri;
  if (!source) throw new Error(`Demo asset missing: ${fileName}`);
  await FileSystem.copyAsync({ from: source, to: destination });

  const copied = await FileSystem.getInfoAsync(destination, { size: true });
  const copiedSize = copied.exists && 'size' in copied ? Number(copied.size || 0) : 0;
  if (copiedSize < minBytes) {
    throw new Error(`Demo asset copy too small: ${fileName} size=${copiedSize}`);
  }
}

async function readJsonRecord<T>(path: string): Promise<Record<string, T>> {
  try {
    const parsed = JSON.parse(await FileSystem.readAsStringAsync(path));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
