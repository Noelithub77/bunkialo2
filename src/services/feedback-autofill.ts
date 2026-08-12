import {
  checkSession,
  refreshAuthSession,
  tryAutoLogin,
} from "@/services/auth/lms-auth";
import { api, getCurrentBaseUrl } from "@/services/api";
import { fetchCourses } from "@/services/lms-courses";
import {
  getAttr,
  getText,
  parseHtml,
  querySelector,
  querySelectorAll,
} from "@/utils/html-parser";
import { debug } from "@/utils/debug";
import { isLoginHtml } from "@/utils/moodle-url";
import type { Element } from "domhandler";

type FeedbackAutofillOptions = {
  defaultGrade: string;
  defaultTextResponse: string;
  courseDefaults?: Record<string, { grade: string; textResponse: string }>;
  submit?: boolean;
  parallelism?: number;
  onProgress?: (progress: FeedbackAutofillProgress) => void;
};

export type FeedbackAutofillProgress = {
  stage: "start" | "course" | "done";
  totalCourses: number;
  courseIndex: number;
  courseTitle: string;
  coursesProcessed: number;
  feedbackFormsVisited: number;
  formsAttempted: number;
  formsSubmitted: number;
  currentCourseGrade: string;
  currentCourseTextResponse: string;
};

export type FeedbackAutofillReport = {
  coursesDiscovered: number;
  coursesProcessed: number;
  feedbackLinksDiscovered: number;
  feedbackFormsVisited: number;
  formsAttempted: number;
  formsSubmitted: number;
  formsSkippedNoQuestions: number;
  formsSkippedNotAccessible: number;
  radioGroupsFilled: number;
  checkboxGroupsFilled: number;
  textFieldsFilled: number;
  errors: string[];
};

type FillResult = {
  submitted: boolean;
  hadQuestions: boolean;
  radioGroupsFilled: number;
  checkboxGroupsFilled: number;
  textFieldsFilled: number;
};

const toAbsoluteUrl = (href: string): string => {
  const baseUrl = getCurrentBaseUrl();
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
};

const isDisabledField = (node: Element): boolean => {
  return getAttr(node, "disabled") !== null;
};

const collectFeedbackLinks = (html: string, courseId: string): string[] => {
  const doc = parseHtml(html);
  const links = querySelectorAll(doc, "a[href]")
    .map((node) => {
      const href = getAttr(node, "href") || "";
      return {
        href: toAbsoluteUrl(href),
      };
    })
    .filter((entry) =>
      /\/mod\/feedback\/(view|complete)\.php\?id=\d+/i.test(entry.href),
    )
    .filter((entry) => {
      const linkCourseMatch = entry.href.match(/[?&]courseid=(\d+)/i);
      if (!linkCourseMatch?.[1]) return true;
      return linkCourseMatch[1] === courseId;
    })
    .map((entry) => entry.href);
  return Array.from(new Set(links));
};

const isNotFoundError = (error: unknown): boolean => {
  if (!error) return false;

  if (typeof error === "object") {
    const candidate = error as {
      response?: {
        status?: number;
      };
      status?: number;
      message?: string;
    };

    if (candidate.response?.status === 404 || candidate.status === 404) {
      return true;
    }

    if (
      typeof candidate.message === "string" &&
      /status\s*code\s*404|\b404\b/i.test(candidate.message)
    ) {
      return true;
    }
  }

  if (typeof error === "string") {
    return /status\s*code\s*404|\b404\b/i.test(error);
  }

  return false;
};

const isEnrollmentOptionsPage = (html: string): boolean => {
  const normalized = html.toLowerCase();
  return (
    normalized.includes("enrolment options") ||
    normalized.includes("enrollment options") ||
    normalized.includes("you cannot enrol yourself") ||
    normalized.includes("you cannot enroll yourself")
  );
};

const appendHiddenFields = (form: Element, params: URLSearchParams) => {
  const hiddenInputs = querySelectorAll(form, "input[type='hidden'][name]");
  for (const input of hiddenInputs) {
    const name = getAttr(input, "name");
    if (!name) continue;
    const value = getAttr(input, "value") || "";
    params.set(name, value);
  }
};

