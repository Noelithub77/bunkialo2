export type CourseMappingSource = "code" | "name" | "unresolved";

export interface CourseIdentity {
  key: string;
  termId: string;
  code: string;
  name: string;
  lmsCourseId: string | null;
  attendanceCourseId: string | null;
  mappingSource: CourseMappingSource;
}
