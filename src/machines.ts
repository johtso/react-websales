import _ from 'lodash-es';
import { actions, ActorRef, assign, send, sendParent, spawn, createMachine } from 'xstate';
import * as types from 'types';

const { pure } = actions;

type SeatState = {
  value: 'unknown' | 'available' | 'selected' | 'unavailable';
  // eslint-disable-next-line @typescript-eslint/ban-types
  context: {};
};

type SeatEvent =
  | { type: 'SERVER_UNAVAILABLE'; value: null }
  | { type: 'SERVER_AVAILABLE'; value: null }
  | { type: 'AUTO_DESELECT'; value: null }
  | { type: 'USER_TOGGLE'; value: null };

const seatMachine = createMachine({
  id: 'seat',
  initial: 'unknown',
  states: {
    unknown: {
      on: {
        SERVER_UNAVAILABLE: 'unavailable',
        SERVER_AVAILABLE: 'available',
      },
    },
    available: {
      on: {
        USER_TOGGLE: {
          target: 'selected',
          actions: [sendParent('SEAT.USER_TOGGLE')],
        },
        SERVER_UNAVAILABLE: 'unavailable',
      },
    },
    selected: {
      on: {
        USER_TOGGLE: {
          target: 'available',
          actions: [sendParent('SEAT.USER_TOGGLE')],
        },
        AUTO_DESELECT: {
          target: 'available',
          // actions: [sendParent('SEAT.USER_TOGGLE')],
        },
        SERVER_UNAVAILABLE: 'unavailable',
      },
    },
    unavailable: {
      on: {
        SERVER_AVAILABLE: 'available',
      },
    },
  },
});

// type TicketType = 'STANDARD' | 'MEMBER';
// type TicketSelection = Partial<Record<TicketType, number>>;

// User must select exactly 2 seats.
const selectionValid = (ctx: SeatPickerContext) => {
  const selectedCount = _.sum(_.values(ctx.ticketSelection));
  if (selectedCount === 0) {
    return false;
  }
  const count = ctx.seats.filter((s) => s.getSnapshot().matches('selected')).length;
  const result = count === selectedCount;
  return result;
};

const sleep = (ms: number): Promise<() => unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const updateArrayPreservingOrder = <T>(array: Readonly<T[]>, newArray: Readonly<T[]>): T[] => {
  const toAdd = _.difference(newArray, array);
  return [..._.filter(array, (i) => newArray.includes(i)), ...toAdd];
};

interface SeatPickerContext {
  defaultTicket: types.DefaultTicketType;
  ticketSelection: types.TicketSelection;
  seatCount: number;
  seats: ActorRef<typeof seatMachine>[];
  seatSelection: number[];
}

// interface ActiveState {
//   validity: 'invalid' | 'valid';
//   ticketsSelected: 'none' | 'some';
// }

// interface SeatPickerState {
//   value: 'idle' | 'loading' | { active: ActiveState };
//   context: SeatPickerContext;
// }

type SeatPickerEvent =
  | { type: 'FETCH'; value: null }
  | { type: 'SET_TICKETS'; value: types.TicketSelection }
  | { type: 'SEAT.USER_TOGGLE'; value: null };

type SeatPickerState =
  | {
      value: 'loading';
      context: SeatPickerContext & {
        seatCount: 0;
        limit: 0;
        selections: [];
      };
    }
  | {
      value: 'active';
      context: SeatPickerContext;
    }
  | {
      value: { active: { ticketsSelected: 'none' } };
      context: SeatPickerContext & { selections: [] };
    };

const seatPickerMachine = createMachine<SeatPickerContext, SeatPickerEvent>(
  {
    id: 'seat-picker',
    initial: 'loading',
    context: {
      defaultTicket: 'STANDARD',
      ticketSelection: {
        STANDARD: 0,
        MEMBER: 0,
      },
      // Total number of seats in the auditorium
      // We spawn this number of seat machines.
      seatCount: 0,
      // Our seat machines (seat id = array index)
      seats: [],
      // Currently selected seats in order of selection.
      // This is used to deselect seats in a FIFO manner when "limit" is reached.
      seatSelection: [],
    },
    states: {
      loading: {
        // @ts-ignore
        entry: assign((ctx) => ({
          seats: _.range(0, ctx.seatCount).map((i) => spawn(seatMachine, `seat-${i}`)),
        })),
        invoke: {
          id: 'getSeats',
          src: (ctx) =>
            sleep(5000).then(() => _.range(0, ctx.seatCount).map(() => _.sample([0, 1]))),
          onDone: {
            target: 'active',
            actions: pure((context, event) => {
              console.log(event.data);
              return event.data.map((s: 0 | 1, i: number) =>
                send(
                  { type: s ? 'SERVER_AVAILABLE' : 'SERVER_UNAVAILABLE' },
                  { to: (c: SeatPickerContext) => c.seats[i] }
                )
              );
            }),
          },
        },
      },
      active: {
        type: 'parallel',
        on: {
          SET_TICKETS: {
            actions: [
              assign({
                ticketSelection: (c, e) => e.value,
              }),
              'enforceSelectionLimit',
            ],
          },
          'SEAT.USER_TOGGLE': {
            actions: ['updateSeatSelections', 'enforceSelectionLimit'],
          },
        },
        states: {
          validity: {
            initial: 'invalid',
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
          ticketsSelected: {
            initial: 'none',
            states: {
              none: {
                always: [
                  {
                    target: 'some',
                    cond: (ctx) => _.sum(_.values(ctx.ticketSelection)) > 0,
                  },
                ],
                on: {
                  'SEAT.USER_TOGGLE': {
                    // When user toggles a seat with no tickets selected, set default ticket quantity to 1.
                    actions: [
                      'selectOneDefaultTicket',
                      'updateSeatSelections',
                      'enforceSelectionLimit',
                    ],
                  },
                },
              },
              some: {
                always: [
                  {
                    target: 'none',
                    cond: (ctx) => _.sum(_.values(ctx.ticketSelection)) === 0,
                  },
                ],
              },
            },
          },
        },
      },
    },
  },
  {
    guards: {
      selectionValid,
      selectionInvalid: _.negate(selectionValid),
    },
    actions: {
      log: (ctx) => [console.log('something happened'), console.log(ctx.seatSelection)],
      updateSeatSelections: assign((ctx) => {
        const currentlySelected: number[] = _.reduce(
          ctx.seats,
          // @ts-ignore
          (acc, seat, i): number[] => (seat.state.matches('selected') ? [...acc, i] : acc),
          []
        );
        const newSelections = updateArrayPreservingOrder(ctx.seatSelection, currentlySelected);

        return {
          seatSelection: newSelections,
        };
      }),
      enforceSelectionLimit: pure((ctx) => {
        const selectionDiff = ctx.seatSelection.length - _.sum(_.values(ctx.ticketSelection));
        const excessSelections = selectionDiff < 0 ? 0 : selectionDiff;
        console.log(ctx.seatSelection);
        return ctx.seatSelection
          .slice(0, excessSelections)
          .map((seatId) =>
            send({ type: 'AUTO_DESELECT' }, { to: (c: typeof ctx) => c.seats[seatId] })
          );
      }),
      selectOneDefaultTicket: assign((ctx) => ({
        ticketSelection: {
          ...ctx.ticketSelection,
          [ctx.defaultTicket]: 1,
        },
      })),
    },
  }
);

export default seatPickerMachine;
