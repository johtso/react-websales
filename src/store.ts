import { action, Action, Computed, computed } from 'easy-peasy';
import { map } from 'iter-tools';
import * as _ from 'lodash-es';
import * as types from 'types';
import { difference, groupedMap, sum, toggleSetValue } from 'utils';

type SeatsStoreModel = {
  // State
  seats: types.SeatType[];
  selected: Set<types.SeatType['id']>;
  unavailable: Set<types.SeatType['id']>;
  ticketTypes: Map<types.TicketType, number>;

  // Actions
  toggleSelection: Action<SeatsStoreModel, { seatId: number }>;
  setTicketCount: Action<SeatsStoreModel, { ticketType: types.TicketType; count: number }>;
  setUnavailable: Action<SeatsStoreModel, { unavailable: Set<types.SeatType['id']> }>;
  randomAvailabilityChange: Action<SeatsStoreModel>;

  // Computed
  isSelectionValid: Computed<SeatsStoreModel, boolean>;
  selectedSeats: Computed<SeatsStoreModel, string[]>;
  seatPlan: Computed<SeatsStoreModel, types.SeatPlanType>;
};

const makeSeatsStore = (seats: types.SeatType[]): SeatsStoreModel => ({
  // State
  seats,
  selected: new Set(),
  unavailable: new Set(),
  ticketTypes: new Map(map((ticketType) => [ticketType, 0], types.AllTicketTypes)),

  // Actions
  toggleSelection: action((state, { seatId }) => {
    const totalTickets = sum(state.ticketTypes.values());

    toggleSetValue(state.selected, seatId);

    // For first seat selection, if user has not set any ticket quantities
    // set standard ticket count to 1.
    if (totalTickets === 0 && state.selected.size === 1) {
      state.ticketTypes.set('STANDARD', 1);
    } else {
      // If we have more seats selected than ticket quantities, deselect seats
      // starting from least recently selected until equal to ticket quantities.
      const selections = state.selected.values();
      while (state.selected.size > totalTickets) {
        state.selected.delete(selections.next().value);
      }
    }
  }),

  setTicketCount: action((state, { ticketType, count }) => {
    state.ticketTypes.set(ticketType, count);
  }),

  setUnavailable: action((state, { unavailable }) => {
    state.unavailable = unavailable;
    state.selected = difference(state.selected, state.unavailable);
  }),

  randomAvailabilityChange: action((state) => {
    const seatIds = state.seats.map((s) => s.id);
    const oneId = _.sampleSize(seatIds, 1)[0];
    toggleSetValue(state.unavailable, oneId);
  }),

  // Computed
  isSelectionValid: computed((state) => {
    const totalTickets = sum(state.ticketTypes.values());
    return state.selected.size > 0 && totalTickets === state.selected.size;
  }),

  selectedSeats: computed((state) =>
    Array.from(state.selected, (seatId) => {
      const seat = state.seats[seatId];
      return `${seat.rowLabel}${seat.columnLabel}`;
    }).sort()
  ),

  seatPlan: computed((state) => {
    const seatStatus = (seat: types.SeatType): types.SeatStatus => {
      let status: types.SeatStatus;
      if (state.selected.has(seat.id)) {
        status = 'SELECTED';
      } else {
        status = state.unavailable.has(seat.id) ? 'UNAVAILABLE' : 'AVAILABLE';
      }
      return status;
    };

    const seatsByRow = groupedMap(state.seats, 'rowId');
    return Array.from(seatsByRow.values(), (rowSeats) => {
      const seatsBySection = groupedMap(rowSeats, 'sectionId');
      return Array.from(seatsBySection.values(), (sectionSeats) =>
        Array.from(sectionSeats, (seat) => ({
          id: seat.id,
          status: seatStatus(seat),
        }))
      );
    });
  }),
});

export default makeSeatsStore;
