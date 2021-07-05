import { inspect } from '@xstate/inspect';
import 'easy-peasy/map-set-support';
import { StrictMode } from 'react';
import { debugContextDevtool } from 'react-context-devtool';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';

inspect({
  url: 'https://statecharts.io/inspect',
  iframe: false,
});

const container = document.getElementById('root');

ReactDOM.render(
  <StrictMode>
    <App />
  </StrictMode>,
  container
);

debugContextDevtool(container);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals(console.log);
