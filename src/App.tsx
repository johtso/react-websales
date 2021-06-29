import * as React from 'react';
import { reduce, map } from 'iter-tools';
import { enableMapSet, produce } from 'immer';
import * as _ from 'lodash-es';
import './index.css';
import './App.css';
import './SeatPicker.css';
import { useLocalStore, action, Action } from 'easy-peasy';
import dummySeats from './dummyData';

enableMapSet();

const seatingPlan = dummySeats;

const groupedMap = <T, U extends keyof T, V extends T[U]>(
  initialArray: T[],
  property: U
): Map<V, T[]> =>
  initialArray.reduce(
    (resultMap, obj: T) =>
      resultMap.set(obj[property], [...(resultMap.get(obj[property]) || []), obj]),
    new Map()
  );

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sum = (numbers: Iterable<number>): number =>
  reduce(0, (result, value) => result + value, numbers);

function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const diff = new Set(setA);
  for (const elem of setB) {
    diff.delete(elem);
  }
  return diff;
}

const TICKET_TYPES = ['STANDARD', 'MEMBER'];
type TicketTypeType = typeof TICKET_TYPES[number];

type SeatTypeSelectorProps = {
  setTicketCount: (type: TicketTypeType, count: number) => void;
  ticketCounts: SeatSelectionStateType['ticketTypes'];
};

type NumStoreModel = {
  count: number;
  inc: Action<NumStoreModel>;
  dec: Action<NumStoreModel>;
};

const makeNumStore = (): NumStoreModel => ({
  count: 0,
  inc: action((state) => {
    state.count += 1;
  }),
  dec: action((state) => {
    state.count -= 1;
  }),
});

const NumberInput = (
  props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>
) => {
  const realInputRef = React.createRef<HTMLInputElement>();

  const [state, actions] = useLocalStore(makeNumStore, undefined, () => ({
    name: 'some-counter',
  }));

  // var nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  // nativeInputValueSetter.call(input, 'react 16 value');

  // var ev2 = new Event('input', { bubbles: true });
  // input.dispatchEvent(ev2);
  return (
    <div className="number-input">
      {state.count}
      <button type="button" onClick={() => actions.dec()} className="minus">
        -
      </button>
      <input {...props} type="number" ref={realInputRef} />
      <button type="button" onClick={() => actions.inc()} className="plus">
        +
      </button>
    </div>
  );
};

const SeatTypeSelector = ({ ticketCounts, setTicketCount }: SeatTypeSelectorProps) => (
  <form
    onSubmit={(e) => {
      e.preventDefault();
    }}
  >
    {[
      ...map(
        ([type, count]) => (
          <label key={type}>
            {type}
            <NumberInput
              value={count}
              min="0"
              max="9"
              onChange={(e) => setTicketCount(type, +e.target.value)}
            />
          </label>
        ),
        ticketCounts.entries()
      ),
    ]}
  </form>
);

type SeatStatus = 'SELECTED' | 'AVAILABLE' | 'UNAVAILABLE' | 'DISTANCING';

const Seat = ({
  status,
  handleSeatToggle,
  separatedFromPrevious,
}: {
  status: SeatStatus;
  handleSeatToggle: () => void;
  separatedFromPrevious: boolean;
}) => (
  <button
    type="button"
    className={['seat', status.toLowerCase(), separatedFromPrevious ? 'separated' : ''].join(' ')}
    onClick={status === 'UNAVAILABLE' ? () => {} : handleSeatToggle}
  >
    S
  </button>
);

type SeatType = {
  id: number;
  sectionId: number;
  columnId: number;
  rowId: number;
  rowLabel: string;
  columnLabel: string;
};

type SeatPickerActionType =
  | { type: 'SELECT_TOGGLE'; seatId: SeatType['id'] }
  | { type: 'SET_TICKET_COUNT'; ticketType: TicketTypeType; count: number }
  | {
      type: 'SET_UNAVAILABLE';
      unavailable: SeatSelectionStateType['unavailable'];
    };

const seatSelectionStateReducer = produce(
  // eslint-disable-next-line @typescript-eslint/no-shadow
  (draft: SeatSelectionStateType, action: SeatPickerActionType) => {
    const totalTickets = () => sum(draft.ticketTypes.values());

    switch (action.type) {
      case 'SELECT_TOGGLE': {
        if (draft.selected.has(action.seatId)) {
          draft.selected.delete(action.seatId);
        } else {
          draft.selected.add(action.seatId);
        }

        if (totalTickets() === 0 && draft.selected.size === 1) {
          draft.ticketTypes.set('STANDARD', 1);
        }

        const selections = draft.selected.values();
        while (draft.selected.size > totalTickets()) {
          draft.selected.delete(selections.next().value);
        }
        break;
      }
      case 'SET_TICKET_COUNT': {
        draft.ticketTypes.set(action.ticketType, action.count);
        break;
      }
      case 'SET_UNAVAILABLE': {
        draft.unavailable = action.unavailable;
        draft.selected = difference(draft.selected, draft.unavailable);
        break;
      }
      default: {
        // this will never happen.
      }
    }

    draft.validSelection = draft.selected.size > 0 && totalTickets() === draft.selected.size;
  }
);

