export type CourseMappingSource = "code" | "name" | "manual" | "unresolved";

export interface CourseIdentity {
  key: string;
  termId: string;
  code: string;
  name: string;
  lmsCourseId: string | null;
  attendanceCourseId: string | null;
  mappingSource: CourseMappingSource;
}

export interface ManualCourseLink {
  termId: string;
  attendanceCourseId: string;
  lmsCourseId: string | null;
}
