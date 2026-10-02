export interface AttachmentPreview {
  uri: string;
  width: number;
  height: number;
  updatedAt: number;
}
export interface LmsAttachment {
  id: string;
  name: string;
  url: string;
}

export interface PdfAttachmentDocument {
  uri: string;
  pageCount: number;
}
