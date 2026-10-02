import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { AssignmentEditSession, AssignmentUploadLocalFile } from "@/types";

const viewHtml = `<h1>Worksheet 3</h1>
  <nav aria-label="Navigation bar"><li><a href="/course/view.php?id=162">Maths</a></li></nav>
  <div class="activity-description"><div id="intro">Upload your answers.</div></div>
  <a href="/mod/assign/view.php?id=6078&amp;action=editsubmission">Add submission</a>
  <table class="submissionstatustable"><tr><td>Submission status</td><td>No submission</td></tr><tr><td>File submissions</td><td><div class="fileuploadsubmission"><a href="/pluginfile.php/10/assignsubmission_file/submission_files/22/answers.pdf">answers.pdf</a></div></td></tr></table>`;
const editHtml = `<form action="/mod/assign/view.php" method="post">
  <input type="hidden" name="action" value="savesubmission" />
  <input type="hidden" name="id" value="6078" />
  <input type="hidden" name="sesskey" value="test-key" />
  <input type="hidden" name="files_filemanager" value="draft-1" />
  <textarea name="onlinetext_editor[text]">Existing text</textarea></form>
  <script>M.form_filemanager.init(Y, {"maxfiles":3,"maxbytes":1000,"accepted_types":[".pdf"],"filepicker":{"repositories":{"4":{"type":"upload"}}}});</script>`;

let editResponse: Promise<string> | null = null;
const get = mock(async (url: string) => ({
  data: url.includes("editsubmission")
    ? await (editResponse ?? Promise.resolve(editHtml))
    : viewHtml,
}));
const post = mock(
  async (
    url: string,
    _body: unknown,
    options?: {
      onUploadProgress?: (event: { loaded: number; total: number }) => void;
    },
  ) => {
    if (url.includes("repository_ajax")) {
      options?.onUploadProgress?.({ loaded: 150, total: 100 });
      return { data: { itemid: "uploaded-draft", title: "answers.pdf" } };
    }
    return { data: viewHtml };
  },
);
const checkSession = mock(async () => true);
mock.module("@/services/api", () => ({
  api: { get, post },
  getCurrentBaseUrl: () => "https://lms.example",
}));
mock.module("@/services/auth/lms-auth", () => ({
  checkSession,
  tryAutoLogin: async () => true,
}));
mock.module("@/stores/storage", () => ({
  zustandStorage: {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  },
}));

const {
  fetchAssignmentDetailsWithSession,
  startAssignmentEditSession,
  uploadAssignmentDraftFiles,
  submitAssignment,
} = await import("@/services/assignment");
const { useAssignmentStore } = await import("@/stores/assignment-store");

const file: AssignmentUploadLocalFile = {
  uri: "file:///answers.pdf",
  name: "answers.pdf",
  mimeType: "application/pdf",
  size: 100,
};
let session: AssignmentEditSession;

beforeEach(async () => {
  editResponse = null;
  useAssignmentStore.getState().clearAssignmentCache();
  session = await startAssignmentEditSession("6078");
  get.mockClear();
  post.mockClear();
  checkSession.mockClear();
});

