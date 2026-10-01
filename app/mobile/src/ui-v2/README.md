# Reference UI version

`ReferenceUI.tsx` is a separate screen registered as `ReferenceUI` in the root navigator. The original `Home`, `Records`, and `Assistants` tabs remain the default UI.

- Open **New UI** from the original Home screen.
- Tap the menu icon in the new Home screen to return to the original UI.
- Home shows ring connection state and recent captures. Notes uses the existing recording and analysis stores. Processes uses the existing agent card store. No sample projects or made-up battery percentage are shown.
- Captures and processes can be processed from this UI. Their detailed tools still open the existing recording, transcript, and assistant screens, using the same underlying data and services.

The hero image is a copy of the existing `images/bedrock.webp` asset. The supplied reference image remains only a visual guide and is not bundled into the app.
