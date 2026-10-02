import type { LmsAttachment } from "./attachment-preview";
export interface LmsDiscussion {
  id: string;
  title: string;
  url: string;
}
export interface LmsForumPost {
  id: string;
  title: string;
  author: string;
  date: string | null;
  body: string;
  attachments: LmsAttachment[];
}
