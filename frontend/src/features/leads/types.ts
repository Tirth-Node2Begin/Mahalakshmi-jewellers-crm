export type LeadStatus =
  | "New"
  | "Contacted"
  | "Qualified"
  | "Meeting Scheduled"
  | "Meeting Done"
  | "Proposal Sent"
  | "Negotiation"
  | "Converted"
  | "Dropped"
  | "Lost";

export type LeadChannel =
  | "walk_in"
  | "phone"
  | "website"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "google"
  | "referral"
  | "other";

export const LEAD_STATUSES: LeadStatus[] = [
  "New",
  "Contacted",
  "Qualified",
  "Meeting Scheduled",
  "Meeting Done",
  "Proposal Sent",
  "Negotiation",
  "Converted",
  "Dropped",
  "Lost",
];

export const LEAD_CHANNELS: LeadChannel[] = [
  "walk_in",
  "phone",
  "website",
  "whatsapp",
  "facebook",
  "instagram",
  "google",
  "referral",
  "other",
];

export interface LeadSource {
  id: number;
  name: string;
  is_active: 0 | 1;
}

export interface LeadUser {
  id: number;
  full_name: string;
}

export interface Lead {
  id: number;
  name: string;
  mobile: string | null;
  email: string | null;
  company: string | null;
  city: string | null;
  source_id: number | null;
  source_name: string | null;
  source_detail: string | null;
  channel_type: LeadChannel;
  service_interest: string | null;
  expected_value: string | null;
  status: LeadStatus;
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: number | null;
  created_by_name: string | null;
  notes: string | null;
  lead_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadStats {
  total: number;
  new_today: number;
  open_pipeline: number;
  converted: number;
  dropped_lost: number;
  open_value: string | number;
}

export interface LeadListResponse {
  leads: Lead[];
  stats: LeadStats;
  sources: LeadSource[];
  users: LeadUser[];
  statuses: LeadStatus[];
  channels: LeadChannel[];
}
