import ActionButton from 'components/ActionButton';
import DigitInput from 'components/DigitInput';
import { useLocalStore } from 'easy-peasy';
import { map } from 'iter-tools';
import * as _ from 'lodash-es';
import * as React from 'react';
import makeSeatsStore from 'store';
import { sleep } from 'utils';
import './App.css';
import dummySeats from './dummyData';
import './index.css';
import './SeatPicker.css';
import * as types from './types';

const seatingPlan = dummySeats;

const SeatTypeSelector = ({
  ticketCounts,
  setTicketCount,
}: {
  ticketCounts: Map<types.TicketType, number>;
  setTicketCount: (payload: { ticketType: types.TicketType; count: number }) => void;
}) => (
  <form
    className="SeatTypeSelector"
    onSubmit={(e) => {
      e.preventDefault();
    }}
  >
    {[
      ...map(
        ([type, count]) => (
          <div className="seat-type-row" key={type}>
            <label htmlFor={type}>{type}</label>
            <DigitInput
              name={type}
              count={count}
              handleChange={(newCount) => setTicketCount({ ticketType: type, count: newCount })}
            />
          </div>
        ),
        ticketCounts.entries()
      ),
    ]}
  </form>
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
    onClick={status === 'UNAVAILABLE' ? () => {} : handleSeatToggle}
  >
    S
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

const fetchSeatData = () =>
  new Promise((resolve: (value: Set<types.SeatType['id']>) => void) => {
    const seatIds = seatingPlan.map((s) => s.id);
    const unavailable = new Set(_.sampleSize(seatIds, _.random(1, Math.round(seatIds.length / 2))));
    sleep(3000).then(() => resolve(unavailable));
  });

const SeatSelection = (): JSX.Element => {
  const [state, actions] = useLocalStore(() => makeSeatsStore(seatingPlan));

  const [loadingState, setLoadingState] = React.useState(true);
  const [submittingState, setSubmittingState] = React.useState(false);

  React.useEffect(() => {
    const continuouslyUpdateAvailability = () => {
      actions.randomAvailabilityChange();
      sleep(10000).then(() => continuouslyUpdateAvailability());
    };

    fetchSeatData().then((value) => {
      actions.setUnavailable({ unavailable: value });
      setLoadingState(false);
      sleep(10000).then(() => continuouslyUpdateAvailability());
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <span className="selected-seats">
          Selected Seats:
          {state.selectedSeats.join(', ')}
        </span>
        <SeatTypeSelector
          setTicketCount={actions.setTicketCount}
          ticketCounts={state.ticketTypes}
        />
        <SeatPicker
          seatPlan={state.seatPlan}
          handleSeatToggle={(seatId) => actions.toggleSelection({ seatId })}
          loading={loadingState}
        />
        <ActionButton
          type="submit"
          text={submittingState ? 'Reserving...' : 'Select Seats'}
          handleClick={() => setSubmittingState(true)}
          busy={submittingState}
          disabled={!state.isSelectionValid}
        />
      </header>
    </div>
  );
};

export default SeatSelection;
