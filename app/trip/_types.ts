export const TIER_OPTIONS = ["T1", "T2", "T3", "T4", "base"] as const;
export type Tier = (typeof TIER_OPTIONS)[number];

export const REGISTRATION_TYPES = [
  "Required",
  "Soft RSVP",
  "Walk-in",
  "Ticket required",
  "—",
] as const;
export type Registration = (typeof REGISTRATION_TYPES)[number];

export const REGISTRATION_STATUS_OPTIONS = [
  "Not started",
  "Applied",
  "Pending approval",
  "Registered",
  "Confirmed",
  "Declined",
] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUS_OPTIONS)[number];

export const DATE_KIND_OPTIONS = [
  "fixed",
  "anytime",
  "recurring",
  "outside",
  "dead",
] as const;
export type EventDateKind = (typeof DATE_KIND_OPTIONS)[number];

export interface EventItem {
  id: string;
  picked: boolean;
  dateKind: EventDateKind;
  date?: string; // ISO yyyy-mm-dd for fixed
  day?: string; // human label
  time?: string;
  title: string;
  location: string;
  cost: string;
  tier: Tier;
  registration: Registration;
  registrationStatus?: RegistrationStatus;
  link?: string;
  notes?: string;
  cadence?: string; // for recurring
}

export interface RouteStep {
  mode: "Walk" | "Light Rail" | "PATH" | "Subway" | "Bus" | "Other";
  detail: string;
  minutes?: number;
  cost?: number;
}

export interface RouteBlueprint {
  id: string;
  name: string;
  fromTo: string;
  totalMinutes?: number;
  totalCostUSD?: number;
  steps: RouteStep[];
  notes?: string;
}

export interface BudgetLine {
  id: string;
  category:
    | "Transit"
    | "Lodging"
    | "Meetings"
    | "Food"
    | "Groceries"
    | "Events"
    | "Emergency"
    | "Other";
  label: string;
  amountUSD: number;
  amountCOP?: number;
  notes?: string;
}

export interface SpendEntry {
  id: string;
  date: string;
  category: BudgetLine["category"];
  label: string;
  amountUSD: number;
  notes?: string;
}

export interface ContingencyCard {
  id: string;
  situation: string;
  action: string;
  category:
    | "Weather"
    | "Energy"
    | "Conflict"
    | "Transit"
    | "Health"
    | "Outreach"
    | "Money";
}

export interface PackingItem {
  id: string;
  label: string;
  category: "Tech" | "Documents" | "Clothes" | "Food prep" | "Outreach kit" | "Misc";
  checked: boolean;
}

export interface PreTripTodo {
  id: string;
  label: string;
  link?: string;
  dueDate?: string;
  done: boolean;
  notes?: string;
}

export interface DailyPlan {
  date: string; // ISO yyyy-mm-dd
  weekday: string;
  headline: string;
  pickedEventIds: string[];
  routeId?: string;
  budgetAllowanceUSD?: number;
  contingencyOfTheDay?: string;
  morningPrompt: string;
  eveningPrompt: string;
  morningChecked: boolean;
  eveningChecked: boolean;
}

export interface WorkspaceMeta {
  createdAt: number;
  seeded: boolean;
  lastSeededAt?: number;
  sheetId?: string;
  sheetTabName?: string;
  lastPushedAt?: number;
}
