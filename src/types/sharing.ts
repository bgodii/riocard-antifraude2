export interface CardSharingTimelineEvent {
  time: string;
  location: string;
  action: string;
}

export interface CardSharingEvent {
  id: string;
  cardId: string;
  estimatedUsers: number;
  intervalMinutes: number;
  simultaneousLocations: string[];
  timeline: CardSharingTimelineEvent[];
}
