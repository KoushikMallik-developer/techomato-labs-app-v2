import { Component } from 'react';

/** Catches render errors anywhere below it so a bug shows a message and a Reload button, not a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>Reload the page to try again.</p>
        <button className="btn primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
