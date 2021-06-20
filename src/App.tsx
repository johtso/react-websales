import * as React from "react"
import { reduce, map } from "iter-tools";
import { enableMapSet, produce } from "immer";
import './App.css';
import './SeatPicker.css';
import { dummySeats } from "./dummyData";

enableMapSet()

const seatingPlan = dummySeats


const groupedMap = <T, U extends keyof T, V extends T[U]>(initialArray: T[], property: U): Map<V, T[]> => {
    return initialArray.reduce(
        (resultMap, obj: T) => resultMap.set(obj[property], [...resultMap.get(obj[property]) || [], obj]),
        new Map()
    )
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const sum = (numbers: Iterable<number>): number => reduce(0, (result, value) => result + value, numbers)

const TICKET_TYPES = ["STANDARD", "MEMBER"]
type TicketTypeType = typeof TICKET_TYPES[number]

type SeatTypeSelectorProps = {
    setTicketCount: (type: TicketTypeType, count: number) => void
    ticketCounts: SeatSelectionStateType["ticketTypes"]
}

const SeatTypeSelector = ({ticketCounts, setTicketCount}: SeatTypeSelectorProps) => {
    return (
        <form onSubmit={(e) => {e.preventDefault()}}>
            {[...map(([type, count]) =>
                <label key={type}>
                    {type}
                    <input
                        type="number"
                        value={count}
                        min="0"
                        onChange={(e) => setTicketCount(type, +e.target.value)}
                    />
                </label>,
                ticketCounts.entries()
            )]}
        </form>
    );
}

type SeatStatus = "SELECTED" | "AVAILABLE" | "UNAVAILABLE" | "DISTANCING"


const Seat = (props: {
        status: SeatStatus
        handleSeatToggle: () => void
        separatedFromPrevious: boolean
    }) => {
    return (
        <button
            className={
                [
                    "seat",
                    props.status.toLowerCase(),
                    props.separatedFromPrevious ? "separated" : "",
                ].join(" ")
            }
            onClick={ props.status === "UNAVAILABLE" ? () => {} : props.handleSeatToggle }
        >
            S
        </button>
    )
}

type SeatType = {
    id: number
    sectionId: number
    columnId: number
    rowId: number
    rowLabel: string
    columnLabel: string
}

type SeatPickerActionType =
    | {type: "SERVER_REFRESH", seats: SeatType[]}
    | {type: "SELECT_TOGGLE", seatId: SeatType["id"]}
    | {type: "SET_TICKET_COUNT", ticketType: TicketTypeType, count: number}


const seatSelectionStateReducer = produce((draft: SeatSelectionStateType, action: SeatPickerActionType) => {
    const totalTickets = () => sum(draft.ticketTypes.values())

    switch (action.type) {
        case "SELECT_TOGGLE":
            if (draft.selected.has(action.seatId)) {
                draft.selected.delete(action.seatId)
            } else {
                draft.selected.add(action.seatId)
            }

            if ((totalTickets() === 0) && (draft.selected.size === 1)) {
                draft.ticketTypes.set("STANDARD", 1)
            }

            const selections = draft.selected.values()
            while (draft.selected.size > totalTickets()) {
                draft.selected.delete(selections.next().value)
            }
            break
        case "SET_TICKET_COUNT":
            draft.ticketTypes.set(action.ticketType, action.count)
            break
    }

    draft.validSelection = (draft.selected.size > 0) && (totalTickets() === draft.selected.size)
})

const SeatPicker = (props: {
        seatPlan: SeatPlanType
        handleSeatToggle: (seatId: SeatType["id"]) => void
    }) => {

    return (
        <div className="seat-picker">
            {props.seatPlan.map((rowSeats, rowIndex) =>
                <div className="row" key={ `row-${rowIndex}` }>
                    {rowSeats.map((sectionSeats, sectionIndex) =>
                        sectionSeats.map((seat, seatIndex) =>
                            <Seat
                                key={ `seat-${seat.id}` }
                                status={ seat.status }
                                handleSeatToggle={ () => props.handleSeatToggle(seat.id) }
                                separatedFromPrevious={ seatIndex === 0 && sectionIndex !== 0 }
                            />
                        )
                    )}
                </div>
            )}
        </div>
    )
}

type SeatPlanType =  {id: SeatType["id"], status: SeatStatus}[][][]

const makeSeatPlan = (
        seats: SeatType[],
        selected: SeatSelectionStateType["selected"],
        unavailable: SeatSelectionStateType["unavailable"],
    ): SeatPlanType => {
    const seatStatus = (seat: SeatType) => {
        return selected.has(seat.id) ? "SELECTED" : (!unavailable.has(seat.id) ? "AVAILABLE" : "UNAVAILABLE")
    }

    const seatsByRow = groupedMap(seats, "rowId")
    return Array.from(seatsByRow.values(), (rowSeats) => {
        const seatsBySection = groupedMap(rowSeats, "sectionId")
        return Array.from(seatsBySection.values(), (sectionSeats) => {
            return Array.from(sectionSeats, (seat) => {
                return {
                    id: seat.id,
                    status: seatStatus(seat)
                }
            })
        })
    })
}


type SeatSelectionStateType = {
    selected: Set<SeatType["id"]>
    unavailable: Set<SeatType["id"]>
    ticketTypes: Map<TicketTypeType, number>
    validSelection: boolean
}

const initialSeatSelectionState: SeatSelectionStateType = {
    selected: new Set(),
    unavailable: new Set([5]),
    ticketTypes: new Map(map((ticketType) => [ticketType, 0], TICKET_TYPES)),
    validSelection: false,
}

const SeatSelection = () => {
    const [state, dispatch] = React.useReducer(seatSelectionStateReducer, initialSeatSelectionState)

    const handleSeatToggle = (seatId: SeatType["id"]) => dispatch({ type: "SELECT_TOGGLE", seatId: seatId })

    const selectedSeats = Array.from(state.selected, (seatId) => {
        const seat = seatingPlan[seatId]
        return `${seat.rowLabel}${seat.columnLabel}`
    }).sort()

    const handleSubmit = () => { console.log("submit") }

    const fullSeatPlan = makeSeatPlan(seatingPlan, state.selected, state.unavailable)
    return (
        <div className="App">
        <header className="App-header">
            <span className="selected-seats">Selected Seats: { selectedSeats.join(", ") }</span>
            <SeatTypeSelector
                setTicketCount={(ticketType, count) =>
                    dispatch({
                        type: "SET_TICKET_COUNT", ticketType: ticketType, count: count
                    })
                }
                ticketCounts={state.ticketTypes}
            />
            <SeatPicker
                seatPlan={fullSeatPlan}
                handleSeatToggle={handleSeatToggle}
            />
            <button onClick={ handleSubmit } disabled={ !state.validSelection }>Submit</button>
        </header>
        </div>
    );
}

export default SeatSelection;