describe("assignment loading", () => {
  test("keeps submitted files separate from assignment resources", async () => {
    const details = await fetchAssignmentDetailsWithSession("6078");
    expect(details.submittedFiles).toEqual([
      {
        id: "submitted-0",
        name: "answers.pdf",
        url: "https://lms.example/pluginfile.php/10/assignsubmission_file/submission_files/22/answers.pdf",
      },
    ]);
    expect(details.resources).toEqual([]);
  });

  test("loads the view in one request without a session probe or edit request", async () => {
    const details = await fetchAssignmentDetailsWithSession("6078");
    expect(details.assignmentName).toBe("Worksheet 3");
    expect(details.canEditSubmission).toBe(true);
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      "/mod/assign/view.php?id=6078",
    ]);
    expect(checkSession).not.toHaveBeenCalled();
  });

  test("renders details while the edit form is still loading and shares that request", async () => {
    let resolveEdit!: (html: string) => void;
    editResponse = new Promise((resolve) => {
      resolveEdit = resolve;
    });
    await useAssignmentStore.getState().fetchAssignmentDetails("6078");
    const state = useAssignmentStore.getState();
    expect(state.detailsByAssignmentId["6078"].data.assignmentName).toBe(
      "Worksheet 3",
    );
    expect(state.isLoadingByAssignmentId["6078"]).toBe(false);
    expect(state.isLoadingEditByAssignmentId["6078"]).toBe(true);
    const second = state.startEditSession("6078");
    expect(
      get.mock.calls.filter(([url]) => url.includes("editsubmission")),
    ).toHaveLength(1);
    resolveEdit(editHtml);
    expect((await second)?.supportsFileSubmission).toBe(true);
    expect(
      useAssignmentStore.getState().isLoadingEditByAssignmentId["6078"],
    ).toBe(false);
    await state.fetchAssignmentDetails("6078");
    expect(
      get.mock.calls.filter(([url]) => !url.includes("editsubmission")),
    ).toHaveLength(1);
  });
});

describe("draft uploads and submission", () => {
  test("uploads files without saving the form and caps cumulative multipart progress", async () => {
    const progress: (number | null)[] = [];
    const draft = await uploadAssignmentDraftFiles(
      session,
      [file, { ...file, name: "second.pdf" }],
      { onProgress: (fraction) => progress.push(fraction) },
    );
    expect(draft.draftItemId).toBe("uploaded-draft");
    expect(post.mock.calls).toHaveLength(2);
    expect(
      post.mock.calls.every(([url]) => url.includes("repository_ajax")),
    ).toBe(true);
    expect(progress).toEqual([0.5, 0.5, 1, 1]);
    const secondForm = post.mock.calls[1][1] as FormData;
    expect(secondForm.get("itemid")).toBe("uploaded-draft");
  });

  test("validates every file before uploading any", async () => {
    await expect(
      uploadAssignmentDraftFiles(session, [
        file,
        { ...file, name: "image.png" },
      ]),
    ).rejects.toThrow("not allowed");
    expect(post).not.toHaveBeenCalled();
    await expect(
      uploadAssignmentDraftFiles(session, [{ ...file, size: 2000 }]),
    ).rejects.toThrow("size limit");
    await expect(
      uploadAssignmentDraftFiles(session, [file, file, file, file]),
    ).rejects.toThrow("Maximum 3");
    expect(post).not.toHaveBeenCalled();
  });

  test("explicit submit saves the uploaded draft without reuploading or opening a new edit form", async () => {
    const draft = { ...session, draftItemId: "uploaded-draft" };
    const result = await useAssignmentStore
      .getState()
      .submitAssignment(
        "6078",
        { assignmentId: "6078" },
        { draftSession: draft },
      );
    expect(result.success).toBe(true);
    expect(post.mock.calls).toHaveLength(1);
    const saved = new URLSearchParams(post.mock.calls[0][1] as string);
    expect(saved.get("action")).toBe("savesubmission");
    expect(saved.get("files_filemanager")).toBe("uploaded-draft");
    expect(saved.get("onlinetext_editor[text]")).toBe("Existing text");
    // A later background refresh may fetch a new form, but the save used the exact staged draft.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  test("rejects an assignment mismatch without sending files or saving", async () => {
    const result = await submitAssignment(session, { assignmentId: "other" });
    expect(result.success).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });

  test("keeps progress in the valid range at the store boundary", () => {
    useAssignmentStore.getState().setUploadProgress("6078", 1.8);
    expect(
      useAssignmentStore.getState().uploadProgressByAssignmentId["6078"],
    ).toBe(1);
    useAssignmentStore.getState().setUploadProgress("6078", Number.NaN);
    expect(
      useAssignmentStore.getState().uploadProgressByAssignmentId["6078"],
    ).toBeNull();
  });
});
