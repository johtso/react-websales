import { action, Action, Computed, computed, State } from 'easy-peasy';
import { compact, difference, groupBy, map, sampleSize, some, sum, values } from 'lodash-es';
import * as types from 'types';
import { pushOrPull } from 'utils';

type SeatsStoreModel = {
  // State
  seats: types.SeatType[];
  selected: types.SeatType['id'][];
  unavailable: types.SeatType['id'][];
  ticketTypes: Record<types.TicketType, number>;

  // Actions
  toggleSelection: Action<SeatsStoreModel, { seatId: number }>;
  setTicketCount: Action<SeatsStoreModel, { ticketType: types.TicketType; count: number }>;
  setUnavailable: Action<SeatsStoreModel, { unavailable: types.SeatType['id'][] }>;
  randomAvailabilityChange: Action<SeatsStoreModel>;

  // Computed
  isSelectionValid: Computed<SeatsStoreModel, boolean>;
  selectedSeats: Computed<SeatsStoreModel, string[]>;
  seatPlan: Computed<SeatsStoreModel, types.SeatPlanType>;
};

const deselectExcessSeats = (state: State<SeatsStoreModel>) => {
  /*
    Deselect seats starting from least recently selected until equal to ticket quantities.
  */
  const totalTickets = sum(values(state.ticketTypes));

  while (state.selected.length > totalTickets) {
    state.selected.shift();
  }
};

const deselectUnavailableSeats = (state: State<SeatsStoreModel>) => {
  state.selected = difference(state.selected, state.unavailable);
};

const makeSeatsStore = (seats: types.SeatType[]): SeatsStoreModel => ({
  // State
  seats,
  selected: [],
  unavailable: [],
  ticketTypes: Object.fromEntries(map(types.AllTicketTypes, (ticketType) => [ticketType, 0])),

  // Actions
  toggleSelection: action((state, { seatId }) => {
    const totalTickets = sum(values(state.ticketTypes));

    pushOrPull(state.selected, seatId);

    // For first seat selection, if user has not set any ticket quantities
    // set standard ticket count to 1.
    if (totalTickets === 0 && state.selected.length === 1) {
      state.ticketTypes.STANDARD = 1;
    } else {
      // If we have more seats selected than ticket quantities,
      deselectExcessSeats(state);
    }
  }),

  setTicketCount: action((state, { ticketType, count }) => {
    state.ticketTypes[ticketType] = count;
    deselectExcessSeats(state);
  }),

  setUnavailable: action((state, { unavailable }) => {
    state.unavailable = unavailable;
    deselectUnavailableSeats(state);
  }),

  randomAvailabilityChange: action((state) => {
    const seatIds = state.seats.map((s) => s.id);
    const oneId = sampleSize(seatIds, 1)[0];
    pushOrPull(state.unavailable, oneId);
    deselectUnavailableSeats(state);
  }),

  // Computed
  isSelectionValid: computed((state) => {
    const totalTickets = sum(values(state.ticketTypes));
    return state.selected.length > 0 && totalTickets === state.selected.length;
  }),

  selectedSeats: computed((state) =>
    state.selected
      .map((seatId) => {
        const seat = state.seats[seatId];
        return `${seat.rowLabel}${seat.columnLabel}`;
      })
      .sort()
  ),

  seatPlan: computed((state) => {
    const seatStatus = (seat: types.SeatType): types.SeatStatus => {
      let status: types.SeatStatus;
      if (state.selected.includes(seat.id)) {
        status = 'SELECTED';
      } else {
        status = state.unavailable.includes(seat.id) ? 'UNAVAILABLE' : 'AVAILABLE';
      }
      return status;
    };

    return map(groupBy(state.seats, 'rowId'), (rowSeats) =>
      map(groupBy(rowSeats, 'sectionId'), (sectionSeats) =>
        sectionSeats.map((seat, i) => {
          let status = seatStatus(seat);
          if (status === 'AVAILABLE') {
            const neighbours = compact([sectionSeats[i - 1], sectionSeats[i + 1]]);
            const distancing = some(
              neighbours,
              (neighbour) => seatStatus(neighbour) === 'UNAVAILABLE'
            );
            if (distancing) {
              status = 'DISTANCING';
            }
          }
          return {
            id: seat.id,
            status,
          };
        })
      )
    );
  }),
});

export default makeSeatsStore;