const appendSubmitButtonField = (form: Element, params: URLSearchParams) => {
  const submitInput = querySelector(form, "input[type='submit'][name]");
  if (submitInput) {
    const name = getAttr(submitInput, "name");
    if (name) {
      params.set(name, getAttr(submitInput, "value") || "1");
      return;
    }
  }

  const submitButton = querySelector(form, "button[type='submit'][name]");
  if (submitButton) {
    const name = getAttr(submitButton, "name");
    if (name) {
      params.set(
        name,
        getAttr(submitButton, "value") || getText(submitButton) || "1",
      );
    }
  }
};

const applyQuestionDefaults = (
  form: Element,
  params: URLSearchParams,
  defaultGrade: string,
  defaultTextResponse: string,
): Omit<FillResult, "submitted"> => {
  const radios = querySelectorAll(form, "input[type='radio'][name]").filter(
    (node) => !isDisabledField(node),
  );
  const radioByName = new Map<string, Element[]>();
  for (const radio of radios) {
    const name = getAttr(radio, "name");
    if (!name) continue;
    const group = radioByName.get(name) || [];
    group.push(radio);
    radioByName.set(name, group);
  }

  let radioGroupsFilled = 0;
  for (const [name, group] of radioByName) {
    const preferred =
      group.find((node) => (getAttr(node, "value") || "") === defaultGrade) ||
      group[2] ||
      group[0];
    if (!preferred) continue;
    const value = getAttr(preferred, "value") || "";
    params.set(name, value);
    radioGroupsFilled += 1;
  }

  const checkboxes = querySelectorAll(
    form,
    "input[type='checkbox'][name]",
  ).filter((node) => !isDisabledField(node));
  const checkboxByName = new Map<string, Element[]>();
  for (const checkbox of checkboxes) {
    const name = getAttr(checkbox, "name");
    if (!name) continue;
    const group = checkboxByName.get(name) || [];
    group.push(checkbox);
    checkboxByName.set(name, group);
  }

  let checkboxGroupsFilled = 0;
  for (const [name, group] of checkboxByName) {
    const selected = group.slice(0, Math.min(3, group.length));
    if (selected.length === 0) continue;
    params.delete(name);
    for (const checkbox of selected) {
      params.append(name, getAttr(checkbox, "value") || "1");
    }
    checkboxGroupsFilled += 1;
  }

  const selects = querySelectorAll(form, "select[name]").filter(
    (node) => !isDisabledField(node),
  );
  for (const select of selects) {
    const name = getAttr(select, "name");
    if (!name) continue;

    const options = querySelectorAll(select, "option");
    if (options.length === 0) continue;

    const preferredOption =
      options.find(
        (option) => (getAttr(option, "value") || "") === defaultGrade,
      ) ||
      options.find((option) => {
        const value = (getAttr(option, "value") || "").trim();
        return value.length > 0;
      }) ||
      options[0];

    const selectedValue = getAttr(preferredOption, "value") || "";
    params.set(name, selectedValue);
  }

  const textFields = [
    ...querySelectorAll(form, "textarea[name]"),
    ...querySelectorAll(
      form,
      "input[type='text'][name], input:not([type])[name]",
    ),
    ...querySelectorAll(
      form,
      "input[type='email'][name], input[type='search'][name], input[type='number'][name], input[type='tel'][name], input[type='url'][name]",
    ),
  ].filter(
    (node) => !isDisabledField(node) && getAttr(node, "readonly") === null,
  );

  let textFieldsFilled = 0;
  for (const field of textFields) {
    const name = getAttr(field, "name");
    if (!name) continue;
    const tag = (field.tagName || "").toLowerCase();
    const existing =
      tag === "textarea" ? getText(field) : getAttr(field, "value") || "";
    const value = existing.trim() || defaultTextResponse;
    params.set(name, value);
    if (!existing.trim()) {
      textFieldsFilled += 1;
    }
  }

  return {
    hadQuestions: true,
    radioGroupsFilled,
    checkboxGroupsFilled,
    textFieldsFilled,
  };
};

