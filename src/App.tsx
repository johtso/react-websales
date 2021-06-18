import * as React from "react"
import './App.css';
import './SeatPicker.css';
import { dummySeats } from "./dummyData";


function* range(end: number) {
    for (let value = 0; value < end; value += 1) {
        yield value;
    }
}

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

type SeatState = "SELECTED" | "AVAILABLE"

type SeatProps = {
    state: SeatState
    onClick: () => void
}

const Seat = ({ state, onClick }: SeatProps) => {
    return (
        <div
            className={ ["seat", state.toLowerCase()].join(" ") }
            onClick={onClick}
        >
            S
        </div>
    )
}


// const calculateSeatStates = (seats, selectedSeats) => {

// }

type SeatType = [number, number]
// type SeatType = {
//     id: number;
//     sectionId: number;
//     columnId: number;
//     rowId: number;
//     rowLabel: string;
//     columnLabel: string;
// }

const seatPickerStateReducer = (prevState: SeatState[][], action: SeatType) => {
    console.log(prevState)
    const seat = action
    let newState = copyTwoDimensionalArray(prevState)

    const prevSeatState = prevState[seat[0]][seat[1]]

    newState[seat[0]][seat[1]] = ((prevSeatState === "AVAILABLE") ? "SELECTED" : "AVAILABLE")
    console.log(newState)
    return newState
}

const SeatPicker = () => {
    const width = 5;
    const height = 5;

    const selectionLimit = 3
    // const [selected, setSelected] = React.useState(new Set())
    //<Set<SeatType[]>>

    const initialState: SeatState[][] = []
    for (const row of range(height)) {
        let row: SeatState[] = []
        for (const col of range(width)) {
            row.push("AVAILABLE")
        }
        initialState.push(row)
    }

    const [seatStates, dispatch] = React.useReducer(seatPickerStateReducer, initialState)

    // const toggleSeat = (seat) => {
    //     setSelected((prevSelected) =>
    //         let newSelected = []
    //         for (const seat of prevSelected) {
    //             newSelected.push()
    //         }
    //     )
    // }

    // const isSelected = (seat) => selected.includes(seat)



    return (
        <div className="seat-picker">
            {[...Array(height)].map((x, row) =>
                <div className="row" key={row}>
                    {[...Array(width)].map((x, col) =>
                        <Seat
                            key={ `${row}-${col}` }
                            state={ seatStates[col][row] }
                            onClick={ () => dispatch([col, row]) }
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
        <SeatPicker />
      </header>
    </div>
  );
}

export default App;