const SeatPicker = ({
  seatPlan,
  handleSeatToggle,
  loading,
}: {
  seatPlan: SeatPlanType;
  handleSeatToggle: (seatId: SeatType['id']) => void;
  loading: boolean;
}) => (
  <div className={`seat-picker ${loading ? 'loading' : ''}`}>
    {seatPlan.map((rowSeats, rowIndex) => (
      // eslint-disable-next-line react/no-array-index-key
      <div className="row" key={`row-${rowIndex}`}>
        {rowSeats.map((sectionSeats, sectionIndex) =>
          sectionSeats.map((seat, seatIndex) => (
            <Seat
              key={`seat-${seat.id}`}
              status={seat.status}
              handleSeatToggle={() => handleSeatToggle(seat.id)}
              separatedFromPrevious={seatIndex === 0 && sectionIndex !== 0}
            />
          ))
        )}
      </div>
    ))}
    {loading ? (
      <div className="loading-overlay">
        <div className="loader" />
      </div>
    ) : null}
  </div>
);

type SeatPlanType = { id: SeatType['id']; status: SeatStatus }[][][];

type SeatSelectionStateType = {
  selected: Set<SeatType['id']>;
  unavailable: Set<SeatType['id']>;
  ticketTypes: Map<TicketTypeType, number>;
  validSelection: boolean;
};

const makeSeatPlan = (
  seats: SeatType[],
  selected: SeatSelectionStateType['selected'],
  unavailable: SeatSelectionStateType['unavailable']
): SeatPlanType => {
  const seatStatus = (seat: SeatType): SeatStatus => {
    let status: SeatStatus;
    if (selected.has(seat.id)) {
      status = 'SELECTED';
    } else {
      status = unavailable.has(seat.id) ? 'UNAVAILABLE' : 'AVAILABLE';
    }
    return status;
  };

  const seatsByRow = groupedMap(seats, 'rowId');
  return Array.from(seatsByRow.values(), (rowSeats) => {
    const seatsBySection = groupedMap(rowSeats, 'sectionId');
    return Array.from(seatsBySection.values(), (sectionSeats) =>
      Array.from(sectionSeats, (seat) => ({
        id: seat.id,
        status: seatStatus(seat),
      }))
    );
  });
};

const initialSeatSelectionState: SeatSelectionStateType = {
  selected: new Set(),
  unavailable: new Set(),
  ticketTypes: new Map(map((ticketType) => [ticketType, 0], TICKET_TYPES)),
  validSelection: false,
};

const fetchSeatData = () =>
  new Promise((resolve: (value: Set<SeatType['id']>) => void) => {
    const seatIds = seatingPlan.map((s) => s.id);
    const unavailable = new Set(_.sampleSize(seatIds, _.random(1, Math.round(seatIds.length / 2))));
    sleep(3000).then(() => resolve(unavailable));
  });

const SeatSelection = () => {
  const [state, dispatch] = React.useReducer(seatSelectionStateReducer, initialSeatSelectionState);
  const [loadingState, setLoadingState] = React.useState(true);
  const [submittingState, setSubmittingState] = React.useState(false);

  const handleSeatToggle = (seatId: SeatType['id']): void => {
    console.log({ seatId });
    dispatch({ type: 'SELECT_TOGGLE', seatId });
  };

  const selectedSeats = Array.from(state.selected, (seatId) => {
    const seat = seatingPlan[seatId];
    return `${seat.rowLabel}${seat.columnLabel}`;
  }).sort();

  React.useEffect(() => {
    const continuouslyFetchSeatData = (initial = false) => {
      fetchSeatData().then((value) => {
        dispatch({ type: 'SET_UNAVAILABLE', unavailable: value });
        if (initial === true) {
          setLoadingState(false);
        }
        sleep(4000).then(() => continuouslyFetchSeatData());
      });
    };
    continuouslyFetchSeatData(true);
  }, []);

  const handleSubmit = () => {
    setSubmittingState(!submittingState);
  };

  const handleSetTicketCount = React.useCallback((ticketType: TicketTypeType, count: number) => {
    dispatch({
      type: 'SET_TICKET_COUNT',
      ticketType,
      count,
    });
  }, []);

  const fullSeatPlan = makeSeatPlan(seatingPlan, state.selected, state.unavailable);
  return (
    <div className="App">
      <header className="App-header">
        <span className="selected-seats">
          Selected Seats:
          {selectedSeats.join(', ')}
        </span>
        <SeatTypeSelector setTicketCount={handleSetTicketCount} ticketCounts={state.ticketTypes} />
        <SeatPicker
          seatPlan={fullSeatPlan}
          handleSeatToggle={handleSeatToggle}
          loading={loadingState}
        />
        <button
          type="submit"
          className={`my-button ${submittingState ? 'busy' : ''}`}
          onClick={handleSubmit}
          disabled={!state.validSelection}
        >
          <svg
            className="w-5 h-5 mr-3 -ml-1 text-white animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Select Seats
        </button>
      </header>
    </div>
  );
};

export default SeatSelection;
