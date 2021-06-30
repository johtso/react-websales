export const AllTicketTypes = ['STANDARD', 'MEMBER'];
export type TicketType = typeof AllTicketTypes[number];

export type SeatStatus = 'SELECTED' | 'AVAILABLE' | 'UNAVAILABLE' | 'DISTANCING';
export type SeatType = {
  id: number;
  sectionId: number;
  columnId: number;
  rowId: number;
  rowLabel: string;
  columnLabel: string;
};
export type SeatPlanType = { id: SeatType['id']; status: SeatStatus }[][][];
