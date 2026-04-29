import { Appointment } from './appointment';

export interface SidebarRightProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: "therapist" | "patient" | "admin";
}

export interface SidebarSectionData {
  list: Appointment[];
  count: number;
  readOnly: boolean;
}

export type SectionTab = "today" | "pending" | "history";