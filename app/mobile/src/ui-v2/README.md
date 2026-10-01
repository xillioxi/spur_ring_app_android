# Spur Ring interface

`RingAppScreen.tsx` is the sole root interface. It opens directly at app launch and contains Home, Notes, Processes, search, capture details, playback, processing, favorites, sharing, and deletion. Ring sync, device controls, settings, and advanced note tools remain reachable from this interface.

Projects are stored locally and contain references to multiple notes. The Notes page creates projects and lets users add or remove notes from them. The Home hero uses `ring-hero-new.png`, supplied by the user.
