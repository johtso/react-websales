import 'components/DigitInput.css';
import { createRef, useEffect } from 'react';
import { InputPropsWithoutRef } from 'react-html-props';

const Digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
type DigitType = typeof Digits[number];

const DigitInput = ({
  count,
  handleChange,
  canIncrement = true,
  canDecrement = true,
  ...inputProps
}: {
  count: DigitType;
  handleChange: (count: DigitType) => void;
  canIncrement?: boolean;
  canDecrement?: boolean;
} & InputPropsWithoutRef): JSX.Element => {
  const inputRef = createRef<HTMLInputElement>();

  const forceToSingleDigit = (s: string): DigitType => {
    if (s.length === 0) {
      return 0;
    }
    const lastChar = s.length > 1 ? s[s.length - 1] : s;
    const num = Number(lastChar) as DigitType;
    return Number.isNaN(num) ? 0 : num;
  };

  const handleInput = (value: string) => {
    const newCount = forceToSingleDigit(value);
    handleChange(newCount);
  };

  const forceSelectAll = () => {
    inputRef.current?.setSelectionRange(0, 1);
  };

  const handleAdjust = (amount: number): void => handleChange(count + amount);

  useEffect(() => {
    forceSelectAll();
  });

  return (
    <div className="DigitInput">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => handleAdjust(-1)}
        className="minus"
        disabled={!canDecrement || count === 0}
      >
        -
      </button>
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={String(count)}
        pattern="[0-5]*"
        size={1}
        onChange={() => {}}
        onBeforeInput={(e) => {
          // assertInstanceOf(e.nativeEvent, KeyboardEvent);
          const event = e as unknown as CompositionEvent;
          handleInput(event.data);
          e.preventDefault();
        }}
        onClick={() => {
          forceSelectAll();
        }}
        onPaste={(e) => {
          e.clipboardData.items[0].getAsString(handleInput);
          e.preventDefault();
        }}
        onKeyDown={() => forceSelectAll()}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => handleAdjust(1)}
        className="plus"
        disabled={!canIncrement || count === 9}
      >
        +
      </button>
    </div>
  );
};

export default DigitInput;
