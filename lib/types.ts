export type LeadStatus =
  | "untouched"
  | "not_home"
  | "not_interested"
  | "callback"
  | "appointment"
  | "sold"
  | "follow_up";

export const LEAD_STATUS_CONFIG: Record<
  LeadStatus,
  { label: string; color: string; icon: string }
> = {
  untouched: { label: "Untouched", color: "#94A3B8", icon: "map-pin" },
  not_home: { label: "Not Home", color: "#F59E0B", icon: "home" },
  not_interested: { label: "Not Interested", color: "#EF4444", icon: "x-circle" },
  callback: { label: "Callback", color: "#3B82F6", icon: "phone-call" },
  appointment: { label: "Appointment", color: "#8B5CF6", icon: "calendar" },
  sold: { label: "Sold", color: "#10B981", icon: "check-circle" },
  follow_up: { label: "Follow Up", color: "#06B6D4", icon: "refresh-cw" },
};

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  latitude: number;
  longitude: number;
  status: LeadStatus;
  notes: string;
  tags: string[];
  followUpDate: string | null;
  appointmentDate: string | null;
  createdAt: string;
  updatedAt: string;
  knockedAt: string | null;
}

export interface DailyStats {
  date: string;
  doorsKnocked: number;
  contacts: number;
  appointments: number;
  sales: number;
  notHome: number;
  notInterested: number;
  callbacks: number;
}

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export const TERRITORY_COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#06B6D4",
  "#EC4899",
  "#F97316",
];

export interface Territory {
  id: string;
  name: string;
  color: string;
  points: Coordinate[];
  assignedRep: string;
  createdAt: string;
  updatedAt: string;
}
