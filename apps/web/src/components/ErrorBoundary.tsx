import { Component, ReactNode } from 'react';
import s from './ErrorBoundary.module.css';

interface State { error: Error | null; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) {
    console.error('ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={s.wrap}>
        <div className={s.card}>
          <h1 className={s.title}>Something went wrong</h1>
          <p className={s.msg}>{this.state.error.message}</p>
          <button className={s.btn} onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      </div>
    );
  }
}
