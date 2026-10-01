/** Native multipart transports can report more bytes than their estimated total. */
export const clampUploadProgress = (fraction: number | null): number | null =>
  fraction === null || !Number.isFinite(fraction)
    ? null
    : Math.min(1, Math.max(0, fraction));

export const getBatchUploadProgress = (
  completedFiles: number,
  fileCount: number,
  fraction: number | null,
): number | null => {
  const bounded = clampUploadProgress(fraction);
  return bounded === null || fileCount <= 0
    ? null
    : clampUploadProgress((completedFiles + bounded) / fileCount);
};
