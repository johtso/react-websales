import * as React from "react"
import { enableMapSet } from "immer";
import { useImmerReducer } from "use-immer";
import './App.css';
import './SeatPicker.css';
import { dummySeats } from "./dummyData";

enableMapSet()

// function* range(end: number) {
//     for (let value = 0; value < end; value += 1) {
//         yield value;
//     }
// }

const groupedMap = <T,>(initialArray: T[], property: keyof T): Map<any, T[]> => {
    return initialArray.reduce(
        (entryMap, obj: T) => entryMap.set(obj[property], [...entryMap.get(obj[property]) || [], obj]),
        new Map()
    )
}

// function groupBy(objectArray: T[], property: string):  {
//     return objectArray.reduce(function (acc, obj) {
//         let key = obj[property]
//         if (!acc[key]) {
//             acc[key] = []
//         }
//         acc[key].push(obj)
//         return acc
//     }, {})
// }

// const clone = <T,>(items: T[][]): T[][] => items.map(item => Array.isArray(item) ? clone(item) : item);
const copyTwoDimensionalArray = <T,>(items: T[][]): T[][] => items.map(item => item.slice());

const SeatTypeSelector = () => {
    const ticketTypes = ["STANDARD", "MEMBER"]

    const defaultTicketCounts = Object.fromEntries(ticketTypes.map((ticketType) => [ticketType, 0]))

    const [ticketCounts, setTicketCounts] = React.useState(defaultTicketCounts)

    return (
        <form onSubmit={(e) => {e.preventDefault()}}>
            {
                Object.entries(ticketCounts).map(([type, count]) =>
                    <label key={type}>
                        {type}
                        <input
                            type="number"
                            value={count}
                            min="0"
                            onChange={
                                (e) => setTicketCounts(
                                    (prevCounts) => Object.assign({}, prevCounts, {[type]: +e.target.value})
                                )
                            }
                        />
                    </label>
                )
            }
        </form>
    );
}

type SeatStatus = "SELECTED" | "AVAILABLE" | "UNAVAILABLE" | "DISTANCING"

type SeatProps = {
    status: SeatStatus
    onClick: () => void
    separatedFromPrevious: boolean
}

const Seat = ({ status, onClick, separatedFromPrevious }: SeatProps) => {
    return (
        <button
            className={
                [
                    "seat",
                    status.toLowerCase(),
                    separatedFromPrevious ? "separated" : ""
                ].join(" ")
            }
            onClick={ status == "UNAVAILABLE" ? () => {} : onClick}
        >
            S
        </button>
    )
}


// const calculateSeatStatuss = (seats, selectedSeats) => {

// }

type SeatType = {
    id: number
    sectionId: number
    columnId: number
    rowId: number
    rowLabel: string
    columnLabel: string
    available: boolean
    endOfSection?: boolean
}

type SeatPickerActionType =
    | {type: "SERVER_REFRESH", seats: SeatType[]}
    | {type: "SELECT_TOGGLE", seatId: SeatType["id"]}

type SeatPickerStateType = {
    seats: SeatType[]
    selected: Set<SeatType["id"]>
    seatStatuses: Map<SeatType["id"], SeatStatus>
    totalSeats: number
}

// TODO: change total seats action
// work out how to pass total seat changes to seat picker state
//

const seatPickerStateReducer = (draft: SeatPickerStateType, action: SeatPickerActionType) => {
    switch (action.type) {
        case "SELECT_TOGGLE":
            if (draft.selected.has(action.seatId)) {
                draft.selected.delete(action.seatId)
            } else {
                draft.selected.add(action.seatId)
            }

            const selections = draft.selected.values()
            while (draft.selected.size > draft.totalSeats) {
                draft.selected.delete(selections.next().value)
            }
    }
}


const SeatPicker = ({ totalSeats }: {totalSeats: number}) => {
    const initialState: SeatPickerStateType = {
        seats: dummySeats,
        selected: new Set(),
        seatStatuses: new Map(),
        totalSeats: totalSeats,
    }
    const [state, dispatch] = useImmerReducer<SeatPickerStateType>(seatPickerStateReducer, initialState)

    const seatsByRow = groupedMap(state.seats, "rowId")

    const selectedSeats = (): string[] => {
        return Array.from(state.selected, (seatId) => {
            const seat = state.seats[seatId]
            return `${seat.rowLabel}${seat.columnLabel}`
        }).sort()
    }

    return (
        <div className="seat-picker">
            <span className="selected-seats">{ selectedSeats().join(", ") }</span>
            {Array.from(seatsByRow, ([rowId, rowSeats]) =>
                <div className="row" key={ `row-${rowId}` }>
                    {rowSeats.map((seat, i) =>
                        <Seat
                            key={ `seat-${seat.id}` }
                            status={ state.selected.has(seat.id) ? "SELECTED" : (seat.available ? "AVAILABLE" : "UNAVAILABLE") }
                            onClick={ () => dispatch({type: "SELECT_TOGGLE", seatId: seat.id}) }
                            separatedFromPrevious={ i !== 0 && seat.sectionId !== rowSeats[i-1].sectionId }
                        />
                    )}
                </div>
            )}
        </div>
    )
}


function App() {
  return (
    <div className="App">
      <header className="App-header">
        <SeatTypeSelector />
        <SeatPicker totalSeats={3} />
      </header>
    </div>
  );
}

export default App;
