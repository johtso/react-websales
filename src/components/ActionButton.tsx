import 'components/ActionButton.css';
import 'index.css';
import { ButtonProps } from 'react-html-props';
import { ReactComponent as Spinner } from 'svg/spinner.svg';

const ActionButton = ({
  text,
  handleClick,
  busy = false,
  ...buttonProps
}: {
  text: string;
  handleClick: (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  busy: boolean;
} & ButtonProps): JSX.Element => (
  // eslint-disable-next-line react/button-has-type
  <button
    {...buttonProps}
    className={`ActionButton ${busy ? 'busy' : ''}`}
    onClick={(e) => {
      handleClick(e);
      e.preventDefault();
    }}
  >
    {busy ? <Spinner /> : null}
    {text}
  </button>
);

export default ActionButton;
