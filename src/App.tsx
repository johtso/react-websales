import { useInterpret, useSelector } from '@xstate/react';
import ActionButton from 'components/ActionButton';
import DigitInput from 'components/DigitInput';
import { compact, groupBy, map, some } from 'lodash-es';
import { seatPickerMachine, seatPickerModel } from 'machines';
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
    devTools: true,
  });

  const ticketSelection = useSelector(service, (s) => s.context.ticketSelection);
  const selectedSeats = useSelector(service, (s) => s.context.selectedSeats);
  const unavailableSeats = useSelector(service, (s) => s.context.unavailableSeats);
  const isValid = useSelector(service, (s) => s.matches({ active: 'valid' }));
  const isLoading = useSelector(service, (s) => s.matches('loading'));

  console.log('rendering with', { selectedSeats });

  const seatStates: types.SeatStatus[] = seatingPlan.map((s, i) => {
    switch (true) {
      case selectedSeats.has(i):
        return 'SELECTED';
      case unavailableSeats.has(i):
        return 'UNAVAILABLE';
      default:
        return 'AVAILABLE';
    }
  });

  const seatPlan = makeSeatPlan(seatingPlan, seatStates);
  const submittingState = false;
  return (
    <div className="App">
      <header className="App-header">
        <span className="selected-seats">
          Selected Seats:
          {Array.from(selectedSeats).join(', ')}
        </span>
        <SeatTypeSelector
          handleTicketSelection={(newTicketSelection) =>
            service.send(seatPickerModel.events.userUpdateTickets(newTicketSelection))
          }
          ticketSelection={ticketSelection}
        />
        <SeatPicker
          seatPlan={seatPlan}
          // @ts-ignore
          handleSeatToggle={(seatId) => service.send(seatPickerModel.events.userToggleSeat(seatId))}
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