const findQuestionForm = (html: string): Element | null => {
  const doc = parseHtml(html);
  const forms = querySelectorAll(doc, "form");

  for (const form of forms) {
    const hasQuestions =
      querySelector(form, "input[type='radio'][name]") !== null ||
      querySelector(form, "input[type='checkbox'][name]") !== null ||
      querySelector(form, "textarea[name]") !== null ||
      querySelector(form, "input[type='text'][name]") !== null ||
      querySelector(form, "input[type='email'][name]") !== null ||
      querySelector(form, "input[type='search'][name]") !== null ||
      querySelector(form, "input[type='number'][name]") !== null ||
      querySelector(form, "input[type='tel'][name]") !== null ||
      querySelector(form, "input[type='url'][name]") !== null ||
      querySelector(form, "select[name]") !== null ||
      querySelector(form, "input:not([type])[name]") !== null;
    const hasSubmit =
      querySelector(form, "button[type='submit'], input[type='submit']") !==
      null;
    if (hasQuestions && hasSubmit) {
      return form;
    }
  }

  return null;
};

const findConfirmationForm = (html: string): Element | null => {
  const doc = parseHtml(html);
  const forms = querySelectorAll(doc, "form");
  for (const form of forms) {
    const hasSubmit =
      querySelector(form, "button[type='submit'], input[type='submit']") !==
      null;
    const hasQuestions =
      querySelector(form, "input[type='radio'][name]") !== null ||
      querySelector(form, "input[type='checkbox'][name]") !== null ||
      querySelector(form, "textarea[name]") !== null ||
      querySelector(form, "input[type='text'][name]") !== null ||
      querySelector(form, "input[type='email'][name]") !== null ||
      querySelector(form, "input[type='search'][name]") !== null ||
      querySelector(form, "input[type='number'][name]") !== null ||
      querySelector(form, "input[type='tel'][name]") !== null ||
      querySelector(form, "input[type='url'][name]") !== null ||
      querySelector(form, "select[name]") !== null ||
      querySelector(form, "input:not([type])[name]") !== null;
    if (hasSubmit && !hasQuestions) {
      return form;
    }
  }
  return null;
};

const getFormActionUrl = (form: Element, currentUrl: string): string => {
  const action = getAttr(form, "action") || currentUrl;
  return toAbsoluteUrl(action);
};

const resolveCompletionUrl = (
  feedbackPageUrl: string,
  html: string,
): string => {
  const doc = parseHtml(html);
  const completionLink = querySelector(
    doc,
    "a[href*='/mod/feedback/complete.php'], a[href*='complete.php?id=']",
  );
  if (!completionLink) return feedbackPageUrl;
  const href = getAttr(completionLink, "href");
  if (!href) return feedbackPageUrl;
  return toAbsoluteUrl(href);
};

const fallbackCompletionUrl = (feedbackPageUrl: string): string => {
  const idMatch = feedbackPageUrl.match(/[?&]id=(\d+)/);
  if (!idMatch?.[1]) return feedbackPageUrl;
  return toAbsoluteUrl(`/mod/feedback/complete.php?id=${idMatch[1]}`);
};

const isFeedbackForm = (form: Element): boolean => {
  const action = getAttr(form, "action") || "";
  const hasFeedbackAction = /\/mod\/feedback\/(complete|view)\.php/i.test(
    action,
  );
  const hasSubmitValues =
    querySelector(form, "input[name='savevalues']") !== null;
  const hasQuestionFields =
    querySelector(form, "input[type='radio'][name]") !== null ||
    querySelector(form, "input[type='checkbox'][name]") !== null ||
    querySelector(form, "textarea[name]") !== null ||
    querySelector(form, "input[type='text'][name]") !== null ||
    querySelector(form, "input[type='email'][name]") !== null ||
    querySelector(form, "input[type='search'][name]") !== null ||
    querySelector(form, "input[type='number'][name]") !== null ||
    querySelector(form, "input[type='tel'][name]") !== null ||
    querySelector(form, "input[type='url'][name]") !== null ||
    querySelector(form, "select[name]") !== null ||
    querySelector(form, "input:not([type])[name]") !== null;
  return hasQuestionFields && (hasFeedbackAction || hasSubmitValues);
};

