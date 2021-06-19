import * as React from "react"
import { reduce, map, groupBy } from "iter-tools";
import { enableMapSet } from "immer";
import { useImmerReducer } from "use-immer";
import './App.css';
import './SeatPicker.css';
import { dummySeats } from "./dummyData";

enableMapSet()


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
            onClick={ status === "UNAVAILABLE" ? () => {} : onClick}
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
    available: boolean
    endOfSection?: boolean
}

type SeatPickerActionType =
    | {type: "SERVER_REFRESH", seats: SeatType[]}
    | {type: "SELECT_TOGGLE", seatId: SeatType["id"]}
    | {type: "SET_TICKET_COUNT", ticketType: TicketTypeType, count: number}


const seatSelectionStateReducer = (draft: SeatSelectionStateType, action: SeatPickerActionType) => {
    switch (action.type) {
        case "SELECT_TOGGLE":
            if (draft.selected.has(action.seatId)) {
                draft.selected.delete(action.seatId)
            } else {
                draft.selected.add(action.seatId)
            }

            let totalTickets = sum(draft.ticketTypes.values())

            if ((totalTickets === 0) && (draft.selected.size === 1)) {
                draft.ticketTypes.set("STANDARD", 1)
            }

            totalTickets = sum(draft.ticketTypes.values())
            const selections = draft.selected.values()
            while (draft.selected.size > totalTickets) {
                draft.selected.delete(selections.next().value)
            }
            break
        case "SET_TICKET_COUNT":
            draft.ticketTypes.set(action.ticketType, action.count)
            break
    }
}

type SeatPickerProps = {
    seatPlan: SeatPlanType
    handleSeatSelect: (seatId: SeatType["id"]) => void
}

const SeatPicker = ({ seatPlan, handleSeatSelect }: SeatPickerProps) => {

    return (
        <div className="seat-picker">
            {seatPlan.map((rowSeats, rowIndex) =>
                <div className="row" key={ `row-${rowIndex}` }>
                    {rowSeats.map((sectionSeats, sectionIndex) =>
                        sectionSeats.map((seat, seatIndex) =>
                            <Seat
                                key={ `seat-${seat.id}` }
                                status={ seat.status }
                                onClick={ () => handleSeatSelect(seat.id) }
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

const makeSeatPlan = (seats: SeatSelectionStateType["seats"], selected: SeatSelectionStateType["selected"]): SeatPlanType => {
    const seatStatus = (seat: SeatType) => {
        return selected.has(seat.id) ? "SELECTED" : (seat.available ? "AVAILABLE" : "UNAVAILABLE")
    }

    const seatsByRow = groupBy((seat) => { seat.rowId }, seats)
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
    seats: SeatType[]
    selected: Set<SeatType["id"]>
    seatStatuses: Map<SeatType["id"], SeatStatus>
    ticketTypes: Map<TicketTypeType, number>
    error: string
}

function SeatSelection() {
    const initialState: SeatSelectionStateType = {
        seats: dummySeats,
        selected: new Set(),
        seatStatuses: new Map(),
        ticketTypes: new Map(map((ticketType) => [ticketType, 0], TICKET_TYPES)),
        error: "",
    }
    const [state, dispatch] = useImmerReducer<SeatSelectionStateType>(seatSelectionStateReducer, initialState)

    const handleSeatSelect = (seatId: SeatType["id"]) => dispatch({ type: "SELECT_TOGGLE", seatId: seatId })

    const selectedSeats = Array.from(state.selected, (seatId) => {
        const seat = state.seats[seatId]
        return `${seat.rowLabel}${seat.columnLabel}`
    }).sort()

    const seatPlan = makeSeatPlan(state.seats, state.selected)
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
                seatPlan={seatPlan}
                handleSeatSelect={handleSeatSelect}
            />
        </header>
        </div>
    );
}

export default SeatSelection;
