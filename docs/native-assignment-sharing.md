# Native assignment sharing

Bunkialo receives images and PDFs from the Android and iOS share sheets, including
multiple files. Incoming files stay in memory through login. The assignment picker
uses dashboard deadlines: upcoming deadlines in ascending order, then the most
recently overdue assignments, then undated assignments. Pull to refresh the list.

Selecting an assignment checks its submission methods and file limits, then uploads
to Moodle's temporary file draft. This does **not** post the submission form. The
separate Submit button saves that same draft and preserves existing online text.
Open LMS always opens `/mod/assign/view.php?id=…`.

## Build requirement

`expo-share-intent` adds native code and an iOS share extension. Install a new
development or production native build; Expo Go and existing native builds cannot
receive these shares. The runtime is now `1.4.1-share-intent-v1`, keeping these
changes separate from installed `1.4.1 (59)` OTA clients. Package version stays
`1.4.1`; EAS manages native build numbers remotely. Do not send this native feature
as a `1.4.1` OTA update.

For local Android development:

```sh
bun install
bun run android
```

The iOS configuration registers the `com.codialo.Bunkialo2.share-extension` target
and the shared app group `group.com.codialo.Bunkialo2`. EAS needs signing/provisioning
for both the app and extension when building iOS.

## Verification

`bun test` covers rendering details before edit metadata finishes, deduplicated
requests, draft-only uploads, file limits, capped batch progress, explicit saving
of the same draft, deadline ordering, shared URI handling, and assignment view links.
Android prebuild checks the generated SEND and SEND_MULTIPLE image/PDF filters.

On a native device, verify:

1. Share an image and a PDF with the app closed, then with it already running.
2. Share while logged out; finish login and check that the files reach the picker.
3. Select an assignment and wait for the draft upload. Confirm the LMS submission
   has not changed before pressing Submit.
4. Tap Submit, then Open LMS. Check that it opens the assignment page with no
   `action=editsubmission` parameter.
5. Check multiple files, a rejected file type/size, an unavailable assignment, an
   interrupted upload, and receiving a new share while another draft is staged.

Device checks require a signed native build and a real LMS account. Unit tests
mock Moodle transport and never submit work to a real assignment.