const submitFeedbackForm = async (
  pageUrl: string,
  html: string,
  defaultGrade: string,
  defaultTextResponse: string,
  submit: boolean,
): Promise<FillResult> => {
  const doc = parseHtml(html);
  const explicitForm = querySelectorAll(doc, "form").find((form) =>
    isFeedbackForm(form),
  );
  const questionForm = explicitForm ?? findQuestionForm(html);
  if (!questionForm) {
    return {
      submitted: false,
      hadQuestions: false,
      radioGroupsFilled: 0,
      checkboxGroupsFilled: 0,
      textFieldsFilled: 0,
    };
  }

  const payload = new URLSearchParams();
  appendHiddenFields(questionForm, payload);
  appendSubmitButtonField(questionForm, payload);

  const fill = applyQuestionDefaults(
    questionForm,
    payload,
    defaultGrade,
    defaultTextResponse,
  );

  if (!submit) {
    return {
      ...fill,
      submitted: false,
      hadQuestions: true,
    };
  }

  const actionUrl = getFormActionUrl(questionForm, pageUrl);
  const submitResponse = await api.post<string>(actionUrl, payload.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (isLoginHtml(submitResponse.data)) {
    throw new Error("Session expired while submitting feedback form");
  }

  const confirmationForm = findConfirmationForm(submitResponse.data);
  if (confirmationForm) {
    const confirmPayload = new URLSearchParams();
    appendHiddenFields(confirmationForm, confirmPayload);
    appendSubmitButtonField(confirmationForm, confirmPayload);
    const confirmationAction = getFormActionUrl(confirmationForm, actionUrl);
    await api.post<string>(confirmationAction, confirmPayload.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
  }

  return {
    ...fill,
    submitted: true,
    hadQuestions: true,
  };
};

const ensureAuthenticatedSession = async (): Promise<boolean> => {
  const valid = await checkSession();
  if (valid) return true;
  return tryAutoLogin();
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetries = async <T>(
  task: () => Promise<T>,
  contextLabel: string,
): Promise<T> => {
  let lastError: unknown = null;
  const delaysMs = [600, 1400, 2800];

  for (let attempt = 0; attempt < delaysMs.length; attempt += 1) {
    try {
      if (attempt > 0) {
        await refreshAuthSession();
      }
      return await task();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      debug.scraper(
        `[feedback-autofill] ${contextLabel} attempt ${attempt + 1} failed: ${message}`,
      );
      if (attempt < delaysMs.length - 1) {
        await wait(delaysMs[attempt]);
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${contextLabel} failed after retries`);
};

type FeedbackProcessingResult =
  | { kind: "ok"; fillResult: FillResult }
  | { kind: "inaccessible" }
  | { kind: "error"; message: string };

const processSingleFeedbackLink = async (
  feedbackUrl: string,
  gradeForCourse: string,
  textForCourse: string,
  submit: boolean,
): Promise<FeedbackProcessingResult> => {
  try {
    const feedbackPage = await withRetries(
      () => api.get<string>(feedbackUrl),
      `load feedback page ${feedbackUrl}`,
    );
    if (isLoginHtml(feedbackPage.data)) {
      throw new Error("Session expired while opening feedback page");
    }

    const completionUrl = resolveCompletionUrl(feedbackUrl, feedbackPage.data);
    const preferredCompletionUrl =
      completionUrl === feedbackUrl
        ? fallbackCompletionUrl(feedbackUrl)
        : completionUrl;

    const completionPage =
      preferredCompletionUrl === feedbackUrl
        ? feedbackPage
        : await withRetries(
            () => api.get<string>(preferredCompletionUrl),
            `load completion page ${preferredCompletionUrl}`,
          );

    if (isLoginHtml(completionPage.data)) {
      throw new Error("Session expired while opening feedback form");
    }

    const fillResult = await withRetries(
      () =>
        submitFeedbackForm(
          preferredCompletionUrl,
          completionPage.data,
          gradeForCourse,
          textForCourse,
          submit,
        ),
      `submit feedback form ${preferredCompletionUrl}`,
    );

    return { kind: "ok", fillResult };
  } catch (error) {
    if (isNotFoundError(error)) {
      return { kind: "inaccessible" };
    }

    const message = error instanceof Error ? error.message : String(error);
    return { kind: "error", message };
  }
};

const retryInaccessibleFeedbackLink = async (
  courseUrl: string,
  courseId: string,
  feedbackUrl: string,
  gradeForCourse: string,
  textForCourse: string,
  submit: boolean,
): Promise<FeedbackProcessingResult> => {
  const recoveryBackoffMs = [1200, 2400, 4800];

  for (const delayMs of recoveryBackoffMs) {
    await wait(delayMs);
    await refreshAuthSession();

    try {
      const refreshedCoursePage = await withRetries(
        () => api.get<string>(courseUrl),
        `refresh course page ${courseUrl}`,
      );

      if (isLoginHtml(refreshedCoursePage.data)) {
        continue;
      }
      if (isEnrollmentOptionsPage(refreshedCoursePage.data)) {
        return { kind: "inaccessible" };
      }

      const refreshedLinks = collectFeedbackLinks(
        refreshedCoursePage.data,
        courseId,
      );

      if (!refreshedLinks.includes(feedbackUrl)) {
        return { kind: "inaccessible" };
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return { kind: "inaccessible" };
      }
      continue;
    }

    const retryResult = await processSingleFeedbackLink(
      feedbackUrl,
      gradeForCourse,
      textForCourse,
      submit,
    );

    if (retryResult.kind !== "inaccessible") {
      return retryResult;
    }
  }

  return { kind: "inaccessible" };
};

export const runLmsFeedbackAutofill = async (
  options: FeedbackAutofillOptions,
): Promise<FeedbackAutofillReport> => {
  const defaultGrade = /^[0-5]$/.test(options.defaultGrade.trim())
    ? options.defaultGrade.trim()
    : "3";
  const defaultTextResponse = options.defaultTextResponse.trim() || "_";
  const courseDefaults = options.courseDefaults ?? {};
  const submit = options.submit ?? true;
  const onProgress = options.onProgress;

  const report: FeedbackAutofillReport = {
    coursesDiscovered: 0,
    coursesProcessed: 0,
    feedbackLinksDiscovered: 0,
    feedbackFormsVisited: 0,
    formsAttempted: 0,
    formsSubmitted: 0,
    formsSkippedNoQuestions: 0,
    formsSkippedNotAccessible: 0,
    radioGroupsFilled: 0,
    checkboxGroupsFilled: 0,
    textFieldsFilled: 0,
    errors: [],
  };

  const ready = await ensureAuthenticatedSession();
  if (!ready) {
    throw new Error("Not authenticated. Please log in again.");
  }

  const courses = await fetchCourses();
  const courseEntries = Array.from(
    new Map(
      courses.map((course) => [
        toAbsoluteUrl(course.url),
        { title: course.name, url: toAbsoluteUrl(course.url) },
      ]),
    ).values(),
  );
  report.coursesDiscovered = courseEntries.length;

  const emitProgress = (
    stage: FeedbackAutofillProgress["stage"],
    courseIndex: number,
    courseTitle: string,
    currentCourseGrade: string,
    currentCourseTextResponse: string,
  ) => {
    onProgress?.({
      stage,
      totalCourses: courseEntries.length,
      courseIndex,
      courseTitle,
      coursesProcessed: report.coursesProcessed,
      feedbackFormsVisited: report.feedbackFormsVisited,
      formsAttempted: report.formsAttempted,
      formsSubmitted: report.formsSubmitted,
      currentCourseGrade,
      currentCourseTextResponse,
    });
  };

  emitProgress("start", 0, "", defaultGrade, defaultTextResponse);

  debug.scraper(
    `Feedback autofill start: courses=${courseEntries.length}, submit=${submit}`,
  );

  const workerTarget =
    options.parallelism && options.parallelism > 0
      ? options.parallelism
      : courseEntries.length;
  const workerCount = Math.max(1, Math.min(workerTarget, courseEntries.length));
  let nextCourseIndex = 0;

  const processCourse = async (
    entry: { title: string; url: string },
    index: number,
  ) => {
    const courseIdMatch = entry.url.match(/[?&]id=(\d+)/);
    const courseId = courseIdMatch?.[1] ?? "";
    const courseDefault = courseDefaults[courseId];
    const gradeForCourse =
      courseDefault && /^[0-5]$/.test(courseDefault.grade)
        ? courseDefault.grade
        : defaultGrade;
    const textForCourse =
      courseDefault?.textResponse?.trim() || defaultTextResponse;

    try {
      const coursePage = await withRetries(
        () => api.get<string>(entry.url),
        `load course page ${entry.url}`,
      );
      if (isLoginHtml(coursePage.data)) {
        throw new Error("Session expired while loading course page");
      }
      if (isEnrollmentOptionsPage(coursePage.data)) {
        debug.scraper(
          `[feedback-autofill] Skipping not-enrolled course page ${entry.url}`,
        );
        return;
      }

      report.coursesProcessed += 1;
      const feedbackLinks = collectFeedbackLinks(coursePage.data, courseId);
      report.feedbackLinksDiscovered += feedbackLinks.length;

      for (const feedbackUrl of feedbackLinks) {
        report.feedbackFormsVisited += 1;

        let result = await processSingleFeedbackLink(
          feedbackUrl,
          gradeForCourse,
          textForCourse,
          submit,
        );

        if (result.kind === "inaccessible") {
          result = await retryInaccessibleFeedbackLink(
            entry.url,
            courseId,
            feedbackUrl,
            gradeForCourse,
            textForCourse,
            submit,
          );
        }

        if (result.kind === "inaccessible") {
          report.formsSkippedNotAccessible += 1;
          debug.scraper(
            `[feedback-autofill] Skipping inaccessible feedback ${feedbackUrl}`,
          );
          continue;
        }

        if (result.kind === "error") {
          report.errors.push(`${feedbackUrl}: ${result.message}`);
          continue;
        }

        const fillResult = result.fillResult;
        if (!fillResult.hadQuestions) {
          report.formsSkippedNoQuestions += 1;
          continue;
        }

        if (
          fillResult.radioGroupsFilled > 0 ||
          fillResult.checkboxGroupsFilled > 0 ||
          fillResult.textFieldsFilled > 0
        ) {
          report.formsAttempted += 1;
          report.radioGroupsFilled += fillResult.radioGroupsFilled;
          report.checkboxGroupsFilled += fillResult.checkboxGroupsFilled;
          report.textFieldsFilled += fillResult.textFieldsFilled;
          if (fillResult.submitted) {
            report.formsSubmitted += 1;
          }
        }
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        report.formsSkippedNotAccessible += 1;
        debug.scraper(
          `[feedback-autofill] Skipping inaccessible course ${entry.url}`,
        );
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      report.errors.push(`${entry.url}: ${message}`);
    } finally {
      emitProgress(
        "course",
        index + 1,
        entry.title,
        gradeForCourse,
        textForCourse,
      );
    }
  };

  const worker = async () => {
    while (nextCourseIndex < courseEntries.length) {
      const index = nextCourseIndex;
      nextCourseIndex += 1;
      const entry = courseEntries[index];
      if (!entry) return;
      await processCourse(entry, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  emitProgress(
    "done",
    courseEntries.length,
    "",
    defaultGrade,
    defaultTextResponse,
  );

  debug.scraper("Feedback autofill completed", report);
  return report;
};
