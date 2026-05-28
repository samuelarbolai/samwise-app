export const STEP_OPTIONS = [
  "Queued",
  "Sent",
  "Replied",
  "Scheduled",
  "Prospecting",
  "Fit Assessment",
  "Disqualified",
  "Optimization",
  "Recommendation",
  "Dead",
] as const;

export type Step = (typeof STEP_OPTIONS)[number];

export const RECOMMENDATION_STATUSES = [
  "Not asked",
  "Asked",
  "Promised",
  "Confirmed",
  "Refused",
] as const;

export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const SOURCE_OPTIONS = ["LinkedIn", "Phone", "Personal", "Event", "Other"] as const;
export type Source = (typeof SOURCE_OPTIONS)[number];

export const TIER_OPTIONS = ["T1", "T2", "T3"] as const;
export type Tier = (typeof TIER_OPTIONS)[number];

export const AUDIENCE_OPTIONS = ["T1", "T2", "Phone"] as const;
export type Audience = (typeof AUDIENCE_OPTIONS)[number];

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  occupation?: string;
  tier?: Tier;
  source?: Source;
  step: Step;
  hook?: string;
  blocker?: string;
  nextAction?: string;
  inBacklog?: boolean;
  ritualsOwned?: string[];
  recommendationStatus: RecommendationStatus;
  recommendationCount?: number;
  notes?: string;
  dueDate?: string;
  templateVersionUsed?: string;
  repliedAt?: number;
  scheduledAt?: number;
  metAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface Template {
  id: string;
  name: string;
  audience: Audience;
  version: number;
  body: string;
  parentVersionId?: string;
  locked: boolean;
  retired: boolean;
  createdAt: number;
  lockedAt?: number;
}

export interface Mistake {
  id: string;
  date: string;
  contactId?: string;
  description: string;
  lesson: string;
  templateVersionFix?: string;
  createdAt: number;
}

export interface DailySession {
  date: string;
  sentCount: number;
  repliesCount: number;
  meetingsCount: number;
  notes?: string;
  targetLinkedin?: number;
  targetPhone?: number;
  targetFollowups?: number;
}

export interface WorkspaceMeta {
  createdAt: number;
  seeded: boolean;
  lastSeededAt?: number;
}
