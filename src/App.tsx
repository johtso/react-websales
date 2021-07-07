import { useInterpret, useSelector } from '@xstate/react';
import ActionButton from 'components/ActionButton';
import DigitInput from 'components/DigitInput';
import { compact, groupBy, map, some } from 'lodash-es';
import seatPickerMachine from 'machines';
import './App.css';
import dummySeats from './dummyData';
import './index.css';
import './SeatPicker.css';
import * as types from './types';

const seatingPlan = dummySeats;

const SeatTypeSelector = ({
  ticketSelection,
  handleTicketSelection,
}: {
  ticketSelection: types.TicketSelection;
  handleTicketSelection: (arg0: types.TicketSelection) => void;
}): JSX.Element => (
  <div className="SeatTypeSelector">
    {map(ticketSelection, (count: number, ticketType) => (
      <div className="seat-type-row" key={ticketType}>
        <label htmlFor={ticketType}>{ticketType}</label>
        <DigitInput
          name={ticketType}
          count={count}
          handleChange={(newCount) =>
            handleTicketSelection({ ...ticketSelection, [ticketType]: newCount })
          }
        />
      </div>
    ))}
  </div>
);

const Seat = ({
  status,
  handleSeatToggle,
  separatedFromPrevious,
}: {
  status: types.SeatStatus;
  handleSeatToggle: () => void;
  separatedFromPrevious: boolean;
}) => (
  <button
    type="button"
    className={['seat', status.toLowerCase(), separatedFromPrevious ? 'separated' : ''].join(' ')}
    onClick={['AVAILABLE', 'SELECTED'].includes(status) ? handleSeatToggle : () => {}}
  >
    {{ DISTANCING: '<->', AVAILABLE: 'A', UNAVAILABLE: 'U', SELECTED: 'S' }[status]}
  </button>
);

const SeatPicker = ({
  seatPlan,
  handleSeatToggle,
  loading,
}: {
  seatPlan: types.SeatPlanType;
  handleSeatToggle: (seatId: types.SeatType['id']) => void;
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

const makeSeatPlan = (
  basePlan: typeof seatingPlan,
  seatStates: ('AVAILABLE' | 'SELECTED' | 'UNAVAILABLE' | 'DISTANCING')[]
): types.SeatPlanType =>
  map(groupBy(basePlan, 'rowId'), (rowSeats) =>
    map(groupBy(rowSeats, 'sectionId'), (sectionSeats) =>
      sectionSeats.map((seat, i) => {
        let status = seatStates[seat.id];
        if (status === 'AVAILABLE') {
          const neighbours = compact([sectionSeats[i - 1], sectionSeats[i + 1]]);
          const distancing = some(
            neighbours,
            (neighbour) => seatStates[neighbour.id] === 'UNAVAILABLE'
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

const SeatSelection = (): JSX.Element => {
  const service = useInterpret(seatPickerMachine, {
    context: { seatCount: seatingPlan.length },
    devTools: true,
  });

  const ticketSelection = useSelector(service, (s) => s.context.ticketSelection);
  const seats = useSelector(service, (s) => s.context.seats);
  const seatSelection = useSelector(service, (s) => s.context.seatSelection);
  const isValid = useSelector(service, (s) => s.matches({ active: { validity: 'valid' } }));
  const isLoading = useSelector(service, (s) => s.matches('loading'));

  const seatStates = seats.map((s) => s.getSnapshot().value.toUpperCase());

  const seatPlan = makeSeatPlan(seatingPlan, seatStates);
  const submittingState = false;
  return (
    <div className="App">
      <header className="App-header">
        <span className="selected-seats">
          Selected Seats:
          {seatSelection.join(', ')}
        </span>
        <SeatTypeSelector
          handleTicketSelection={(newTicketSelection) =>
            service.send({ type: 'SET_TICKETS', value: newTicketSelection })
          }
          ticketSelection={ticketSelection}
        />
        <SeatPicker
          seatPlan={seatPlan}
          // @ts-ignore
          handleSeatToggle={(seatId) => seats[seatId].send('USER_TOGGLE')}
          loading={isLoading}
        />
        <ActionButton
          type="submit"
          text={submittingState ? 'Reserving...' : 'Select Seats'}
          // handleClick={() => setSubmittingState(true)}
          handleClick={() => {}}
          busy={submittingState}
          disabled={!isValid}
        />
      </header>
    </div>
  );
};

export default SeatSelection;
