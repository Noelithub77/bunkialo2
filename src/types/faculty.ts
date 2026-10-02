/**
 * Faculty types
 */

export interface FacultyContact {
  phone: string | null;
  email: string | null;
  room: string | null;
}

export interface FacultyPage {
  text: string | null;
  link: string | null;
}

export interface Faculty {
  id: string;
  name: string;
  designation: string;
  additionalRole: string | null;
  qualification: string | null;
  imageUrl: string | null;
  areas: string[];
  contact: FacultyContact;
  page: FacultyPage;
  hostelRoles?: { hostelId: string; role: string }[];
}

export interface FacultyData {
  faculties: Faculty[];
  topFacultyIds: string[];
  lastUpdated: number;
}

export interface FacultyState {
  faculties: Faculty[];
  topFacultyIds: string[];
  recentSearches: string[];
  isLoading: boolean;
  error: string | null;
}

export interface HostelGroup {
  id: string;
  name: string;
  wardenIds: string[];
}

export interface FacultyPhotoStorage {
  directory: string | null;
  exists: (path: string) => Promise<boolean>;
  prepareDirectory: () => Promise<void>;
  download: (url: string, path: string) => Promise<boolean>;
  move: (from: string, to: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
}
