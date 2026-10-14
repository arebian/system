import React, { Component } from 'react';
import { recoveryMessage } from './systemErrors.js';
import { reportSystemError } from './systemErrorReporter.js';

export default class SectionBoundary extends Component {
  state = { error: null, resetKey: this.props.resetKey };
  static getDerivedStateFromError(error) { return { error }; }
  static getDerivedStateFromProps(props, state) {
    return props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null;
  }
  componentDidCatch(error) { void reportSystemError(error, this.props.area); }
  render() {
    if (!this.state.error) return this.props.children;
    return <section className="system-section-recovery" role="alert">
      <small>SYSTEM NOTICE</small><h2>This screen needs to reconnect.</h2>
      <p>{recoveryMessage(this.state.error, this.props.area)}</p>
      <button type="button" onClick={() => this.setState({ error: null })}>RETRY SCREEN</button>
      <button type="button" onClick={() => location.reload()}>RELOAD SYSTEM</button>
    </section>;
  }
}
