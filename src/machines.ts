import _ from 'lodash-es';
import * as types from 'types';
import { assignableProduce as produce, sleep } from 'utils';
import { actions, assign, createMachine, DoneInvokeEvent, ExtractEvent, send } from 'xstate';
import { choose } from 'xstate/lib/actions';
import { createModel, ModelEventsFrom } from 'xstate/lib/model';
import dummySeats from './dummyData';

const { pure } = actions;

interface SeatPickerContext {
  seatPlan?: types.SeatType[];
  defaultTicket: types.DefaultTicketType;
  ticketSelection: types.TicketSelection;
  unavailableSeats: Set<types.SeatId>;
  selectedSeats: Set<types.SeatId>;
}

const seatPickerModel = createModel(
  {
    defaultTicket: 'STANDARD',
    ticketSelection: {
      STANDARD: 0,
      MEMBER: 0,
    },
    unavailableSeats: new Set(),
    selectedSeats: new Set(),
  } as SeatPickerContext,
  {
    // Event creators
    events: {
      userUpdateTickets: (value: types.TicketSelection) => ({ value }),
      userToggleSeat: (value: types.SeatId) => ({ value }),
      seatWasSelected: (value: types.SeatId) => ({ value }),
    },
  }
);

type SeatPickerEvent = ModelEventsFrom<typeof seatPickerModel>;

// Response when fetching seat data
type GetSeatsDataType = { seatPlan: types.SeatType[]; unavailableSeats: types.SeatId[] };

// User must select exactly 2 seats.
const selectionValid = (ctx: SeatPickerContext) => {
  const ticketCount = _.sum(_.values(ctx.ticketSelection));
  if (ticketCount === 0) {
    return false;
  }
  return ticketCount === ctx.selectedSeats.size;
};

const seatPickerMachine = createMachine<typeof seatPickerModel>(
  {
    id: 'seat-picker',
    initial: 'loading',
    context: seatPickerModel.initialContext,
    states: {
      loading: {
        invoke: {
          id: 'getSeats',
          src: () =>
            sleep(5000).then(
              () =>
                ({
                  seatPlan: dummySeats,
                  unavailableSeats: _.sampleSize(
                    _.range(0, dummySeats.length),
                    dummySeats.length / 4
                  ),
                } as GetSeatsDataType)
            ),
          onDone: {
            target: 'active',
            actions: assign(
              produce((draft, event: DoneInvokeEvent<GetSeatsDataType>) => {
                draft.seatPlan = event.data.seatPlan;
                draft.unavailableSeats = new Set(event.data.unavailableSeats);
              })
            ),
          },
        },
      },
      active: {
        initial: 'invalid',
        on: {
          userUpdateTickets: {
            actions: [
              assign(
                produce((draft, event: ExtractEvent<SeatPickerEvent, 'userUpdateTickets'>) => {
                  draft.ticketSelection = event.value;
                })
              ),
              'enforceSelectionLimit',
            ],
          },
          userToggleSeat: {
            actions: 'toggleSeat',
          },
          seatWasSelected: {
            actions: [
              choose([
                {
                  cond: 'noTicketsSelected',
                  actions: 'selectOneDefaultTicket',
                },
                {
                  actions: 'enforceSelectionLimit',
                },
              ]),
            ],
          },
        },
        states: {
          invalid: {
            always: [
              {
                target: 'valid',
                cond: 'selectionValid',
              },
            ],
          },
          valid: {
            always: [
              {
                target: 'invalid',
                cond: 'selectionInvalid',
              },
            ],
          },
        },
      },
    },
  },
  {
    guards: {
      selectionValid,
      selectionInvalid: _.negate(selectionValid),
      noTicketsSelected: (ctx) => _.sum(_.values(ctx.ticketSelection)) === 0,
    },
    actions: {
      toggleSeat: pure((ctx, event) => {
        const toggledSeatId = event.value as types.SeatId;
        if (ctx.unavailableSeats.has(toggledSeatId)) {
          return [];
        }

        if (ctx.selectedSeats.has(toggledSeatId)) {
          return [
            assign(
              produce((draft: typeof ctx) => {
                draft.selectedSeats.delete(toggledSeatId);
              })
            ),
          ];
        }
        return [
          assign(
            produce((draft: typeof ctx) => {
              draft.selectedSeats.add(toggledSeatId);
            })
          ),
          send(seatPickerModel.events.seatWasSelected(toggledSeatId)),
        ];
      }),
      enforceSelectionLimit: assign(
        produce((draft) => {
          const totalTickets = _.sum(_.values(draft.ticketSelection));
          const selectionDiff = draft.selectedSeats.size - totalTickets;
          const excessSelections = selectionDiff < 0 ? 0 : selectionDiff;

          if (excessSelections) {
            draft.selectedSeats = new Set(Array.from(draft.selectedSeats).slice(excessSelections));
          }
        })
      ),
      selectOneDefaultTicket: assign(
        produce((draft) => {
          draft.ticketSelection[draft.defaultTicket] = 1;
        })
      ),
    },
  }
);

export { seatPickerMachine, seatPickerModel };
