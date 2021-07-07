export const AllTicketTypes = ['STANDARD', 'MEMBER'];
export type DefaultTicketType = 'STANDARD';
export type TicketType = typeof AllTicketTypes[number];
type PartialPick<T, K extends keyof T> = Pick<T, K> & Partial<Exclude<T, K>>;
export type TicketSelection = PartialPick<Record<TicketType, number>, DefaultTicketType>;

export type SeatStatus = 'SELECTED' | 'AVAILABLE' | 'UNAVAILABLE' | 'DISTANCING';
export type SeatType = {
  id: number;
  sectionId: number;
  columnId: number;
  rowId: number;
  rowLabel: string;
  columnLabel: string;
};
export type SeatId = SeatType['id'];
export type SeatPlanType = { id: SeatType['id']; status: SeatStatus }[][][];
