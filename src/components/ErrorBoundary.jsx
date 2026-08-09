import { Component } from "react";
import { ErrorCard } from "./Status.jsx";

// What stands between one broken panel and a blank white page.
//
// React unmounts the whole tree when a render throws and nothing catches it, so
// without this any single fault — a chart whose data has drifted from its
// parser, a passage that is not the shape it was written against — takes the
// site down to nothing, with no title, no way back and no sign of what went
// wrong. Caught here, the page keeps its chrome and offers the reader the one
// thing that reliably helps, which is to go somewhere else.
//
// `resetKey` is where the reader is. Moving is what clears the error: the
// boundary has no idea whether the fault has passed, but it knows the page that
// threw is no longer the page being asked for.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false });
    }
  }

  componentDidCatch(error, info) {
    // Nothing is sent anywhere — this is a site of flat files — but a reader
    // who opens the console should find the fault rather than a silent card.
    console.error("Gazelem: a panel failed to render.", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ErrorCard
        message="Something on this page couldn't be shown. The rest of the site is still there."
        onRetry={this.props.onReset}
      />
    );
  }
}
