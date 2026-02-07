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
