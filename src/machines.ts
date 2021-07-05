import _ from 'lodash-es';
import { actions, ActorRef, assign, send, sendParent, spawn, createMachine } from 'xstate';

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

const seatMachine = createMachine<Record<string, never>, SeatEvent, SeatState>({
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
          actions: [sendParent('SEAT.TOGGLED')],
        },
        SERVER_UNAVAILABLE: 'unavailable',
      },
    },
    selected: {
      on: {
        USER_TOGGLE: {
          target: 'available',
          actions: [sendParent('SEAT.TOGGLED')],
        },
        AUTO_DESELECT: {
          target: 'available',
          actions: [sendParent('SEAT.TOGGLED')],
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

// User must select exactly 2 seats.
const selectionValid = (ctx: SeatPickerContext) => {
  const count = ctx.seats.filter((s) => s.getSnapshot().matches('selected')).length;
  const result = count === ctx.limit;
  console.log({ count, result });
  return result;
};

const sleep = (ms: number): Promise<() => unknown> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const updateArrayPreservingOrder = <T>(array: Readonly<T[]>, newArray: Readonly<T[]>): T[] => {
  const toAdd = _.difference(newArray, array);
  return [..._.filter(array, (i) => newArray.includes(i)), ...toAdd];
};

interface SeatPickerContext {
  seatCount: number;
  seats: ActorRef<typeof seatMachine>[];
  limit: number;
  selections: number[];
}

type SeatPickerState = {
  value: 'idle' | 'loading' | { active: 'invalid' } | { active: 'valid' };
  context: SeatPickerContext;
};

type SeatPickerEvent =
  | { type: 'FETCH'; value: null }
  | { type: 'SET_LIMIT'; value: number }
  | { type: 'SEAT.TOGGLED'; value: null };

const seatPickerMachine = createMachine<SeatPickerContext, SeatPickerEvent, SeatPickerState>(
  {
    id: 'seat-picker',
    initial: 'loading',
    context: { seatCount: 0, seats: [], limit: 2, selections: [] },
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
                  { to: (c: typeof context) => c.seats[i] }
                )
              );
            }),
          },
        },
      },
      active: {
        initial: 'invalid',
        on: {
          SET_LIMIT: {
            actions: [
              assign({
                limit: (c, e) => {
                  console.log(e);
                  return e.value;
                },
              }),
              'enforceSelectionLimit',
            ],
          },
          'SEAT.TOGGLED': {
            actions: ['updateSelections', 'enforceSelectionLimit'],
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
    },
    actions: {
      log: (ctx) => [console.log('something happened'), console.log(ctx.selections)],
      updateSelections: assign((ctx) => {
        const currentlySelected: number[] = _.reduce(
          ctx.seats,
          // @ts-ignore
          (acc, seat, i): number[] => (seat.state.matches('selected') ? [...acc, i] : acc),
          []
        );
        const newSelections = updateArrayPreservingOrder(ctx.selections, currentlySelected);

        return {
          selections: newSelections,
        };
      }),
      enforceSelectionLimit: pure((context, event) => {
        const selectionDiff = context.selections.length - context.limit;
        const excessSelections = selectionDiff < 0 ? 0 : selectionDiff;
        return context.selections
          .slice(0, excessSelections)
          .map((seatId) =>
            send({ type: 'AUTO_DESELECT' }, { to: (c: typeof context) => c.seats[seatId] })
          );
      }),
    },
  }
);

export default seatPickerMachine;
